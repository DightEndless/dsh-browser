/**
 * Companion content script that runs in the page's own ("main") world.
 *
 * Chrome drops a `javascript:` navigation started from the isolated world a
 * content script lives in: the element's click handlers still run, but the
 * script inside the URL never does. Sites that put their whole action in such a
 * URL — WebVPN-rewritten pages, classic ASP.NET postbacks
 * (`__doPostBack`), and similar — therefore look unclickable to a bridge that
 * only dispatches events from the isolated world.
 *
 * The isolated-world half of the bridge marks the intended element and posts a
 * message; this half, running where the page's own scripts run, clicks it for
 * real. It also announces itself through a DOM marker so the isolated world can
 * tell whether the handover is available in this frame.
 */

const READY_ATTR = 'data-dsh-main-world-ready'
const CLICK_CHANNEL = 'dsh:main-world-click'
const CLICK_ATTR = 'data-dsh-main-world-click'
const ACK_CHANNEL = 'dsh:main-world-click-ack'

function markReady(): void {
  document.documentElement?.setAttribute(READY_ATTR, '1')
}

markReady()
document.addEventListener('DOMContentLoaded', markReady, { once: true })

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  const data = event.data as { channel?: unknown; token?: unknown } | null
  if (data === null || typeof data !== 'object') return
  if (data.channel !== CLICK_CHANNEL || typeof data.token !== 'string') return
  const el = document.querySelector(`[${CLICK_ATTR}="${data.token}"]`)
  if (el instanceof HTMLElement) {
    el.removeAttribute(CLICK_ATTR)
    el.click()
  }
  window.postMessage({ channel: ACK_CHANNEL, token: data.token }, '*')
})
