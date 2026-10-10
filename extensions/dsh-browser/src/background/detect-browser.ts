/**
 * Browser identity for this extension install.
 *
 * The bridge keeps one slot per browser install so Chrome and Edge can stay
 * connected at the same time. The vendor user agent is a hint, not a boundary:
 * Edge can be configured to present a Chrome user agent. The real identity is
 * the extension's own id, which is stable for an install and distinct between
 * installs with different manifest keys (the Edge build gets its own key).
 *
 * @module
 */

import type { BridgeBrowserInfo } from '@dightendless/dsh-bridge-browser/src/protocol.ts'

/** Whether this install runs inside Microsoft Edge. */
export const IS_EDGE: boolean = /edg\//i.test(globalThis.navigator?.userAgent ?? '')

/**
 * Edge is the dedicated automation browser in this setup, so its install is
 * unrestricted by default. Chrome stays approval-gated because it is the
 * user's own browsing profile.
 */
export const DEFAULT_UNRESTRICTED_BROWSER_ACCESS: boolean = IS_EDGE

/** Extension id when the runtime exposes one (tests and non-extension contexts do not). */
function extensionId(): string | undefined {
  try {
    return typeof chrome.runtime?.id === 'string' && chrome.runtime.id !== '' ? chrome.runtime.id : undefined
  } catch {
    return undefined
  }
}

/**
 * Identity reported to the bridge in the `hello` frame.
 *
 * Synchronous on purpose: the bridge start path must not wait on storage. The
 * `instanceId` is derived from the extension id, so it survives service-worker
 * restarts without a persistence round trip and still separates two installs.
 *
 * @returns identity ready for the `hello` frame.
 */
export function getBrowserIdentity(): BridgeBrowserInfo {
  const userAgent = globalThis.navigator?.userAgent ?? ''
  const kind = IS_EDGE ? 'edge' : /firefox\//i.test(userAgent) ? 'firefox' : 'chrome'
  const label = IS_EDGE ? 'Edge' : kind === 'firefox' ? 'Firefox' : 'Chrome'
  let version: string | undefined
  try {
    version = chrome.runtime.getManifest().version
  } catch {
    // A test or non-extension context has no manifest; the version is optional.
  }
  const id = extensionId()
  return {
    kind,
    label,
    ...(version === undefined ? {} : { version }),
    ...(id === undefined ? {} : { instanceId: `${kind}-${id}` }),
  }
}
