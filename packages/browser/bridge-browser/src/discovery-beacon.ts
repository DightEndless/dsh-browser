/**
 * Fixed-port discovery beacon for the browser extension.
 *
 * DSH Desktop binds its web server to a system-assigned port on every launch
 * (`dsh-desktop.port: 0`), and the extension cannot read the filesystem to learn
 * that port. Without a beacon the extension would have to probe a wide port
 * range — behaviour that looks like port scanning and costs seconds on every
 * reconnect after a DSH restart.
 *
 * This module listens on a small, fixed set of loopback ports and answers
 * `GET /ext/bridge-config` with the live WebSocket URL, so the extension reaches
 * the bridge in one request. The same JSON shape is served by the host web
 * server, so the extension needs no special case.
 *
 * Ports are tried in order so a second DSH instance (or an unrelated program)
 * holding the first one does not disable discovery: the listener simply takes
 * the next free port. All candidate ports are compiled into the extension, so it
 * probes this short list rather than a range.
 *
 * @module
 */

import { createServer, type Server } from 'node:http'

/**
 * Loopback ports the extension probes for discovery, in order.
 *
 * Deliberately small and in the registered range (1024-49151): 3 candidates mean
 * at most three immediate connection attempts, never a range scan.
 */
export const DISCOVERY_BEACON_PORTS = [30789, 30790, 30791] as const

/** Loopback address the beacon binds; never exposed to the network. */
const BEACON_HOST = '127.0.0.1'

/** Path the extension fetches; identical to the host web server's route. */
const BEACON_PATH = '/ext/bridge-config'

export interface DiscoveryBeaconOptions {
  /** Live bridge WebSocket URL, recomputed per request so a port change is picked up. */
  readonly wsUrl: () => string
  /** Extra fields merged into the JSON body (extension status, etc.). */
  readonly details?: () => Record<string, unknown>
  /** Diagnostics sink; failures are non-fatal. */
  readonly logger?: {
    info?: (message: string) => void
    warn?: (message: string) => void
  }
}

export interface DiscoveryBeacon {
  /** Port actually bound, or undefined when every candidate was taken. */
  readonly port: number | undefined
  /** Close the listener and release the port. */
  close(): Promise<void>
}

/** Try one port; resolves the server on success, undefined when taken. */
async function listenOn(port: number, options: DiscoveryBeaconOptions): Promise<Server | undefined> {
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || (request.url ?? '').split('?')[0] !== BEACON_PATH) {
      response.writeHead(404, { 'content-type': 'text/plain' })
      response.end('not found')
      return
    }
    try {
      const body = JSON.stringify({ wsUrl: options.wsUrl(), ...(options.details?.() ?? {}) })
      response.writeHead(200, {
        'content-type': 'application/json',
        // The extension is the only intended consumer, but a stale CORS cache in
        // one browser must not hide a later port change.
        'cache-control': 'no-store',
      })
      response.end(body)
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain' })
      response.end(String(error))
    }
  })

  return await new Promise<Server | undefined>((resolve) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      server.removeListener('listening', onListening)
      server.close()
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        resolve(undefined)
        return
      }
      options.logger?.warn?.(`browser bridge: discovery beacon on ${port} failed: ${String(error)}`)
      resolve(undefined)
    }
    const onListening = (): void => {
      server.removeListener('error', onError)
      // A beacon is a convenience: never let a late socket error crash the host.
      server.on('error', (error) => {
        options.logger?.warn?.(`browser bridge: discovery beacon error: ${String(error)}`)
      })
      resolve(server)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, BEACON_HOST)
  })
}

/**
 * Start the discovery beacon on the first free candidate port.
 *
 * Resolves with the bridge absent when every candidate is taken; the extension
 * then falls back to its own discovery, so this never blocks bridge operation.
 */
export async function startDiscoveryBeacon(options: DiscoveryBeaconOptions): Promise<DiscoveryBeacon> {
  for (const port of DISCOVERY_BEACON_PORTS) {
    const server = await listenOn(port, options)
    if (server === undefined) continue
    options.logger?.info?.(`browser bridge: discovery beacon listening on http://${BEACON_HOST}:${port}${BEACON_PATH}`)
    let closed = false
    return {
      port,
      async close(): Promise<void> {
        if (closed) return
        closed = true
        await new Promise<void>((resolve) => { server.close(() => resolve()) })
      },
    }
  }
  options.logger?.warn?.(
    `browser bridge: discovery beacon could not bind any of ${DISCOVERY_BEACON_PORTS.join(', ')}; `
    + 'the extension falls back to its own discovery',
  )
  return { port: undefined, close: async () => {} }
}
