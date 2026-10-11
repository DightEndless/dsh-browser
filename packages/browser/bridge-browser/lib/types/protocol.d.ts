/**
 * Wire contract between the dsh bridge plugin and the browser extension.
 *
 * Zero-dependency module (pure types, constants, and a parser): both the
 * plugin (node) and the Chrome extension (browser bundle) import this file, so
 * the frame shapes can never drift between the two halves.
 *
 * Frames are one JSON object per WebSocket message, discriminated by `t`.
 * Correlation ids (`id`) are minted by the requestor and echoed by the
 * responder; they are opaque strings, never parsed.
 *
 * @module
 */
/** WebSocket pathname the bridge plugin registers on the host webserver. */
export declare const BRIDGE_PATH = "/ext/bridge";
/** Zero-config discovery endpoint: returns `{ wsUrl }` for the extension. */
export declare const BRIDGE_CONFIG_PATH = "/ext/bridge-config";
/** Internal RPC used after an explicit tab handoff to seed the Agent's next step. */
export declare const BRIDGE_INJECT_BROWSER_SNAPSHOT_METHOD = "bridge.injectBrowserSnapshot";
/** Internal RPC used by the panel to permanently delete one session's durable storage. */
export declare const BRIDGE_SESSION_PURGE_METHOD = "bridge.session.purge";
/** Seconds a fresh socket may take to present `hello` before it is closed. */
export declare const HELLO_TIMEOUT_MS = 5000;
/** Server-side ping cadence; the client answers `pong` to prove liveness. */
export declare const PING_INTERVAL_MS = 30000;
/** Default bytes of the generated bearer token (256-bit). */
export declare const DEFAULT_TOKEN_BYTES = 32;
/** Default rendered-snapshot character budget. */
export declare const DEFAULT_SNAPSHOT_MAX_CHARS = 32000;
/** Smallest snapshot budget that can carry both trust boundaries and page text. */
export declare const MIN_SNAPSHOT_MAX_CHARS = 500;
/** Error codes a tool call may settle with. Open set: consumers must tolerate unknown codes. */
export type ToolErrorCode = 'no-active-tab' | 'content-unavailable' | 'action-failed' | 'timeout' | 'bridge-closed' | 'bad-args' | 'internal';
/** One tool-call failure: stable machine code plus human text for the model. */
export interface ToolError {
    code: ToolErrorCode;
    message: string;
}
/** Result sent for a pending host interaction such as ask_user_question. */
export type RespondResult = {
    ok: true;
    value?: unknown;
} | {
    ok: false;
    error: {
        code: string;
        message: string;
        details: Record<string, unknown>;
    };
};
/**
 * Stable lowercase handle for one connected browser profile. The bridge mints
 * it from the extension's self-reported identity and guarantees uniqueness
 * across live connections by appending a numeric suffix.
 */
export type BridgeBrowserId = string;
/** Browser identity an extension reports in its `hello` frame. */
export interface BridgeBrowserInfo {
    /** Vendor family, e.g. `chrome` or `edge`. */
    kind: string;
    /** Human-facing label for tool output, e.g. `Edge`. */
    label: string;
    /** Browser version when the extension can read it. */
    version?: string;
    /**
     * Per-install random id persisted by the extension. It is the real identity
     * boundary: two Chromium-based browsers can report the same `kind` (a
     * customized user agent hides Edge), and a same-install reconnect keeps the
     * id so it replaces its own stale slot instead of adding a second one.
     */
    instanceId?: string;
}
/** One live extension connection as reported to the model. */
export interface BridgeBrowserEntry {
    /** Stable id used to target this browser in later calls. */
    id: BridgeBrowserId;
    /** Vendor family reported by the extension. */
    kind: string;
    /** Human-facing label. */
    label: string;
    /** Browser version when reported. */
    version?: string;
    /** Whether tools currently default to this browser. */
    isDefault: boolean;
}
/** Capabilities negotiated in `hello`/`hello.ok`. The extension performs its own actions; these bounds shape page snapshots. */
export interface BridgeCaps {
    /** The extension renders page state as text only (no screenshots). */
    textOnly: true;
    /** Upper bound on one rendered snapshot's characters (plugin config, minimum 500). */
    snapshotMaxChars: number;
    /** Upper bound on interactive inventory items per snapshot (plugin config). */
    maxInteractiveItems: number;
}
/** Frames sent by the extension to the bridge plugin. */
export type ClientFrame = 
/**
 * First frame, within HELLO_TIMEOUT_MS of socket open. `browser` is optional
 * so extensions built before multi-browser support still authenticate; the
 * bridge then falls back to a derived identity.
 */
{
    t: 'hello';
    token: string;
    caps: BridgeCaps;
    browser?: BridgeBrowserInfo;
}
/** Unary call projected by the active dsh Host adapter. */
 | {
    t: 'rpc';
    id: string;
    method: string;
    payload: unknown;
}
/** Answer or cancel a pending Host interaction waterfall. */
 | {
    t: 'respond';
    id: string;
    rpcId: string;
    result: RespondResult;
}
/** Result of a previously dispatched tool call. */
 | {
    t: 'tool.result';
    id: string;
    ok: true;
    result: unknown;
} | {
    t: 'tool.result';
    id: string;
    ok: false;
    error: ToolError;
}
/** Liveness reply. */
 | {
    t: 'pong';
};
/** Frames sent by the bridge plugin to the extension. */
export type ServerFrame = 
/** Accepted after a valid `hello`. */
{
    t: 'hello.ok';
    caps: BridgeCaps;
}
/** Reply to an `rpc` frame; `result` is the bridge's stable ServerResponse envelope. */
 | {
    t: 'rpc.result';
    id: string;
    ok: true;
    result: unknown;
} | {
    t: 'rpc.result';
    id: string;
    ok: false;
    error: {
        code: string;
        message: string;
    };
}
/** Receipt for a `respond` frame (normally `{ accepted: boolean }`). */
 | {
    t: 'respond.result';
    id: string;
    ok: true;
    result: unknown;
} | {
    t: 'respond.result';
    id: string;
    ok: false;
    error: {
        code: string;
        message: string;
    };
}
/** One bridge-owned event envelope projected from Remote streams and waterfalls. */
 | {
    t: 'event';
    frame: {
        rpcId: string;
        method: string;
        payload: unknown;
    };
}
/** A model-requested browser action to execute in the user-controlled tab. */
 | {
    t: 'tool.call';
    id: string;
    name: string;
    args: Record<string, unknown>;
    expiresAt: number;
    sessionId?: string;
}
/** Withdraw a tool call that timed out or whose caller was cancelled. */
 | {
    t: 'tool.cancel';
    id: string;
}
/** Liveness probe. */
 | {
    t: 'ping';
}
/** Fatal connection error; the client should re-authenticate. */
 | {
    t: 'error';
    code: string;
    message: string;
};
/** Any frame on the wire. */
export type BridgeFrame = ClientFrame | ServerFrame;
/**
 * Type guard: is this frame one the SERVER may send? Client-only shapes
 * (hello/tool.result/pong) narrow out, so server-side consumers never
 * dispatch on their own request vocabulary.
 * @param frame - parsed frame.
 * @returns true for server-sendable frames.
 */
export declare function isServerFrame(frame: BridgeFrame): frame is ServerFrame;
/**
 * Type guard: is this frame one the CLIENT may send? Server-only shapes
 * narrow out, so client-side consumers never dispatch on server vocabulary.
 * @param frame - parsed frame.
 * @returns true for client-sendable frames.
 */
export declare function isClientFrame(frame: BridgeFrame): frame is ClientFrame;
/**
 * Parse one WebSocket message into a frame.
 * @param text - raw message text.
 * @returns the frame, or `undefined` when the message is not a valid frame.
 */
export declare function parseBridgeFrame(text: string): BridgeFrame | undefined;
export declare function isRespondResult(value: unknown): value is RespondResult;
//# sourceMappingURL=protocol.d.ts.map