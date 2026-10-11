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
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { BrowserHostApi } from './host-api.ts';
import { type BridgeBrowserEntry, type BridgeBrowserId, type BridgeCaps, type ToolErrorCode } from './protocol.ts';
/** Loopback IPv4/IPv6 literals (IPv4-mapped included). Exported for tests and reuse. */
export declare function isLoopbackAddress(address: string | undefined): boolean;
/** Error thrown by requestTool; the tool registry turns it into an isError result. */
export declare class BridgeToolError extends Error {
    readonly code: ToolErrorCode;
    constructor(code: ToolErrorCode, message: string);
}
/** Dependencies the bridge needs from the host. */
export interface BridgeServerDeps {
    /** Bearer token the extension must present in `hello`. */
    token: string;
    /** Active dsh Host adapter used for unary calls, events, and waterfalls. */
    api: BrowserHostApi;
    /** Default per-tool-call timeout in ms. */
    toolTimeoutMs: number;
    /** Capabilities to echo in `hello.ok` (negotiated snapshot budgets). */
    caps: BridgeCaps;
    /** Seed a followed-page snapshot into a live or deferred Agent session. */
    injectBrowserSnapshot: (sessionId: string, snapshot: string) => void | Promise<void>;
    /**
     * Permanently delete one session's durable storage. Callers archive the
     * session through the gateway first; this only removes files.
     */
    purgeSession: (sessionId: string) => Promise<void>;
    /**
     * Test seam: force the remote address seen by the privilege gate. The
     * sandbox cannot bind arbitrary loopback literals, so the non-loopback
     * branch is exercised through this override; production never sets it.
     */
    remoteAddressOverride?: string;
    /** Seconds a fresh socket may present `hello`; defaults to HELLO_TIMEOUT_MS. */
    helloTimeoutMs?: number;
    /** Server ping cadence; defaults to PING_INTERVAL_MS. */
    pingIntervalMs?: number;
}
/** Options for one model-facing browser action. */
export interface RequestToolOptions {
    /** Explicit target browser id; omit to use the default browser. */
    browserId?: BridgeBrowserId;
    /** Owning Agent session, forwarded for approval continuity. */
    sessionId?: string;
    /** Per-call budget in ms; defaults to the plugin config value. */
    timeoutMs?: number;
}
/**
 * Decode one ws message payload to text. Exported so all three delivery
 * shapes (fragmented buffer list, Buffer, ArrayBuffer) are unit-testable
 * directly — node ws only ever delivers Buffers in practice.
 * @param data - ws message payload.
 * @returns the decoded UTF-8 text.
 */
export declare function messageToText(data: Buffer | ArrayBuffer | Buffer[]): string;
/**
 * Token-authenticated bridge server. Construct once per plugin instance;
 * dispose with {@link close}.
 */
export declare class BridgeServer {
    private readonly deps;
    private readonly wss;
    /** Every authenticated connection, keyed by its stable browser id. */
    private readonly connections;
    /** Browser that receives calls when the caller names none. */
    private defaultBrowserId;
    /** Most recent connection to receive a routed call (fallback default). */
    private lastActive;
    private readonly pendingTools;
    private readonly orderedSessionRpcs;
    private closed;
    constructor(deps: BridgeServerDeps);
    /**
     * Handle one HTTP upgrade for the bridge path.
     * @param req - upgrade request (carries the client's remote address).
     * @param socket - raw socket transferred by the HTTP server.
     * @param head - bytes already read after the upgrade headers.
     */
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
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
    requestTool(name: string, args: Record<string, unknown>, signal: AbortSignal, optionsOrTimeoutMs?: number | RequestToolOptions, legacySessionId?: string): Promise<unknown>;
    /**
     * Resolve which connection owns a tool call.
     * @param browserId - explicit target browser, when the caller named one.
     * @returns the targeted connection.
     * @throws BridgeToolError when nothing is connected or the target is unknown.
     */
    private resolveConnection;
    /** Comma-separated browser ids for diagnostics. */
    private describeConnections;
    /**
     * List every connected browser, marking the current call target.
     * @param browserId - browser the caller already targeted, when any.
     * @returns one entry per live connection.
     */
    listBrowsers(browserId?: BridgeBrowserId): BridgeBrowserEntry[];
    /**
     * Set the browser that later untargeted calls use.
     * @param browserId - id from {@link listBrowsers}.
     * @returns whether the id matched a live connection.
     */
    setDefaultBrowser(browserId: BridgeBrowserId): boolean;
    /** @returns the browser untargeted calls currently use, when one is selected. */
    getDefaultBrowserId(): BridgeBrowserId | undefined;
    /**
     * Terminate the server: close the acceptor, drop all sockets, reject all
     * in-flight tool calls.
     * @returns a promise resolving after the acceptor and all pumps stop.
     */
    close(): Promise<void>;
    /** @returns whether at least one authenticated extension is connected. */
    hasConnection(): boolean;
    /** Reject every in-flight tool call with the same error. */
    private settleAllPending;
    private attach;
    /** Promote an authenticated socket into its own browser slot. */
    private registerConnection;
    /** Pick a unique browser id for one connection. */
    private mintBrowserId;
    /** Remove one connection from the registry, settling whatever it owned. */
    private dropConnection;
    /** Look up the registry entry that owns one socket. */
    private findBySocket;
    private handleReadyFrame;
    /**
     * Preserve prompt/cancel arrival order per session. In particular, the
     * first prompt may still be materializing a provisional session; its cancel
     * must not reach the gateway until that admission has completed.
     */
    private routeRpc;
    private handleRpc;
    /** Relay a pending Host waterfall response through the connection that raised it. */
    private handleRespond;
    private settleTool;
}
/**
 * Tool error payload → stable code. The wire parser enforces string fields,
 * so the fallback branches are parser-gated; exported so the fallback
 * contract is unit-testable directly.
 * @param payload - extension-reported error payload.
 * @returns the stable error code.
 */
export declare function payloadCode(payload: unknown): ToolErrorCode;
/**
 * Tool error payload → message. The wire parser enforces string fields, so
 * the fallback branches are parser-gated; exported so the fallback contract
 * is unit-testable directly.
 * @param payload - extension-reported error payload.
 * @returns the human-readable message.
 */
export declare function payloadMessage(payload: unknown): string;
//# sourceMappingURL=server.d.ts.map