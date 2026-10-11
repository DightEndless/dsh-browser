// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dispatchToolCall,
  handleDialogOpening,
  handleDialogClosed,
  handleDebuggerDetached,
  handleTabNavigating,
  formatDialogOpeningWarning,
  setDialogHoldTimeoutMsForTesting,
  clearPendingDialogs,
  getPendingDialog,
  getTimedOutDialog,
  type ToolCall,
} from '../src/background/tools.ts'

function mockTab(tabId = 1): chrome.tabs.Tab {
  return {
    id: tabId,
    windowId: 1,
    index: 0,
    active: true,
    highlighted: true,
    pinned: false,
    incognito: false,
    selected: true,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    url: 'https://example.com/app',
    title: 'Example App',
  }
}

describe('Native JS Dialog lifecycle and browser_dialog handling (H1)', () => {
  const tab = mockTab(101)
  let sentCommands: Array<{ command: string; payload?: unknown }> = []
  let detachCalls: number = 0
  let reloadCalls: number = 0

  beforeEach(() => {
    sentCommands = []
    detachCalls = 0
    reloadCalls = 0
    clearPendingDialogs()
    setDialogHoldTimeoutMsForTesting(60_000)

    const debuggerAttach = vi.fn(async () => undefined)
    const debuggerDetach = vi.fn(async () => {
      detachCalls += 1
    })
    const debuggerSendCommand = vi.fn(async (_target: unknown, command: string, payload?: unknown) => {
      sentCommands.push({ command, payload })
      if (command === 'Runtime.evaluate') {
        return { result: { type: 'number', value: 42 } }
      }
      return {}
    })

    const query = vi.fn(async () => [tab])
    const get = vi.fn(async () => tab)
    const reload = vi.fn(async () => {
      reloadCalls += 1
    })
    const getAllFrames = vi.fn(async () => [
      { frameId: 0, parentFrameId: -1, documentId: 'doc-101', url: tab.url },
    ])
    const executeScript = vi.fn(async () => [{ frameId: 0, result: { width: 1280, height: 720, centerX: 100, centerY: 100 } }])
    const sendMessage = vi.fn(async () => ({ ok: true, result: { text: 'ok' } }))

    vi.stubGlobal('chrome', {
      tabs: { query, get, reload, sendMessage },
      debugger: { attach: debuggerAttach, detach: debuggerDetach, sendCommand: debuggerSendCommand },
      webNavigation: { getAllFrames },
      scripting: { executeScript },
      permissions: { contains: vi.fn(async () => true) },
    })
  })

  afterEach(() => {
    clearPendingDialogs()
    setDialogHoldTimeoutMsForTesting(60_000)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('formats warning text for confirm, prompt, alert, beforeunload correctly', () => {
    expect(formatDialogOpeningWarning({ type: 'confirm', message: 'Delete?' })).toContain(
      '[Native JS dialog opened: confirm("Delete?") — WARNING: Tab is frozen. Call browser_dialog with action: \'accept\' or \'dismiss\', or call browser_reload to abort.]',
    )
    expect(formatDialogOpeningWarning({ type: 'prompt', message: 'Name', defaultPrompt: 'Alice' })).toContain(
      '[Native JS dialog opened: prompt("Name", default: "Alice") — WARNING: Tab is frozen. Call browser_dialog with action: \'accept\' (with optional promptText) or \'dismiss\', or call browser_reload to abort.]',
    )
    expect(formatDialogOpeningWarning({ type: 'alert', message: 'Done' })).toContain(
      '[Native JS dialog opened: alert("Done") — WARNING: Tab is frozen. Call browser_dialog with action: \'dismiss\', or call browser_reload to abort.]',
    )
    expect(formatDialogOpeningWarning({ type: 'beforeunload', message: 'Leave?' })).toContain(
      '[Native JS dialog opened: beforeunload("Leave?") — WARNING: Tab is frozen. Call browser_dialog with action: \'accept\' (leave) or \'dismiss\' (stay), or call browser_reload to abort.]',
    )
  })

  it('rejects browser_dialog when action is not accept or dismiss', async () => {
    const call: ToolCall = { id: 'call-1', name: 'browser_dialog', args: { action: 'maybe' } }
    const res = await dispatchToolCall(call, 'auto', undefined, undefined, undefined, tab, undefined, { unrestrictedAccess: true })
    expect(res.ok).toBe(false)
    expect(res.error?.message).toContain('action must be "accept" or "dismiss"')
  })

  it('reports no active dialog when browser_dialog is called on a normal tab', async () => {
    const call: ToolCall = { id: 'call-1', name: 'browser_dialog', args: { action: 'accept' } }
    const res = await dispatchToolCall(call, 'auto', undefined, undefined, undefined, tab, undefined, { unrestrictedAccess: true })
    expect(res.ok).toBe(false)
    expect(res.error?.message).toContain('There is no active native dialog on this tab')
  })

  it('handles confirm dialog: accept commits action and dismiss rolls back', async () => {
    const debuggee = { tabId: tab.id! }
    handleDialogOpening(tab.id!, debuggee, { type: 'confirm', message: 'Are you sure?' })
    expect(getPendingDialog(tab.id!)).toBeDefined()

    let committed = false
    let rolledBack = false
    const commitAction = () => { committed = true }
    const rollbackActionCommit = () => { rolledBack = true }

    const acceptCall: ToolCall = { id: 'c-1', name: 'browser_dialog', args: { action: 'accept' } }
    const res = await dispatchToolCall(acceptCall, 'auto', undefined, undefined, undefined, tab, undefined, {
      unrestrictedAccess: true,
      commitAction,
      rollbackActionCommit,
    })

    expect(res.ok).toBe(true)
    expect((res.result as { text: string }).text).toBe('Dialog confirm("Are you sure?") was accepted.')
    expect(sentCommands).toContainEqual({
      command: 'Page.handleJavaScriptDialog',
      payload: { accept: true },
    })
    expect(detachCalls).toBe(1)
    expect(committed).toBe(true)
    expect(rolledBack).toBe(false)
    expect(getPendingDialog(tab.id!)).toBeUndefined()

    // Now test dismiss
    handleDialogOpening(tab.id!, debuggee, { type: 'confirm', message: 'Are you sure?' })
    committed = false
    rolledBack = false

    const dismissCall: ToolCall = { id: 'c-2', name: 'browser_dialog', args: { action: 'dismiss' } }
    const resDismiss = await dispatchToolCall(dismissCall, 'auto', undefined, undefined, undefined, tab, undefined, {
      unrestrictedAccess: true,
      commitAction,
      rollbackActionCommit,
    })

    expect(resDismiss.ok).toBe(true)
    expect((resDismiss.result as { text: string }).text).toBe('Dialog confirm("Are you sure?") was dismissed.')
    expect(sentCommands).toContainEqual({
      command: 'Page.handleJavaScriptDialog',
      payload: { accept: false },
    })
    expect(committed).toBe(false)
    expect(rolledBack).toBe(true)
    expect(getPendingDialog(tab.id!)).toBeUndefined()
  })

  it('handles prompt dialog with promptText and defaultPrompt', async () => {
    const debuggee = { tabId: tab.id! }
    handleDialogOpening(tab.id!, debuggee, { type: 'prompt', message: 'Enter name', defaultPrompt: 'DefaultName' })

    const acceptCall: ToolCall = { id: 'c-3', name: 'browser_dialog', args: { action: 'accept', promptText: 'Antigravity' } }
    const res = await dispatchToolCall(acceptCall, 'auto', undefined, undefined, undefined, tab, undefined, { unrestrictedAccess: true })

    expect(res.ok).toBe(true)
    expect((res.result as { text: string }).text).toBe('Dialog prompt("Enter name") was submitted with text "Antigravity".')
    expect(sentCommands).toContainEqual({
      command: 'Page.handleJavaScriptDialog',
      payload: { accept: true, promptText: 'Antigravity' },
    })

    // Prompt accept without promptText should submit defaultPrompt to CDP
    handleDialogOpening(tab.id!, debuggee, { type: 'prompt', message: 'Enter city', defaultPrompt: 'Beijing' })
    const acceptDefaultCall: ToolCall = { id: 'c-3b', name: 'browser_dialog', args: { action: 'accept' } }
    const resDefault = await dispatchToolCall(acceptDefaultCall, 'auto', undefined, undefined, undefined, tab, undefined, { unrestrictedAccess: true })
    expect(resDefault.ok).toBe(true)
    expect((resDefault.result as { text: string }).text).toBe('Dialog prompt("Enter city") was submitted with text "Beijing".')
    expect(sentCommands).toContainEqual({
      command: 'Page.handleJavaScriptDialog',
      payload: { accept: true, promptText: 'Beijing' },
    })

    // Prompt dismiss
    handleDialogOpening(tab.id!, debuggee, { type: 'prompt', message: 'Enter name' })
    const dismissCall: ToolCall = { id: 'c-4', name: 'browser_dialog', args: { action: 'dismiss' } }
    const resDismiss = await dispatchToolCall(dismissCall, 'auto', undefined, undefined, undefined, tab, undefined, { unrestrictedAccess: true })
    expect(resDismiss.ok).toBe(true)
    expect((resDismiss.result as { text: string }).text).toBe('Dialog prompt("Enter name") was dismissed.')
  })

  it('handles alert dialog and commits action upon dismissal', async () => {
    const debuggee = { tabId: tab.id! }
    handleDialogOpening(tab.id!, debuggee, { type: 'alert', message: 'File saved' })

    let committed = false
    let rolledBack = false
    const commitAction = () => { committed = true }
    const rollbackActionCommit = () => { rolledBack = true }

    const call: ToolCall = { id: 'c-5', name: 'browser_dialog', args: { action: 'dismiss' } }
    const res = await dispatchToolCall(call, 'auto', undefined, undefined, undefined, tab, undefined, {
      unrestrictedAccess: true,
      commitAction,
      rollbackActionCommit,
    })
    expect(res.ok).toBe(true)
    expect((res.result as { text: string }).text).toBe('Dialog alert("File saved") was dismissed.')
    expect(committed).toBe(true)
    expect(rolledBack).toBe(false)
  })

  it('handles beforeunload dialog: dismiss triggers rollbackActionCommit', async () => {
    const debuggee = { tabId: tab.id! }
    handleDialogOpening(tab.id!, debuggee, { type: 'beforeunload', message: 'Changes may be lost' })

    let committed = false
    let rolledBack = false
    const commitAction = () => { committed = true }
    const rollbackActionCommit = () => { rolledBack = true }

    const dismissCall: ToolCall = { id: 'c-6', name: 'browser_dialog', args: { action: 'dismiss' } }
    const res = await dispatchToolCall(dismissCall, 'auto', undefined, undefined, undefined, tab, undefined, {
      unrestrictedAccess: true,
      commitAction,
      rollbackActionCommit,
    })

    expect(res.ok).toBe(true)
    expect((res.result as { text: string }).text).toBe('Dialog beforeunload("Changes may be lost") was dismissed.')
    expect(sentCommands).toContainEqual({
      command: 'Page.handleJavaScriptDialog',
      payload: { accept: false },
    })
    expect(committed).toBe(false)
    expect(rolledBack).toBe(true)

    // Accept beforeunload
    handleDialogOpening(tab.id!, debuggee, { type: 'beforeunload', message: 'Changes may be lost' })
    committed = false
    rolledBack = false

    const acceptCall: ToolCall = { id: 'c-7', name: 'browser_dialog', args: { action: 'accept' } }
    const resAccept = await dispatchToolCall(acceptCall, 'auto', undefined, undefined, undefined, tab, undefined, {
      unrestrictedAccess: true,
      commitAction,
      rollbackActionCommit,
    })
    expect(resAccept.ok).toBe(true)
    expect((resAccept.result as { text: string }).text).toBe('Dialog beforeunload("Changes may be lost") was accepted.')
    expect(committed).toBe(true)
    expect(rolledBack).toBe(false)
  })

  it('fast-fails other tool calls when a dialog is pending', async () => {
    const debuggee = { tabId: tab.id! }
    handleDialogOpening(tab.id!, debuggee, { type: 'confirm', message: 'Order confirmation' })

    const snapCall: ToolCall = { id: 'c-snap', name: 'browser_snapshot', args: {} }
    const res = await dispatchToolCall(snapCall, 'auto', undefined, undefined, undefined, tab, undefined, { unrestrictedAccess: true })

    expect(res.ok).toBe(false)
    expect(res.error?.code).toBe('content-unavailable')
    expect(res.error?.message).toContain('[Native JS dialog opened: confirm("Order confirmation") — WARNING: Tab is frozen')
  })

  it('times out after hold duration without auto-answering and informs caller tab is frozen', async () => {
    vi.useFakeTimers()
    setDialogHoldTimeoutMsForTesting(500)

    const debuggee = { tabId: tab.id! }
    handleDialogOpening(tab.id!, debuggee, { type: 'confirm', message: 'Hold timeout' })

    expect(getPendingDialog(tab.id!)).toBeDefined()
    expect(getTimedOutDialog(tab.id!)).toBeUndefined()

    // Advance time past timeout
    vi.advanceTimersByTime(600)

    expect(getPendingDialog(tab.id!)).toBeUndefined()
    expect(getTimedOutDialog(tab.id!)).toBeDefined()
    // Debugger detached
    expect(detachCalls).toBe(1)
    // CRITICAL: NEVER automatically answered!
    expect(sentCommands.some((c) => c.command === 'Page.handleJavaScriptDialog')).toBe(false)

    vi.useRealTimers()

    // Now call browser_dialog: must report timeout
    const dialogCall: ToolCall = { id: 'c-t1', name: 'browser_dialog', args: { action: 'accept' } }
    const resDialog = await dispatchToolCall(dialogCall, 'auto', undefined, undefined, undefined, tab, undefined, { unrestrictedAccess: true })
    expect(resDialog.ok).toBe(false)
    expect(resDialog.error?.message).toContain('The native JavaScript dialog timed out')
    expect(resDialog.error?.message).toContain('recovery option is browser_reload')

    // Call browser_snapshot: must report timeout
    const snapCall: ToolCall = { id: 'c-t2', name: 'browser_snapshot', args: {} }
    const resSnap = await dispatchToolCall(snapCall, 'auto', undefined, undefined, undefined, tab, undefined, { unrestrictedAccess: true })
    expect(resSnap.ok).toBe(false)
    expect(resSnap.error?.message).toContain('The native JavaScript dialog timed out')
  })

  it('escape hatch: browser_reload resets pending and timed out dialogs', async () => {
    const debuggee = { tabId: tab.id! }
    handleDialogOpening(tab.id!, debuggee, { type: 'confirm', message: 'Freeze' })

    const reloadCall: ToolCall = { id: 'c-reload', name: 'browser_reload', args: {} }
    const res = await dispatchToolCall(reloadCall, 'auto', undefined, undefined, undefined, tab, undefined, { unrestrictedAccess: true })

    expect(res.ok).toBe(true)
    expect((res.result as { text: string }).text).toContain('The page is reloading')
    expect(reloadCalls).toBe(1)
    expect(getPendingDialog(tab.id!)).toBeUndefined()
    expect(getTimedOutDialog(tab.id!)).toBeUndefined()
  })

  it('user manual dismiss via Page.javascriptDialogClosed cleans up pending dialog', () => {
    const debuggee = { tabId: tab.id! }
    handleDialogOpening(tab.id!, debuggee, { type: 'confirm', message: 'Manual click' })
    expect(getPendingDialog(tab.id!)).toBeDefined()

    handleDialogClosed(tab.id!, { result: true })
    expect(getPendingDialog(tab.id!)).toBeUndefined()
    expect(detachCalls).toBe(1)
  })

  it('tab navigation cleans up pending dialog', () => {
    const debuggee = { tabId: tab.id! }
    handleDialogOpening(tab.id!, debuggee, { type: 'confirm', message: 'Navigating' })
    expect(getPendingDialog(tab.id!)).toBeDefined()

    handleTabNavigating(tab.id!)
    expect(getPendingDialog(tab.id!)).toBeUndefined()
    expect(detachCalls).toBe(1)
  })

  it('debugger detachment cleans up pending dialog', () => {
    const debuggee = { tabId: tab.id! }
    handleDialogOpening(tab.id!, debuggee, { type: 'confirm', message: 'Detaching' })
    expect(getPendingDialog(tab.id!)).toBeDefined()

    handleDebuggerDetached(tab.id!)
    expect(getPendingDialog(tab.id!)).toBeUndefined()
  })

  it('intercepts dialog opening during dispatchClickAt without hanging and holds debugger', async () => {
    let committed = false
    const commitAction = () => { committed = true }

    // Intercept sendCommand: on mouseReleased, trigger dialog opening
    const origSendCommand = chrome.debugger.sendCommand
    let resolveHangingMouse: (() => void) | undefined
    const hangingMousePromise = new Promise<void>((resolve) => {
      resolveHangingMouse = resolve
    })

    chrome.debugger.sendCommand = vi.fn(async (target: unknown, command: string, payload?: unknown) => {
      sentCommands.push({ command, payload })
      if (command === 'Input.dispatchMouseEvent' && (payload as { type?: string })?.type === 'mouseReleased') {
        // Chromium emits Page.javascriptDialogOpening when confirm() is called in click handler
        handleDialogOpening(tab.id!, target as chrome.debugger.Debuggee, { type: 'confirm', message: 'Delete forever?' })
        await hangingMousePromise
        return {}
      }
      return origSendCommand(target as chrome.debugger.Debuggee, command, payload as object | undefined)
    })

    const clickCall: ToolCall = { id: 'c-click', name: 'browser_click_at', args: { x: 0.5, y: 0.5 } }
    const res = await dispatchToolCall(clickCall, 'auto', undefined, undefined, undefined, tab, undefined, {
      unrestrictedAccess: true,
      commitAction,
    })

    expect(res.ok).toBe(true)
    expect((res.result as { text: string }).text).toContain(
      '[Native JS dialog opened: confirm("Delete forever?") — WARNING: Tab is frozen',
    )
    expect(committed).toBe(false)
    expect(detachCalls).toBe(0) // Debugger held!
    expect(getPendingDialog(tab.id!)).toBeDefined()

    // Now answer the dialog with browser_dialog
    const dialogCall: ToolCall = { id: 'c-ans', name: 'browser_dialog', args: { action: 'accept' } }
    const ansRes = await dispatchToolCall(dialogCall, 'auto', undefined, undefined, undefined, tab, undefined, {
      unrestrictedAccess: true,
      commitAction,
    })

    resolveHangingMouse?.()

    expect(ansRes.ok).toBe(true)
    expect(committed).toBe(true) // Committed on accept!
    expect(detachCalls).toBe(1) // Debugger detached on dialog answer!
    expect(getPendingDialog(tab.id!)).toBeUndefined()
  })
})
