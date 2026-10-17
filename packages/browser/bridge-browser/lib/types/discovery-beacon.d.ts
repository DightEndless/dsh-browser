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
/**
 * Loopback ports the extension probes for discovery, in order.
 *
 * Deliberately small and in the registered range (1024-49151): 3 candidates mean
 * at most three immediate connection attempts, never a range scan.
 */
export declare const DISCOVERY_BEACON_PORTS: readonly [30789, 30790, 30791];
export interface DiscoveryBeaconOptions {
    /** Live bridge WebSocket URL, recomputed per request so a port change is picked up. */
    readonly wsUrl: () => string;
    /** Extra fields merged into the JSON body (extension status, etc.). */
    readonly details?: () => Record<string, unknown>;
    /** Diagnostics sink; failures are non-fatal. */
    readonly logger?: {
        info?: (message: string) => void;
        warn?: (message: string) => void;
    };
}
export interface DiscoveryBeacon {
    /** Port actually bound, or undefined when every candidate was taken. */
    readonly port: number | undefined;
    /** Close the listener and release the port. */
    close(): Promise<void>;
}
/**
 * Start the discovery beacon on the first free candidate port.
 *
 * Resolves with the bridge absent when every candidate is taken; the extension
 * then falls back to its own discovery, so this never blocks bridge operation.
 */
export declare function startDiscoveryBeacon(options: DiscoveryBeaconOptions): Promise<DiscoveryBeacon>;
//# sourceMappingURL=discovery-beacon.d.ts.map