/**
 * Bridge WebSocket carrier: token-authenticated connection registry, gateway
 * RPC dispatch, per-connection event pump, and tool-call dispatch to the
 * connected browser extension.
 *
 * The route this server mounts (`/ext/bridge`) lives OUTSIDE the /api trust
 * fence (which only guards the client-connection routes), so the bridge brings
 * its own authentication: a bearer token presented in the `hello` frame within
 * HELLO_TIMEOUT_MS. Host calls terminate at the bridge-owned Host adapter.
 * Methods the /api carrier pins to loopback (`PRIVILEGED_METHODS`)
 * stay loopback-only here regardless of the token, defense in depth for
 * `--host 0.0.0.0` deployments.
 *
 * One browser extension per connection, several at once: each authenticated
 * socket keeps its own event pump and identity, and tool calls are routed to
 * the connection the caller targets (otherwise the most recently active one).
 * A browser that reconnects replaces only its own previous socket, matched by
 * the identity it reports in `hello`.
 *
 * @module
 */

import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'
import type { BrowserHostApi } from './host-api.ts'
import {
  BRIDGE_INJECT_BROWSER_SNAPSHOT_METHOD,
  BRIDGE_SESSION_PURGE_METHOD,
  HELLO_TIMEOUT_MS,
  PING_INTERVAL_MS,
  parseBridgeFrame,
  type BridgeBrowserEntry,
  type BridgeBrowserId,
  type BridgeBrowserInfo,
  type BridgeFrame,
  type BridgeCaps,
  type ClientFrame,
  type ToolErrorCode,
} from './protocol.ts'
import { SessionPurgeError } from './session-purge.ts'
import { verifyToken } from './token.ts'

/**
 * Gateway methods the /api carrier pins to loopback (mirror of
 * client-connection's PRIVILEGED_METHODS; kept verbatim so the two fences
 * cannot drift). The bridge rejects these for non-loopback remotes even with
 * a valid token.
 */
const PRIVILEGED_METHODS = new Set([
  'host.pickDirectory',
  'host.openPath',
  'settings.describe',
  'settings.openDocument',
  'settings.update',
  'settings.replace',
  'settings.mutate',
  'credentials.describe',
  'credentials.set',
  'credentials.unset',
])

/** Session mutations whose WebSocket arrival order is behaviorally significant. */
const ORDERED_SESSION_METHODS = new Set([
  BRIDGE_INJECT_BROWSER_SNAPSHOT_METHOD,
  'session.prompt',
  'session.cancel',
])

/** Loopback IPv4/IPv6 literals (IPv4-mapped included). Exported for tests and reuse. */
export function isLoopbackAddress(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/** Error thrown by requestTool; the tool registry turns it into an isError result. */
export class BridgeToolError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'BridgeToolError'
  }
}

/** Dependencies the bridge needs from the host. */
export interface BridgeServerDeps {
  /** Bearer token the extension must present in `hello`. */
  token: string
  /** Active dsh Host adapter used for unary calls, events, and waterfalls. */
  api: BrowserHostApi
  /** Default per-tool-call timeout in ms. */
  toolTimeoutMs: number
  /** Capabilities to echo in `hello.ok` (negotiated snapshot budgets). */
  caps: BridgeCaps
  /** Seed a followed-page snapshot into a live or deferred Agent session. */
  injectBrowserSnapshot: (sessionId: string, snapshot: string) => void | Promise<void>
  /**
   * Permanently delete one session's durable storage. Callers archive the
   * session through the gateway first; this only removes files.
   */
  purgeSession: (sessionId: string) => Promise<void>
  /**
   * Test seam: force the remote address seen by the privilege gate. The
   * sandbox cannot bind arbitrary loopback literals, so the non-loopback
   * branch is exercised through this override; production never sets it.
   */
  remoteAddressOverride?: string
  /** Seconds a fresh socket may present `hello`; defaults to HELLO_TIMEOUT_MS. */
  helloTimeoutMs?: number
  /** Server ping cadence; defaults to PING_INTERVAL_MS. */
  pingIntervalMs?: number
}

/** One in-flight tool call awaiting the extension's `tool.result`. */
interface PendingTool {
  resolve: (result: unknown) => void
  reject: (error: BridgeToolError) => void
  timer: NodeJS.Timeout
}

/** Options for one model-facing browser action. */
export interface RequestToolOptions {
  /** Explicit target browser id; omit to use the default browser. */
  browserId?: BridgeBrowserId
  /** Owning Agent session, forwarded for approval continuity. */
  sessionId?: string
  /** Per-call budget in ms; defaults to the plugin config value. */
  timeoutMs?: number
}

/** A socket that passed authentication. Each one owns a browser identity. */
interface ReadyConnection {
  /** Stable id derived from the extension's reported identity. */
  id: BridgeBrowserId
  /** Identity the extension reported (or the derived fallback). */
  browser: BridgeBrowserInfo
  ws: WebSocket
  /** Remote address captured at upgrade time (loopback gate for privileged methods). */
  remoteAddress: string | undefined
  abort: AbortController
  pump: Promise<void>
  ping: NodeJS.Timeout
}

/** Normalize a browser label to a stable lowercase id fragment. */
function slugifyBrowserId(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug === '' ? 'browser' : slug
}

/** Derive a browser identity for extensions too old to report one. */
function inferBrowserInfo(origin: string | undefined): BridgeBrowserInfo {
  if (typeof origin === 'string' && origin.startsWith('moz-extension://')) {
    return { kind: 'firefox', label: 'Firefox' }
  }
  return { kind: 'chrome', label: 'Chrome' }
}

/**
 * Whether two hello payloads describe the same browser install. The persisted
 * per-install id wins when both sides report one; otherwise the vendor fields
 * are the best available signal (extensions built before instance ids).
 */
function sameBrowserIdentity(a: BridgeBrowserInfo, b: BridgeBrowserInfo): boolean {
  if (a.instanceId !== undefined && b.instanceId !== undefined) return a.instanceId === b.instanceId
  return slugifyBrowserId(a.kind) === slugifyBrowserId(b.kind)
    && a.label === b.label
    && a.version === b.version
}

function sendFrame(ws: WebSocket, frame: BridgeFrame): void {
  /* v8 ignore next -- teardown race: the socket can die between a pump's
  readiness check and this write; the guard refuses writes on dead sockets */
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify(frame))
}

/**
 * Decode one ws message payload to text. Exported so all three delivery
 * shapes (fragmented buffer list, Buffer, ArrayBuffer) are unit-testable
 * directly — node ws only ever delivers Buffers in practice.
 * @param data - ws message payload.
 * @returns the decoded UTF-8 text.
 */
export function messageToText(data: Buffer | ArrayBuffer | Buffer[]): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8')
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  return Buffer.from(data).toString('utf8')
}

/**
 * Token-authenticated bridge server. Construct once per plugin instance;
 * dispose with {@link close}.
 */
export class BridgeServer {
  private readonly wss = new WebSocketServer({ noServer: true })
  /** Every authenticated connection, keyed by its stable browser id. */
  private readonly connections = new Map<BridgeBrowserId, ReadyConnection>()
  /** Browser that receives calls when the caller names none. */
  private defaultBrowserId: BridgeBrowserId | undefined
  /** Most recent connection to receive a routed call (fallback default). */
  private lastActive: ReadyConnection | null = null
  private readonly pendingTools = new Map<string, PendingTool>()
  private readonly orderedSessionRpcs = new Map<string, Promise<void>>()
  private closed = false

  constructor(private readonly deps: BridgeServerDeps) {}

  /**
   * Handle one HTTP upgrade for the bridge path.
   * @param req - upgrade request (carries the client's remote address).
   * @param socket - raw socket transferred by the HTTP server.
   * @param head - bytes already read after the upgrade headers.
   */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const remote = this.deps.remoteAddressOverride ?? req.socket.remoteAddress
    const origin = req.headers.origin
    this.wss.handleUpgrade(req, socket, head, (ws) => { this.attach(ws, remote, origin) })
  }

  /**
   * Request one browser action from a connected extension.
   *
   * The primitive form takes `(name, args, signal, timeoutMs, sessionId)`; the
   * object form adds an explicit `browserId` target. Without a target the call
   * goes to the default browser, then to the most recently active connection.
   *
   * @param name - tool name (also the wire action name).
   * @param args - validated tool arguments.
   * @param signal - caller cancellation (abort settles the call as cancelled).
   * @param optionsOrTimeoutMs - per-call options, or the legacy timeout number.
   * @param legacySessionId - owning Agent session when using the legacy form.
   * @returns the extension's action result.
   * @throws BridgeToolError when no extension is connected, no connection
   *   matches the requested target, the call times out, is cancelled, or the
   *   extension reports a failure.
   */
  requestTool(
    name: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
    optionsOrTimeoutMs?: number | RequestToolOptions,
    legacySessionId?: string,
  ): Promise<unknown> {
    const options: RequestToolOptions = typeof optionsOrTimeoutMs === 'number' || optionsOrTimeoutMs === undefined
      ? {
          ...(optionsOrTimeoutMs === undefined ? {} : { timeoutMs: optionsOrTimeoutMs }),
          ...(legacySessionId === undefined ? {} : { sessionId: legacySessionId }),
        }
      : optionsOrTimeoutMs
    const timeoutMs = options.timeoutMs ?? this.deps.toolTimeoutMs
    const conn = this.resolveConnection(options.browserId)
    // A caller that already aborted must not dispatch: the abort listener
    // below does not replay for pre-aborted signals, so the call would be
    // sent to the extension and executed despite the cancellation.
    if (signal.aborted) {
      throw new BridgeToolError('bridge-closed', 'tool call cancelled before dispatch')
    }
    const id = randomUUID()
    const expiresAt = Date.now() + timeoutMs
    // Remember where the call landed: the next untargeted call follows it.
    this.lastActive = conn
    return new Promise<unknown>((resolve, reject) => {
      let timer: NodeJS.Timeout
      const settle = (error: BridgeToolError): void => {
        clearTimeout(timer)
        this.pendingTools.delete(id)
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
      const cancel = (error: BridgeToolError): void => {
        // The extension may be paused on a user approval after the caller has
        // stopped waiting. Withdraw that approval before settling locally so
        // a late click cannot execute an expired action.
        sendFrame(conn.ws, { t: 'tool.cancel', id })
        settle(error)
      }
      const onAbort = (): void => {
        cancel(new BridgeToolError('bridge-closed', 'tool call cancelled before the extension answered'))
      }
      timer = setTimeout(() => {
        cancel(new BridgeToolError('timeout', `browser action "${name}" timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      signal.addEventListener('abort', onAbort, { once: true })
      this.pendingTools.set(id, { resolve, reject, timer })
      conn.ws.send(JSON.stringify({
        t: 'tool.call',
        id,
        name,
        args,
        expiresAt,
        ...(options.sessionId === undefined ? {} : { sessionId: options.sessionId }),
      } satisfies BridgeFrame), (error) => {
        /* v8 ignore next -- teardown race: when the write fails, the socket's
        close handler settles the same call with the same code; the callback
        path is a defensive second settle, covered via the close path */
        if (error != null) {
          settle(new BridgeToolError('bridge-closed', `bridge socket failed before delivery: ${error.message}`))
        }
      })
    })
  }

  /**
   * Resolve which connection owns a tool call.
   * @param browserId - explicit target browser, when the caller named one.
   * @returns the targeted connection.
   * @throws BridgeToolError when nothing is connected or the target is unknown.
   */
  private resolveConnection(browserId: BridgeBrowserId | undefined): ReadyConnection {
    if (this.connections.size === 0) {
      throw new BridgeToolError('bridge-closed', 'no browser extension is connected to the bridge')
    }
    if (browserId !== undefined && browserId !== '') {
      const explicit = this.connections.get(browserId)
      if (explicit !== undefined) return explicit
      throw new BridgeToolError(
        'no-active-tab',
        `browser "${browserId}" is not connected; connected browsers: ${this.describeConnections()}. `
        + 'Call browser_use to list or switch the target browser.',
      )
    }
    const preferred = this.defaultBrowserId === undefined ? undefined : this.connections.get(this.defaultBrowserId)
    if (preferred !== undefined) return preferred
    if (this.lastActive !== null && this.connections.has(this.lastActive.id)) return this.lastActive
    throw new BridgeToolError(
      'bridge-closed',
      `no browser is selected for this call; connected browsers: ${this.describeConnections()}. `
      + 'Call browser_use to choose the target browser.',
    )
  }

  /** Comma-separated browser ids for diagnostics. */
  private describeConnections(): string {
    const ids = [...this.connections.keys()]
    return ids.length === 0 ? 'none' : ids.join(', ')
  }

  /**
   * List every connected browser, marking the current call target.
   * @param browserId - browser the caller already targeted, when any.
   * @returns one entry per live connection.
   */
  listBrowsers(browserId?: BridgeBrowserId): BridgeBrowserEntry[] {
    const preferred = browserId !== undefined && this.connections.has(browserId)
      ? browserId
      : this.defaultBrowserId !== undefined && this.connections.has(this.defaultBrowserId)
        ? this.defaultBrowserId
        : this.lastActive?.id
    return [...this.connections.values()].map((conn) => ({
      id: conn.id,
      kind: conn.browser.kind,
      label: conn.browser.label,
      ...(conn.browser.version === undefined ? {} : { version: conn.browser.version }),
      isDefault: conn.id === preferred,
    }))
  }

  /**
   * Set the browser that later untargeted calls use.
   * @param browserId - id from {@link listBrowsers}.
   * @returns whether the id matched a live connection.
   */
  setDefaultBrowser(browserId: BridgeBrowserId): boolean {
    if (!this.connections.has(browserId)) return false
    this.defaultBrowserId = browserId
    return true
  }

  /** @returns the browser untargeted calls currently use, when one is selected. */
  getDefaultBrowserId(): BridgeBrowserId | undefined {
    return this.defaultBrowserId !== undefined && this.connections.has(this.defaultBrowserId)
      ? this.defaultBrowserId
      : this.lastActive?.id
  }

  /**
   * Terminate the server: close the acceptor, drop all sockets, reject all
   * in-flight tool calls.
   * @returns a promise resolving after the acceptor and all pumps stop.
   */
  async close(): Promise<void> {
    // Idempotent: a second close must not touch the acceptor (ws throws
    // "The server is not running" when closing an already-closed server).
    if (this.closed) return
    this.closed = true
    const pumps = [...this.connections.values()].map((conn) => conn.pump)
    this.connections.clear()
    this.defaultBrowserId = undefined
    this.lastActive = null
    this.settleAllPending('bridge-closed', 'the bridge shut down')
    for (const socket of this.wss.clients) socket.terminate()
    await new Promise<void>((resolve, reject) => {
      this.wss.close((error) => {
        /* v8 ignore next -- acceptor close cannot fail: close() is idempotent
        and the noServer acceptor only reports teardown of already-terminated clients */
        if (error === undefined) resolve()
        /* v8 ignore next -- same unreachable arm */
        else reject(error)
      })
    })
    await Promise.all(pumps)
  }

  /** @returns whether at least one authenticated extension is connected. */
  hasConnection(): boolean {
    return this.connections.size > 0
  }

  /** Reject every in-flight tool call with the same error. */
  private settleAllPending(code: ToolErrorCode, message: string): void {
    for (const [id, pending] of this.pendingTools) {
      clearTimeout(pending.timer)
      this.pendingTools.delete(id)
      pending.reject(new BridgeToolError(code, message))
    }
  }

  private attach(ws: WebSocket, remoteAddress: string | undefined, origin: string | undefined): void {
    let helloTimer: NodeJS.Timeout | undefined = setTimeout(() => {
      ws.close(4001, 'hello timeout')
    }, this.deps.helloTimeoutMs ?? HELLO_TIMEOUT_MS)
    /** This socket's registry entry once authenticated. */
    let conn: ReadyConnection | null = null

    const onMessage = (data: Buffer | ArrayBuffer | Buffer[]): void => {
      const text = messageToText(data)
      const frame = parseBridgeFrame(text)
      if (frame === undefined) {
        ws.close(1008, 'unparseable frame')
        return
      }
      if (helloTimer !== undefined) {
        // Pending state: only `hello` is legal.
        if (frame.t !== 'hello') {
          ws.close(1008, 'hello first')
          return
        }
        // Zero-config local mode: loopback sockets skip the token (the
        // extension auto-discovers the bridge and connects without setup).
        // WebSockets have no same-origin policy, so a malicious page could
        // open a cross-origin socket to 127.0.0.1 with a loopback remote —
        // the loopback shortcut therefore requires a chrome-extension://
        // Origin (only extension contexts can present one; pages cannot
        // forge the header). Firefox moz-extension:// origins contain a
        // per-install UUID rather than the manifest's stable Gecko ID, so
        // they are not an identity boundary and must present the bearer token.
        // Non-loopback remotes must also present the bearer token.
        const loopbackNoToken = isLoopbackAddress(remoteAddress)
          && typeof origin === 'string'
          && origin.startsWith('chrome-extension://')
        if (!loopbackNoToken && !verifyToken(this.deps.token, frame.token)) {
          ws.close(4002, 'bad token')
          return
        }
        clearTimeout(helloTimer)
        helloTimer = undefined
        this.registerConnection(ws, remoteAddress, frame, origin)
        conn = this.findBySocket(ws)
        return
      }
      /* v8 ignore next -- the pending-hello branch above always registers a connection first */
      if (conn === null) return
      this.handleReadyFrame(conn, frame)
    }
    const onClose = (): void => {
      if (helloTimer !== undefined) clearTimeout(helloTimer)
      if (conn !== null) this.dropConnection(conn)
    }
    ws.on('message', onMessage)
    ws.once('close', onClose)
    ws.once('error', onClose)
  }

  /** Promote an authenticated socket into its own browser slot. */
  private registerConnection(ws: WebSocket, remoteAddress: string | undefined, hello: Extract<ClientFrame, { t: 'hello' }>, origin: string | undefined): void {
    const browser = hello.browser ?? inferBrowserInfo(origin)
    // One live slot per browser install: retire this install's previous socket
    // before minting the new one, so a service-worker reconnect replaces its own
    // slot. Other browser installs (even one reporting the same vendor) stay.
    for (const existing of [...this.connections.values()]) {
      if (sameBrowserIdentity(existing.browser, browser)) this.dropConnection(existing)
    }
    const id = this.mintBrowserId(browser)
    // A reconnect from the same browser replaces only that browser's slot, so
    // other connected browsers keep working.
    const previous = this.connections.get(id)
    if (previous !== undefined) this.dropConnection(previous)
    const abort = new AbortController()
    const ping = setInterval(() => { sendFrame(ws, { t: 'ping' }) }, this.deps.pingIntervalMs ?? PING_INTERVAL_MS)
    const pump = (async () => {
      try {
        for await (const frame of this.deps.api.events(abort.signal)) {
          if (ws.readyState !== WebSocket.OPEN) break
          sendFrame(ws, {
            t: 'event',
            frame,
          })
        }
      } catch (error: unknown) {
        if (!abort.signal.aborted && ws.readyState === WebSocket.OPEN) {
          sendFrame(ws, { t: 'error', code: 'stream-failed', message: String(error) })
          // An authenticated socket without its Remote streams is unusable but
          // otherwise appears healthy to the extension. Closing the generation
          // activates its bounded reconnect loop and rebuilds every follower.
          ws.close(1011, 'event stream failed')
        }
      }
    })()
    const conn: ReadyConnection = { id, browser, ws, remoteAddress, abort, pump, ping }
    this.connections.set(id, conn)
    this.lastActive = conn
    if (this.defaultBrowserId === undefined) this.defaultBrowserId = id
    sendFrame(ws, { t: 'hello.ok', caps: this.deps.caps })
    ws.once('close', () => {
      clearInterval(ping)
      abort.abort()
    })
  }

  /** Pick a unique browser id for one connection. */
  private mintBrowserId(browser: BridgeBrowserInfo): BridgeBrowserId {
    const base = slugifyBrowserId(browser.kind)
    if (!this.connections.has(base)) return base
    let suffix = 2
    while (this.connections.has(`${base}-${suffix}`)) suffix += 1
    return `${base}-${suffix}`
  }
  /** Remove one connection from the registry, settling whatever it owned. */
  private dropConnection(conn: ReadyConnection): void {
    if (this.connections.get(conn.id) === conn) this.connections.delete(conn.id)
    clearInterval(conn.ping)
    conn.abort.abort()
    if (conn.ws.readyState === WebSocket.OPEN || conn.ws.readyState === WebSocket.CONNECTING) {
      conn.ws.close(4000, 'replaced')
    }
    if (this.lastActive === conn) this.lastActive = this.connections.values().next().value ?? null
    if (this.defaultBrowserId === conn.id) this.defaultBrowserId = undefined
    this.settleAllPending('bridge-closed', 'the extension connection was replaced')
  }

  /** Look up the registry entry that owns one socket. */
  private findBySocket(ws: WebSocket): ReadyConnection | null {
    for (const conn of this.connections.values()) {
      if (conn.ws === ws) return conn
    }
    return null
  }

  private handleReadyFrame(conn: ReadyConnection, frame: BridgeFrame): void {
    // Defensive: a frame that arrives before this socket's hello is handled by
    // the pending branch in attach(); never dereference a missing connection.
    if (this.connections.get(conn.id) !== conn) return
    switch (frame.t) {
      case 'rpc':
        this.routeRpc(conn, frame)
        break
      case 'respond':
        void this.handleRespond(conn, frame)
        break
      case 'tool.result':
        this.settleTool(conn, frame.id, frame.ok, frame.ok ? frame.result : frame.error)
        break
      case 'pong':
        this.lastActive = conn
        break
      case 'hello':
      case 'hello.ok':
      case 'rpc.result':
      case 'respond.result':
      case 'event':
      case 'tool.call':
      case 'tool.cancel':
      case 'ping':
      case 'error':
        // Protocol violations and unsolicited server-side shapes are ignored;
        // the extension is the only sender on this channel.
        break
    }
  }

  /**
   * Preserve prompt/cancel arrival order per session. In particular, the
   * first prompt may still be materializing a provisional session; its cancel
   * must not reach the gateway until that admission has completed.
   */
  private routeRpc(conn: ReadyConnection, frame: Extract<ClientFrame, { t: 'rpc' }>): void {
    const sessionId = orderedSessionId(frame)
    if (sessionId === undefined) {
      void this.handleRpc(conn, frame)
      return
    }
    const previous = this.orderedSessionRpcs.get(sessionId) ?? Promise.resolve()
    const task = previous.then(
      () => this.handleRpc(conn, frame),
      () => this.handleRpc(conn, frame),
    )
    this.orderedSessionRpcs.set(sessionId, task)
    const clear = (): void => {
      if (this.orderedSessionRpcs.get(sessionId) === task) this.orderedSessionRpcs.delete(sessionId)
    }
    void task.then(clear, clear)
  }

  private async handleRpc(conn: ReadyConnection, frame: Extract<ClientFrame, { t: 'rpc' }>): Promise<void> {
    const forbidden = PRIVILEGED_METHODS.has(frame.method) && !isLoopbackAddress(conn.remoteAddress)
    if (forbidden) {
      sendFrame(conn.ws, { t: 'rpc.result', id: frame.id, ok: false, error: { code: 'forbidden', message: 'method is loopback-only' } })
      return
    }
    if (frame.method === BRIDGE_INJECT_BROWSER_SNAPSHOT_METHOD) {
      const payload = browserSnapshotPayload(frame.payload)
      if (payload === undefined) {
        sendFrame(conn.ws, {
          t: 'rpc.result',
          id: frame.id,
          ok: false,
          error: { code: 'bad-request', message: 'sessionId and snapshot must be non-empty strings' },
        })
        return
      }
      try {
        await this.deps.injectBrowserSnapshot(payload.sessionId, payload.snapshot)
        sendFrame(conn.ws, { t: 'rpc.result', id: frame.id, ok: true, result: { accepted: true } })
      } catch (error: unknown) {
        sendFrame(conn.ws, {
          t: 'rpc.result',
          id: frame.id,
          ok: false,
          error: { code: 'internal', message: String(error) },
        })
      }
      return
    }
    if (frame.method === BRIDGE_SESSION_PURGE_METHOD) {
      const sessionId = purgeSessionPayload(frame.payload)
      if (sessionId === undefined) {
        sendFrame(conn.ws, {
          t: 'rpc.result',
          id: frame.id,
          ok: false,
          error: { code: 'bad-request', message: 'sessionId must be a non-empty string' },
        })
        return
      }
      try {
        await this.deps.purgeSession(sessionId)
        sendFrame(conn.ws, { t: 'rpc.result', id: frame.id, ok: true, result: { purged: true } })
      } catch (error: unknown) {
        const code = error instanceof SessionPurgeError ? error.code : 'internal'
        const message = error instanceof Error ? error.message : String(error)
        sendFrame(conn.ws, { t: 'rpc.result', id: frame.id, ok: false, error: { code, message } })
      }
      return
    }
    try {
      const result = await this.deps.api.call({
        rpcId: frame.id,
        method: frame.method,
        payload: frame.payload,
        signal: conn.abort.signal,
      })
      sendFrame(conn.ws, {
        t: 'rpc.result',
        id: frame.id,
        ok: true,
        result: { type: 'server-response', rpcId: frame.id, result },
      })
    } catch (error: unknown) {
      sendFrame(conn.ws, { t: 'rpc.result', id: frame.id, ok: false, error: { code: 'internal', message: String(error) } })
    }
  }

  /** Relay a pending Host waterfall response through the connection that raised it. */
  private async handleRespond(conn: ReadyConnection, frame: Extract<ClientFrame, { t: 'respond' }>): Promise<void> {
    try {
      const result = await this.deps.api.respond(frame.rpcId, frame.result, conn.abort.signal)
      sendFrame(conn.ws, { t: 'respond.result', id: frame.id, ok: true, result })
    } catch (error: unknown) {
      sendFrame(conn.ws, { t: 'respond.result', id: frame.id, ok: false, error: { code: 'internal', message: String(error) } })
    }
  }

  private settleTool(conn: ReadyConnection, id: string, ok: boolean, payload: unknown): void {
    const pending = this.pendingTools.get(id)
    if (pending === undefined) return
    clearTimeout(pending.timer)
    this.pendingTools.delete(id)
    // The browser that answered the last call is where the model is working,
    // so untargeted calls keep following it.
    if (this.connections.get(conn.id) === conn) this.lastActive = conn
    if (ok) pending.resolve(payload)
    else pending.reject(new BridgeToolError(payloadCode(payload), payloadMessage(payload)))
  }
}

function browserSnapshotPayload(payload: unknown): { sessionId: string; snapshot: string } | undefined {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined
  const { sessionId, snapshot } = payload as Record<string, unknown>
  if (typeof sessionId !== 'string' || sessionId.trim() === '') return undefined
  if (typeof snapshot !== 'string' || snapshot.trim() === '') return undefined
  return { sessionId, snapshot }
}

function purgeSessionPayload(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined
  const { sessionId } = payload as Record<string, unknown>
  if (typeof sessionId !== 'string' || sessionId.trim() === '') return undefined
  return sessionId
}

function orderedSessionId(frame: Extract<ClientFrame, { t: 'rpc' }>): string | undefined {
  if (!ORDERED_SESSION_METHODS.has(frame.method)) return undefined
  if (typeof frame.payload !== 'object' || frame.payload === null || Array.isArray(frame.payload)) return undefined
  const sessionId = (frame.payload as Record<string, unknown>).sessionId
  return typeof sessionId === 'string' ? sessionId : undefined
}

/**
 * Tool error payload → stable code. The wire parser enforces string fields,
 * so the fallback branches are parser-gated; exported so the fallback
 * contract is unit-testable directly.
 * @param payload - extension-reported error payload.
 * @returns the stable error code.
 */
export function payloadCode(payload: unknown): ToolErrorCode {
  if (typeof payload === 'object' && payload !== null) {
    const code = (payload as { code?: unknown }).code
    if (typeof code === 'string') return code as ToolErrorCode
    return 'internal'
  }
  return 'internal'
}

/**
 * Tool error payload → message. The wire parser enforces string fields, so
 * the fallback branches are parser-gated; exported so the fallback contract
 * is unit-testable directly.
 * @param payload - extension-reported error payload.
 * @returns the human-readable message.
 */
export function payloadMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const message = (payload as { message?: unknown }).message
    if (typeof message === 'string' && message.length > 0) return message
    return 'browser action failed'
  }
  return 'browser action failed'
}
