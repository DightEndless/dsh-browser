/**
 * Page actions: click/type/press/scroll/navigate/get_text/wait, executed in
 * the content script against the real page (preserving login state), each
 * returning a short text status. Navigations return a fresh full snapshot
 * because the document — and the id registry — reset.
 *
 * All browser action results use structured text, so a
 * status line tells the model what happened and what state remains.
 *
 * @module
 */

import { pageText, truncate } from './extract.ts'
import { collectPageImages, normalizeImageLimit, renderImageScan } from './images.ts'
import type { ElementIds } from './ids.ts'
import type { SnapshotBudget } from './snapshot.ts'
import { buildSnapshot, renderSnapshot } from './snapshot.ts'

/** A settled action result. */
export interface ActionResult {
  text: string
  /** Page-authored snapshot delta; the background must wrap it as untrusted. */
  pageContent?: string
  /** A same-frame document navigation was scheduled after this response. */
  navigationPending?: boolean
}

/** How long an action should observe a ready document before returning. */
export interface PageSettlePolicy {
  /** Earliest return after the document becomes ready. */
  minimumMs: number
  /** Required DOM-quiet period before returning. */
  quietMs: number
  /** Hard cap after readiness; continuously animated pages cannot stall tools. */
  maxAfterReadyMs: number
  /** Hard cap while waiting for document readiness. */
  timeoutMs: number
}

const TYPE_SETTLE: PageSettlePolicy = { minimumMs: 32, quietMs: 32, maxAfterReadyMs: 100, timeoutMs: 5_000 }
const ACTION_SETTLE: PageSettlePolicy = { minimumMs: 100, quietMs: 50, maxAfterReadyMs: 250, timeoutMs: 5_000 }
const SCROLL_SETTLE: PageSettlePolicy = { minimumMs: 50, quietMs: 50, maxAfterReadyMs: 150, timeoutMs: 5_000 }
const EXPLICIT_WAIT_SETTLE: PageSettlePolicy = { minimumMs: 100, quietMs: 100, maxAfterReadyMs: 1_000, timeoutMs: 5_000 }
/** Keep automatic action context focused while preserving the negotiated full snapshot budget. */
const ACTION_DELTA_MAX_CHARS = 4_000

/**
 * Wait for document readiness and a mutation-free window. The old fixed delay
 * charged every action equally and still returned too early when a late DOM
 * update landed near its boundary. This observer returns early on already
 * stable pages, extends only for real mutations, and stays bounded on pages
 * with continuous animation.
 */
export function waitForPageSettled(policy: PageSettlePolicy = ACTION_SETTLE): Promise<boolean> {
  const startedAt = performance.now()
  let readyAt = document.readyState === 'complete' ? startedAt : undefined
  let lastMutationAt = startedAt
  let timer: ReturnType<typeof setTimeout> | undefined
  let finished = false
  let observer: MutationObserver | undefined

  return new Promise((resolve) => {
    const finish = (settled: boolean): void => {
      if (finished) return
      finished = true
      if (timer !== undefined) clearTimeout(timer)
      observer?.disconnect()
      document.removeEventListener('readystatechange', schedule)
      window.removeEventListener('load', schedule)
      resolve(settled)
    }
    const check = (): void => {
      timer = undefined
      const now = performance.now()
      if (readyAt === undefined && document.readyState === 'complete') {
        readyAt = now
        lastMutationAt = now
      }
      if (readyAt !== undefined) {
        const afterReady = now - readyAt
        const quietFor = now - lastMutationAt
        if ((afterReady >= policy.minimumMs && quietFor >= policy.quietMs)
          || afterReady >= policy.maxAfterReadyMs) {
          finish(true)
          return
        }
        const untilMinimum = Math.max(0, policy.minimumMs - afterReady)
        const untilQuiet = Math.max(0, policy.quietMs - quietFor)
        timer = setTimeout(check, Math.max(1, Math.min(policy.maxAfterReadyMs - afterReady, Math.max(untilMinimum, untilQuiet))))
        return
      }
      const elapsed = now - startedAt
      if (elapsed >= policy.timeoutMs) {
        finish(false)
        return
      }
      timer = setTimeout(check, Math.max(1, Math.min(100, policy.timeoutMs - elapsed)))
    }
    function schedule(): void {
      if (finished) return
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(check, 0)
    }

    if (document.documentElement !== null) {
      observer = new MutationObserver(() => {
        lastMutationAt = performance.now()
        schedule()
      })
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      })
    }
    document.addEventListener('readystatechange', schedule)
    window.addEventListener('load', schedule)
    schedule()
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

function elementOrThrow(ids: ElementIds, index: number): Element {
  const el = ids.elementByIndex(index)
  if (el === undefined) {
    throw new ActionError('action-failed', `Element [${index}] does not exist; the page may have changed. Call browser_snapshot again to get current indices.`)
  }
  return el
}

/** Error carrying a stable wire code. */
export class ActionError extends Error {
  constructor(
    readonly code: 'action-failed' | 'bad-args',
    message: string,
  ) {
    super(message)
    this.name = 'ActionError'
  }
}

/** React-compatible value write: native setter + input/change events. */
function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  if (setter === undefined) {
    input.value = value
  } else {
    setter.call(input, value)
  }
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Action implementations; each returns a text result. */
export interface ActionContext {
  ids: ElementIds
  budget: SnapshotBudget
  /** Enabled only when the background may share page content without another approval. */
  includePageDelta?: boolean
}

/** Run one named action with its args. */
export async function runAction(action: string, args: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  switch (action) {
    case 'browser_snapshot':
      return snapshotAction(args, ctx)
    case 'browser_click':
      return clickAction(args, ctx)
    case 'browser_type':
      return typeAction(args, ctx)
    case 'browser_press':
      return pressAction(args, ctx)
    case 'browser_scroll':
      return scrollAction(args, ctx)
    case 'browser_navigate':
      return navigateAction(args)
    case 'browser_back':
      return historyAction(-1)
    case 'browser_forward':
      return historyAction(1)
    case 'browser_reload':
      return reloadAction()
    case 'browser_get_text':
      return getTextAction(args)
    case 'browser_images':
      return imagesAction(args)
    case 'browser_wait':
      return waitAction(args, ctx)
    default:
      throw new ActionError('bad-args', `Unknown action: ${action}`)
  }
}

function snapshotAction(args: Record<string, unknown>, ctx: ActionContext): ActionResult {
  const delta = args.delta === true
  const region = typeof args.region === 'string' && args.region !== '' ? args.region : undefined
  // 基线在每次快照后都更新：delta 调用才能相对上一次（无论是否 delta）比较。
  const view = buildSnapshot(ctx.ids, { delta, region, budget: ctx.budget }, lastSnapshot)
  lastSnapshot = view
  return { text: renderSnapshot(view, delta) }
}

/** Module-level last snapshot state for delta mode (content-script lifetime). */
let lastSnapshot: ReturnType<typeof buildSnapshot> | null = null

/** Invalidate delta state after navigation (new document). */
function resetDeltaState(): void {
  lastSnapshot = null
}

/** Attach the settled page change while retaining the full view as the next delta baseline. */
function withPageDelta(text: string, ctx: ActionContext): ActionResult {
  if (ctx.includePageDelta !== true || lastSnapshot === null) return { text }
  const view = buildSnapshot(ctx.ids, { delta: true, budget: ctx.budget }, lastSnapshot)
  lastSnapshot = view
  return {
    text,
    pageContent: renderSnapshot(view, true, Math.min(ctx.budget.maxChars, ACTION_DELTA_MAX_CHARS)),
  }
}

/** DOM marker the main-world companion script sets once it is live. */
const MAIN_WORLD_READY_ATTR = 'data-dsh-main-world-ready'
/** Marker that hands one element over to the main-world companion script. */
const MAIN_WORLD_CLICK_ATTR = 'data-dsh-main-world-click'
/** Channel the main-world companion script listens on. */
const MAIN_WORLD_CLICK_CHANNEL = 'dsh:main-world-click'

/** Whether this frame has the main-world companion script available. */
function mainWorldClickReady(): boolean {
  return document.documentElement?.hasAttribute(MAIN_WORLD_READY_ATTR) === true
}

/**
 * Activate one element from the page's own world.
 *
 * A `javascript:` URL runs only when the navigation starts in the world that
 * owns it. Activations dispatched from this content script's isolated world
 * fire the element's handlers but are dropped before the URL's script runs —
 * which is exactly where WebVPN-rewritten links and ASP.NET postbacks keep
 * their action. The companion script in the main world performs the click, and
 * removes the marker itself; the timeout only sweeps up if it never arrives.
 */
function clickFromMainWorld(el: HTMLElement): void {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
  el.setAttribute(MAIN_WORLD_CLICK_ATTR, token)
  window.postMessage({ channel: MAIN_WORLD_CLICK_CHANNEL, token }, '*')
  setTimeout(() => { el.removeAttribute(MAIN_WORLD_CLICK_ATTR) }, 2000)
}

async function clickAction(args: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  const index = numberArg(args, 'index')
  const el = elementOrThrow(ctx.ids, index)
  el.scrollIntoView({ block: 'center', behavior: 'instant' })
  if (el instanceof HTMLAnchorElement) {
    const rawHref = el.getAttribute('href')?.trim().toLowerCase() ?? ''
    if (rawHref.startsWith('javascript:') && mainWorldClickReady()) {
      clickFromMainWorld(el)
      // Answer before the activation can start a navigation. Awaiting a settle
      // here lets the frame's context disappear with the response still in
      // flight, which the caller reports as a timeout even though the click
      // landed. The activation is queued, so it still happens after this reply.
      return {
        text: `Clicked link [${index}] in the page's main world. Call browser_snapshot again after the page settles.`,
      }
    }
    const target = el.target.trim().toLowerCase()
    const sameFrameTarget = target === '' || target === '_self'
    let href: URL | undefined
    try { href = new URL(el.href) } catch { /* let the native click handle unusual links */ }
    const controlledNavigation = sameFrameTarget
      && !el.hasAttribute('download')
      && (href?.protocol === 'http:' || href?.protocol === 'https:')
    if (controlledNavigation && href !== undefined) {
      // Manual location assignment cannot preserve browser-managed link
      // semantics such as referrer suppression, hyperlink auditing, or
      // attribution registration. Keep native activation for those links,
      // but do not claim a replacement document is guaranteed: an SPA may
      // still cancel the click and remain in this document.
      const hasReferrerPolicy = typeof el.referrerPolicy === 'string' && el.referrerPolicy !== ''
      const requiresNativeActivation = el.relList.contains('noreferrer')
        || hasReferrerPolicy
        || el.hasAttribute('ping')
        || el.hasAttribute('attributionsrc')
      if (requiresNativeActivation) {
        setTimeout(() => { el.click() }, 0)
        return {
          text: `Clicked link [${index}] using native browser activation. Call browser_snapshot to read the resulting state.`,
        }
      }
      // Dispatch the click handlers without its default navigation so a
      // client-side router can cancel synchronously and keep this document.
      const shouldNavigate = el.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
      }))
      if (!shouldNavigate) {
        await waitForPageSettled(ACTION_SETTLE)
        return withPageDelta(`Clicked link [${index}].`, ctx)
      }
      const sameDocument = href.origin === location.origin
        && href.pathname === location.pathname
        && href.search === location.search
      if (sameDocument) {
        if (href.hash !== location.hash) location.hash = href.hash
        await waitForPageSettled(ACTION_SETTLE)
        return withPageDelta(`Clicked link [${index}].`, ctx)
      }
      // A cross-document navigation can unload this content script before an
      // awaited response. Answer first and navigate in the next task.
      setTimeout(() => { location.href = href.href }, 0)
      return {
        text: `Clicked link [${index}]. Call browser_snapshot again after navigation settles.`,
        navigationPending: true,
      }
    }
    setTimeout(() => { el.click() }, 0)
    return { text: `Clicked link [${index}]. The link may open outside the controlled frame.` }
  }
  if (el instanceof HTMLButtonElement && el.disabled) {
    throw new ActionError('action-failed', `Button [${index}] is disabled.`)
  }
  ;(el as HTMLElement).click()
  await waitForPageSettled(ACTION_SETTLE)
  return withPageDelta(`Clicked [${index}].`, ctx)
}

/**
 * The nearest editable host, or null when a `contenteditable="false"` island
 * blocks editing.
 *
 * The walk must stop at the nearest `[contenteditable]` boundary instead of
 * skipping disabled ones: an element inside a non-editable island nested in an
 * editable composer belongs to the island, and resolving past it would type
 * into the surrounding composer rather than refusing the target.
 *
 * @param el - element addressed by the action.
 * @returns the owning editable host, or null when editing is blocked.
 */
function editingHost(el: HTMLElement): HTMLElement | null {
  const boundary = el.closest('[contenteditable]')
  if (!(boundary instanceof HTMLElement)) return null
  return boundary.getAttribute('contenteditable') === 'false' ? null : boundary
}

/**
 * Whether the element can receive rich-text input.
 *
 * `isContentEditable` is the browser's own answer; the boundary walk covers the
 * attribute case, which is unimplemented in jsdom, where these tests run.
 *
 * @param el - element addressed by the action.
 * @returns true when the element can receive rich-text input.
 */
function isEditable(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && (el.isContentEditable || editingHost(el) !== null)
}

/**
 * Insert text into a rich-text host through the browser's editing pipeline.
 *
 * Editors such as Lexical, Draft.js and ProseMirror keep their own document
 * model and reconcile away foreign DOM writes, so assigning `textContent`
 * silently reverts and the caller's success report becomes a lie.
 * `execCommand('insertText')` is deprecated but remains the only path that
 * produces the `beforeinput`/`input` sequence those editors listen for. Hosts
 * without it keep the direct-write fallback.
 *
 * @param el - element addressed by the action.
 * @param text - text to insert.
 * @param replace - whether to replace the host's current contents.
 */
function typeIntoContentEditable(el: HTMLElement, text: string, replace: boolean): void {
  // `isEditable` already refused a disabled island, so a null host here means
  // the element is editable without the attribute; address it directly.
  const host = editingHost(el) ?? el
  host.focus()
  const selection = host.ownerDocument.getSelection()
  if (selection !== null) {
    const range = host.ownerDocument.createRange()
    range.selectNodeContents(host)
    // A caret collapsed to the end appends; a full selection is replaced by insertText.
    if (!replace) range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }
  const doc = host.ownerDocument
  if (typeof doc.execCommand === 'function') {
    try {
      if (doc.execCommand('insertText', false, text)) return
    } catch {
      // Fall through to the direct-write path below.
    }
  }
  if (replace) host.textContent = ''
  host.textContent = `${host.textContent ?? ''}${text}`
  host.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Choose an option on a `<select>` the way a user would. The visible label wins
 * first because that is what the snapshot shows, then the value, then a
 * case-folded match on both.
 */
function selectOption(select: HTMLSelectElement, wanted: string): string {
  const needle = wanted.trim()
  const options = [...select.options]
  const match = options.find((option) => (option.textContent ?? '').trim() === needle)
    ?? options.find((option) => option.value === needle)
    ?? options.find((option) => (option.textContent ?? '').trim().toLowerCase() === needle.toLowerCase())
    ?? options.find((option) => option.value.toLowerCase() === needle.toLowerCase())
  if (match === undefined) {
    const available = options
      .slice(0, 12)
      .map((option) => (option.textContent ?? '').trim())
      .filter((label) => label !== '')
    throw new ActionError(
      'action-failed',
      `No option of the drop-down matches "${needle}". Available options: ${available.join(' | ')}${options.length > 12 ? ' | …' : ''}`,
    )
  }
  select.value = match.value
  select.dispatchEvent(new Event('input', { bubbles: true }))
  select.dispatchEvent(new Event('change', { bubbles: true }))
  return `Selected “${(match.textContent ?? '').trim() || match.value}” in the drop-down.`
}

/** Read a checkbox/radio intent from the text argument. */
function parseToggle(text: string, kind: string): boolean {
  const value = text.trim().toLowerCase()
  if (['true', 'on', 'yes', 'y', '1', 'checked', 'check', '是', '勾选'].includes(value)) return true
  if (['false', 'off', 'no', 'n', '0', 'unchecked', 'uncheck', '否', '取消'].includes(value)) return false
  throw new ActionError('bad-args', `Use true or false to set a ${kind} (received "${text}").`)
}

async function typeAction(args: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  const index = numberArg(args, 'index')
  const text = typeof args.text === 'string' ? args.text : ''
  if (text === '') throw new ActionError('bad-args', 'text must not be empty.')
  const replace = args.replace === true
  const el = elementOrThrow(ctx.ids, index)
  if (el instanceof HTMLSelectElement) {
    const note = selectOption(el, text)
    await waitForPageSettled(TYPE_SETTLE)
    return withPageDelta(note, ctx)
  }
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    const desired = parseToggle(text, el.type)
    if (el.checked !== desired) el.click()
    await waitForPageSettled(TYPE_SETTLE)
    return withPageDelta(`Set the ${el.type} to ${desired ? 'checked' : 'unchecked'}.`, ctx)
  }
  if (isEditable(el)) {
    typeIntoContentEditable(el, text, replace)
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (replace) setNativeValue(el, '')
    setNativeValue(el, `${el.value}${text}`)
  } else {
    throw new ActionError('action-failed', `Element [${index}] is not editable (${el.tagName.toLowerCase()}).`)
  }
  await waitForPageSettled(TYPE_SETTLE)
  return withPageDelta(`Entered ${text.length} characters into [${index}].`, ctx)
}

/** Elements a real Tab press would step through. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Focusable candidates in the order a real Tab press visits them: positive
 * tabindex values first (ascending), then everything else in document order.
 */
function tabbableElements(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    .filter((element) => element.getClientRects().length > 0 || element === document.activeElement)
    .map((element, index) => ({ element, index, tabIndex: element.tabIndex }))
    .sort((a, b) => {
      const aPositive = a.tabIndex > 0
      const bPositive = b.tabIndex > 0
      if (aPositive !== bPositive) return aPositive ? -1 : 1
      if (aPositive && bPositive && a.tabIndex !== b.tabIndex) return a.tabIndex - b.tabIndex
      return a.index - b.index
    })
    .map((entry) => entry.element)
}

/** Move focus the way a real Tab press would and describe the outcome. */
function moveFocus(backwards: boolean): string {
  const elements = tabbableElements()
  if (elements.length === 0) return 'the page has no focusable element to move to'
  const current = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
  const index = current === undefined ? -1 : elements.indexOf(current)
  const next = index === -1
    ? (backwards ? elements.length - 1 : 0)
    : (index + (backwards ? -1 : 1) + elements.length) % elements.length
  const element = elements[next]
  if (element === undefined) return 'the page has no focusable element to move to'
  element.focus()
  const label = element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? ''
  const described = label === '' ? '' : ` “${label}”`
  return `focus moved to <${element.tagName.toLowerCase()}>${described}`
}

/**
 * Perform the default action a real Enter press would trigger. Unlike a bare
 * `submit` event, `requestSubmit` runs validation and actually submits.
 */
function activateFocused(target: HTMLElement): string {
  if (target instanceof HTMLInputElement && (target.type === 'submit' || target.type === 'image')) {
    target.click()
    return 'activated the focused submit control'
  }
  if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) {
    target.click()
    return 'activated the focused control'
  }
  const form = target instanceof HTMLFormElement ? target : target.closest('form')
  if (form !== null) {
    form.requestSubmit()
    return 'submitted the surrounding form'
  }
  return 'the key had no default action here'
}

async function pressAction(args: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  const raw = typeof args.key === 'string' && args.key !== '' ? args.key : ''
  if (raw === '') throw new ActionError('bad-args', 'key must not be empty.')
  const shift = /^shift\+/i.test(raw)
  const key = raw.replace(/^(?:shift|ctrl|alt|meta)\+/i, '')
  const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body
  const init: KeyboardEventInit = { key, bubbles: true, cancelable: true, shiftKey: shift }
  const down = new KeyboardEvent('keydown', init)
  target.dispatchEvent(down)
  let note = 'the key had no default action here'
  if (down.defaultPrevented) {
    note = 'the page handled it'
  } else if (key === 'Tab') {
    note = moveFocus(shift)
  } else if (key === 'Enter') {
    note = activateFocused(target)
  } else if (key === ' ' || key === 'Spacebar') {
    note = activateFocused(target)
  }
  target.dispatchEvent(new KeyboardEvent('keyup', init))
  await waitForPageSettled(ACTION_SETTLE)
  return withPageDelta(`Sent key "${raw}"; ${note}.`, ctx)
}

async function scrollAction(args: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  const direction = typeof args.direction === 'string' ? args.direction : ''
  const amount = typeof args.amount === 'number' ? args.amount : Math.floor(window.innerHeight * 0.8)
  switch (direction) {
    case 'top':
      window.scrollTo({ top: 0, behavior: 'instant' })
      break
    case 'bottom':
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
      break
    case 'up':
      window.scrollBy({ top: -amount, behavior: 'instant' })
      break
    case 'down':
      window.scrollBy({ top: amount, behavior: 'instant' })
      break
    default:
      throw new ActionError('bad-args', `direction must be up, down, top, or bottom; received "${direction}".`)
  }
  await waitForPageSettled(SCROLL_SETTLE)
  return withPageDelta(`Scrolled ${direction}.`, ctx)
}

async function navigateAction(args: Record<string, unknown>): Promise<ActionResult> {
  const url = typeof args.url === 'string' && args.url !== '' ? args.url : ''
  if (url === '') throw new ActionError('bad-args', 'url must not be empty.')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new ActionError('bad-args', `url is not valid: ${url}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ActionError('bad-args', `Only http and https URLs are supported; received ${parsed.protocol}.`)
  }
  resetDeltaState()
  // Cross-document navigation unloads this content script and destroys the
  // tabs.sendMessage response port before any await settles — so answer
  // FIRST, then navigate in a fresh task. The model re-snapshots after load.
  setTimeout(() => { location.href = parsed.href }, 0)
  return {
    text: `Navigating to ${parsed.href}. Call browser_snapshot again after the page loads.`,
    navigationPending: true,
  }
}

async function historyAction(delta: 1 | -1): Promise<ActionResult> {
  resetDeltaState()
  // 同 navigate：先响应再导航（文档卸载会销毁响应端口）。
  setTimeout(() => { if (delta === -1) history.back(); else history.forward() }, 0)
  return {
    text: 'Navigating through browser history. Call browser_snapshot again after the page loads.',
    navigationPending: true,
  }
}

function reloadAction(): ActionResult {
  resetDeltaState()
  setTimeout(() => { location.reload() }, 0)
  return {
    text: 'The page is reloading. Call browser_snapshot again after it loads.',
    navigationPending: true,
  }
}

async function getTextAction(args: Record<string, unknown>): Promise<ActionResult> {
  const selector = typeof args.selector === 'string' && args.selector !== '' ? args.selector : undefined
  const source = selector !== undefined ? document.querySelector(selector) : null
  const text = source !== null ? pageText(source) : selector !== undefined ? `No element matched selector: ${selector}` : pageText()
  const truncated = truncate(text, 8_000)
  return { text: truncated.text + (truncated.truncated > 0 ? `\n(Truncated ${truncated.truncated} characters.)` : '') }
}

function imagesAction(args: Record<string, unknown>): ActionResult {
  const selector = typeof args.selector === 'string' && args.selector !== '' ? args.selector : undefined
  const limit = normalizeImageLimit(args.limit)
  if (limit === undefined) {
    throw new ActionError('bad-args', `limit must be a positive integer; received ${String(args.limit)}.`)
  }
  const scan = collectPageImages(document, { ...selector !== undefined ? { selector } : {}, limit })
  if (scan.error !== undefined) throw new ActionError('bad-args', scan.error)
  return { text: renderImageScan(scan) }
}

/** How often a condition wait re-checks the page. */
const WAIT_POLL_MS = 250
/** Condition-wait budget when the caller does not ask for one. */
const DEFAULT_WAIT_TIMEOUT_MS = 15_000
/** Longest condition wait allowed, kept well under the bridge's tool timeout. */
const MAX_WAIT_TIMEOUT_MS = 60_000

async function waitAction(args: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  const ms = typeof args.ms === 'number' && args.ms > 0 ? args.ms : 0
  const selector = typeof args.selector === 'string' && args.selector.trim() !== '' ? args.selector.trim() : undefined
  const text = typeof args.text === 'string' && args.text !== '' ? args.text : undefined
  const gone = args.gone === true
  if (selector === undefined && text === undefined) {
    await waitForPageSettled(EXPLICIT_WAIT_SETTLE)
    if (ms > 0) await sleep(ms)
    return withPageDelta(`The page is stable${ms > 0 ? ` after an additional ${ms}ms wait` : ''}.`, ctx)
  }
  const requested = typeof args.timeoutMs === 'number' && args.timeoutMs > 0 ? args.timeoutMs : DEFAULT_WAIT_TIMEOUT_MS
  const timeoutMs = Math.min(MAX_WAIT_TIMEOUT_MS, Math.round(requested))
  const described = selector === undefined ? `text “${text ?? ''}”` : `selector “${selector}”`
  const satisfied = (): boolean => {
    if (selector !== undefined) {
      let matched: Element | null
      try {
        matched = document.querySelector(selector)
      } catch {
        throw new ActionError('bad-args', `selector is not a valid CSS selector: ${selector}`)
      }
      if (gone ? matched !== null : matched === null) return false
    }
    if (text !== undefined) {
      const present = (document.body?.innerText ?? '').includes(text)
      if (gone ? present : !present) return false
    }
    return true
  }
  const deadline = Date.now() + timeoutMs
  while (!satisfied()) {
    if (Date.now() >= deadline) {
      throw new ActionError('action-failed', `Timed out after ${timeoutMs}ms waiting for ${described} to ${gone ? 'disappear' : 'appear'}.`)
    }
    await sleep(WAIT_POLL_MS)
  }
  await waitForPageSettled(EXPLICIT_WAIT_SETTLE)
  return withPageDelta(`Waited until ${described} ${gone ? 'disappeared' : 'appeared'}.`, ctx)
}

function numberArg(args: Record<string, unknown>, name: string): number {
  const value = args[name]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ActionError('bad-args', `${name} must be a non-negative integer; received ${String(value)}.`)
  }
  return value
}
