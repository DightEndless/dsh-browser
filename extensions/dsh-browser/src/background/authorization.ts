/** Pure authorization policy for model-requested browser tools. */

import type { ToolCall } from './tools.ts'
import type { TabFrame } from './frames.ts'
import type { ApprovalPrompt } from '../security/approval.ts'
import { getUiLocale, type UiLocale } from '../i18n.ts'

const PAGE_READS = new Set(['browser_snapshot', 'browser_get_text', 'browser_images', 'browser_screenshot'])
const STATE_CHANGING_ACTIONS = new Set([
  'browser_click',
  'browser_type',
  'browser_press',
  'browser_upload',
  'browser_eval',
  'browser_click_at',
  'browser_hover',
  'browser_drag',
  'browser_batch',
  'browser_navigate',
  'browser_open_tab',
  'browser_back',
  'browser_forward',
  'browser_reload',
])

/** Return an approval prompt, or undefined when this call needs no prompt. */
export function approvalPromptForCall(
  call: ToolCall,
  sharePageContent: 'ask' | 'auto' | 'off',
  frames: TabFrame[],
  locale: UiLocale = getUiLocale(),
): ApprovalPrompt | undefined {
  if (PAGE_READS.has(call.name)) {
    if (sharePageContent !== 'ask') return undefined
    // Only the snapshot and an explicit allFrames listing read beyond one frame.
    const readsEveryFrame = call.name === 'browser_snapshot' || call.args.allFrames === true
    const targetFrames = readsEveryFrame
      ? frames
      : frames.filter((frame) => frame.frameId === requestedFrame(call.args))
    return {
      kind: 'read',
      action: call.name,
      summary: readSummary(call, locale),
      origins: uniqueOrigins(targetFrames, frames),
      canTrust: false,
    }
  }

  if (!STATE_CHANGING_ACTIONS.has(call.name)) return undefined
  if (call.name === 'browser_open_tab') {
    const destination = originFromUrl(typeof call.args.url === 'string' ? call.args.url : '')
    return {
      kind: 'action',
      action: call.name,
      summary: summarizeAction(call, locale),
      // A new tab does not mutate the current page; only the destination matters.
      origins: destination === undefined ? [] : [destination],
      canTrust: destination !== undefined,
    }
  }
  const frameId = requestedFrame(call.args)
  const target = frames.find((frame) => frame.frameId === frameId) ?? frames.find((frame) => frame.frameId === 0)
  const origins = uniqueOrigins(target === undefined ? [] : [target], frames)
  let canTrust = origins.length === 1 && call.name !== 'browser_back' && call.name !== 'browser_forward'
  if (call.name === 'browser_navigate') {
    const destination = originFromUrl(typeof call.args.url === 'string' ? call.args.url : '')
    if (destination !== undefined && !origins.includes(destination)) origins.push(destination)
    // Do not let an invalid, opaque, or cross-origin navigation become a
    // back door for adding the current page to the persistent allowlist.
    canTrust = destination !== undefined && origins.length === 1 && origins[0] === destination
  }
  return {
    kind: 'action',
    action: call.name,
    summary: summarizeAction(call, locale),
    origins,
    // Cross-origin/invalid navigation and unknown history destinations always
    // require a fresh decision; they must never expand trust implicitly.
    canTrust,
  }
}

function requestedFrame(args: Record<string, unknown>): number {
  return typeof args.frame === 'number' && Number.isInteger(args.frame) && args.frame >= 0 ? args.frame : 0
}

function uniqueOrigins(targets: TabFrame[], allFrames: TabFrame[]): string[] {
  const origins = new Set<string>()
  for (const frame of targets) {
    const origin = effectiveFrameOrigin(frame, allFrames)
    if (origin !== undefined) origins.add(origin)
  }
  return [...origins].sort()
}

function effectiveFrameOrigin(frame: TabFrame, frames: TabFrame[], visited = new Set<number>()): string | undefined {
  if (visited.has(frame.frameId)) return undefined
  visited.add(frame.frameId)
  const direct = originFromUrl(frame.url)
  if (direct !== undefined) return direct
  const parent = frames.find((candidate) => candidate.frameId === frame.parentFrameId)
  return parent === undefined ? undefined : effectiveFrameOrigin(parent, frames, visited)
}

export function originFromUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'blob:') return undefined
    return url.origin === 'null' ? undefined : url.origin
  } catch {
    return undefined
  }
}

/** Reader-facing purpose of one page-reading tool. */
function readSummary(call: ToolCall, locale: UiLocale): string {
  if (call.name === 'browser_get_text') {
    return localized(locale, 'Read text from the specified area of the current page', '读取当前页面的指定文本区域')
  }
  if (call.name === 'browser_images') {
    return localized(locale, 'Read image addresses from the current page', '读取当前页面的图片地址')
  }
  if (call.name === 'browser_screenshot') {
    return call.args.fullPage === true
      ? localized(locale, 'Capture the whole current page as one image', '截取整个当前页面为一张图片')
      : localized(locale, 'Capture the visible area of the current page as an image', '截取当前页面的可见区域为图片')
  }
  return localized(locale, 'Read the current page and accessible iframes', '读取当前页面及可访问 iframe')
}

function summarizeAction(call: ToolCall, locale: UiLocale): string {
  const frame = typeof call.args.frame === 'number' && call.args.frame !== 0
    ? localized(locale, `, iframe ${call.args.frame}`, `，iframe ${call.args.frame}`)
    : ''
  const index = typeof call.args.index === 'number' ? call.args.index : '?'
  switch (call.name) {
    case 'browser_click': return localized(locale, `Click element [${index}]${frame}`, `点击元素 [${index}]${frame}`)
    case 'browser_type': {
      const length = typeof call.args.text === 'string' ? call.args.text.length : 0
      return localized(
        locale,
        `Enter ${length} characters in element [${index}]${frame} (the text is not shown in this dialog)`,
        `向元素 [${index}] 输入 ${length} 个字符${frame}（文本内容不会显示在确认框）`,
      )
    }
    case 'browser_press': return localized(
      locale,
      `Press “${safeInline(typeof call.args.key === 'string' ? call.args.key : '')}”${frame}`,
      `发送按键「${safeInline(typeof call.args.key === 'string' ? call.args.key : '')}」${frame}`,
    )
    // The path is shown on purpose: this is the one tool that sends a local file
    // into a page, so the user must see exactly which file is about to leave.
    case 'browser_upload': return localized(
      locale,
      `Attach the local file “${safeInline(typeof call.args.path === 'string' ? call.args.path : '?')}” to the page${frame}`,
      `把本地文件「${safeInline(typeof call.args.path === 'string' ? call.args.path : '?')}」上传到页面${frame}`,
    )
    // The expression is shown in full on purpose: this is the one tool that can
    // run arbitrary code in the page, so the user must see exactly what will run.
    case 'browser_eval': return localized(
      locale,
      `Run this script in the page: ${safeInline(typeof call.args.expression === 'string' ? call.args.expression : '?')}`,
      `在页面中执行这段脚本：${safeInline(typeof call.args.expression === 'string' ? call.args.expression : '?')}`,
    )
    case 'browser_click_at': {
      const across = typeof call.args.x === 'number' ? Math.round(call.args.x * 100) : '?'
      const down = typeof call.args.y === 'number' ? Math.round(call.args.y * 100) : '?'
      return localized(
        locale,
        `Click inside the page at ${across}% across and ${down}% down`,
        `在页面横向 ${across}%、纵向 ${down}% 处点击`,
      )
    }
    case 'browser_hover': return localized(
      locale,
      `Move the pointer onto ${describeTarget(locale, call)} and leave it there`,
      `把鼠标移到${describeTarget(locale, call)}并停在那里`,
    )
    case 'browser_drag': return localized(
      locale,
      `Drag from ${describeTarget(locale, call, 'from')} to ${describeTarget(locale, call, 'to')}`,
      `从${describeTarget(locale, call, 'from')}拖拽到${describeTarget(locale, call, 'to')}`,
    )
    // Every step is listed: one approval covers the whole batch, so this prompt
    // is the only place the user sees what the batch will actually do.
    case 'browser_batch': return batchSummary(call, locale)
    case 'browser_navigate': return localized(
      locale,
      `Navigate to ${displayUrl(typeof call.args.url === 'string' ? call.args.url : '', locale)}`,
      `导航到 ${displayUrl(typeof call.args.url === 'string' ? call.args.url : '', locale)}`,
    )
    case 'browser_open_tab': {
      const destination = displayUrl(typeof call.args.url === 'string' ? call.args.url : '', locale)
      return call.args.active === false
        ? localized(
          locale,
          `Open a background tab at ${destination}`,
          `在后台新标签页打开 ${destination}`,
        )
        : localized(
          locale,
          `Open a new tab at ${destination}`,
          `在新标签页打开 ${destination}`,
        )
    }
    case 'browser_back': return localized(locale, 'Go back in browser history (destination domain unknown)', '返回浏览历史上一页（目标域名未知）')
    case 'browser_forward': return localized(locale, 'Go forward in browser history (destination domain unknown)', '前进到浏览历史下一页（目标域名未知）')
    case 'browser_reload': return localized(locale, 'Reload the current page', '重新加载当前页面')
    default: return call.name
  }
}

/**
 * Name one hover/drag endpoint the way the user thinks about it: an inventory
 * number when the call used one, a spot on the screen when it used fractions.
 */
function describeTarget(locale: UiLocale, call: ToolCall, prefix = ''): string {
  const index = call.args[`${prefix}index`]
  if (typeof index === 'number') {
    return localized(locale, `element [${index}]`, `元素 [${index}]`)
  }
  const x = call.args[`${prefix}x`]
  const y = call.args[`${prefix}y`]
  if (typeof x === 'number' && typeof y === 'number') {
    return localized(
      locale,
      `the point ${Math.round(x * 100)}% across and ${Math.round(y * 100)}% down`,
      `横向 ${Math.round(x * 100)}%、纵向 ${Math.round(y * 100)}% 的位置`,
    )
  }
  return localized(locale, 'an unset target', '一个未指定的位置')
}

/** Expand one batch into the individual actions it would run, in order. */
function batchSummary(call: ToolCall, locale: UiLocale): string {
  const raw = call.args.actions
  const entries = Array.isArray(raw) ? raw : []
  const parts = entries.map((entry) => {
    if (typeof entry !== 'object' || entry === null) return '?'
    const tool = (entry as { tool?: unknown }).tool
    const args = (entry as { args?: unknown }).args
    if (typeof tool !== 'string' || tool === '') return '?'
    const stepArgs = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {}
    return summarizeAction({ id: call.id, name: tool, args: stepArgs }, locale)
  })
  return localized(
    locale,
    `Run ${parts.length} actions in a row: ${parts.join('; ')}`,
    `连续执行 ${parts.length} 个操作：${parts.join('；')}`,
  )
}

function displayUrl(value: string, locale: UiLocale): string {
  try {
    const url = new URL(value)
    return safeInline(`${url.origin}${url.pathname}`, 160)
  } catch {
    return localized(locale, '(invalid URL)', '(无效 URL)')
  }
}

function localized(locale: UiLocale, english: string, chinese: string): string {
  return locale === 'zh' ? chinese : english
}

function safeInline(value: string, maxLength = 40): string {
  const inline = value.replace(/\s+/g, ' ').trim()
  return inline.length <= maxLength ? inline : `${inline.slice(0, maxLength - 1)}…`
}
