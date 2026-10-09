// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

const LISTENER_KEY = '__dshBrowserContentScriptListener__'
const WATCHER_KEY = '__dshBrowserSelectionWatcher__'

afterEach(() => {
  ;((globalThis as Record<string, unknown>)[WATCHER_KEY] as { dispose: () => void } | undefined)?.dispose()
  vi.useRealTimers()
  Reflect.deleteProperty(navigator, 'userActivation')
  delete (globalThis as Record<string, unknown>)[LISTENER_KEY]
  delete (globalThis as Record<string, unknown>)[WATCHER_KEY]
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('content script registration', () => {
  it('replaces a stale listener when content.js is injected again', async () => {
    const addListener = vi.fn()
    const removeListener = vi.fn()
    const sendMessage = vi.fn(async () => undefined)
    vi.stubGlobal('chrome', {
      runtime: { onMessage: { addListener, removeListener }, sendMessage },
    })

    await import('../src/content/index.ts')
    expect(addListener).toHaveBeenCalledTimes(1)
    expect(removeListener).not.toHaveBeenCalled()
    const firstListener = addListener.mock.calls[0]?.[0]

    vi.resetModules()
    await import('../src/content/index.ts')

    expect(removeListener).toHaveBeenCalledWith(firstListener)
    expect(addListener).toHaveBeenCalledTimes(2)
    expect(addListener.mock.calls[1]?.[0]).not.toBe(firstListener)
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage).toHaveBeenLastCalledWith({ type: 'DSH_CONTENT_READY' })
  })
})

describe('selection watch arming', () => {
  function stubChrome(readyResponse: unknown) {
    // An event-driven capture requires the user's own transient activation.
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { isActive: true, hasBeenActive: true },
    })
    const sendMessage = vi.fn(async (message: { type: string }) =>
      message.type === 'DSH_CONTENT_READY' ? readyResponse : undefined)
    vi.stubGlobal('chrome', {
      runtime: { onMessage: { addListener: vi.fn(), removeListener: vi.fn() }, sendMessage },
    })
    // Each import starts without a pre-existing highlight unless the test
    // explicitly installs one. Other tests replace this writable JSDOM method.
    window.getSelection = () => null
    return sendMessage
  }

  it('ignores a ready reply from a replaced content script', async () => {
    vi.useFakeTimers()
    let resolveReady!: (value: unknown) => void
    const ready = new Promise((resolve) => { resolveReady = resolve })
    const sendMessage = stubChrome(ready)
    await import('../src/content/index.ts')
    vi.resetModules()
    sendMessage.mockImplementation(async () => ({ selectionWatch: false }))
    await import('../src/content/index.ts')
    window.getSelection = () => ({ toString: () => 'quoted text' }) as unknown as Selection
    resolveReady({ selectionWatch: true, selectionWatchRevision: 5 })
    await vi.advanceTimersByTimeAsync(400)
    document.dispatchEvent(new Event('selectionchange'))
    await vi.advanceTimersByTimeAsync(400)
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })

  it('ignores ready replies after an explicit watch command from a fresh worker', async () => {
    vi.useFakeTimers()
    let resolveReady!: (value: unknown) => void
    const sendMessage = stubChrome(new Promise((resolve) => { resolveReady = resolve }))
    await import('../src/content/index.ts')
    const listener = (globalThis as Record<string, unknown>)[LISTENER_KEY] as Function
    listener({ type: 'DSH_SELECTION_WATCH', enabled: false, epoch: 'new-worker', revision: 0 }, {}, vi.fn())
    window.getSelection = () => ({ toString: () => 'quoted text' }) as unknown as Selection
    resolveReady({ selectionWatch: true, selectionWatchEpoch: 'old-worker', selectionWatchRevision: 5 })
    await vi.advanceTimersByTimeAsync(400)
    document.dispatchEvent(new Event('selectionchange'))
    await vi.advanceTimersByTimeAsync(400)
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('does not report selections until the service worker asks for them', async () => {
    const sendMessage = stubChrome({ selectionWatch: false })
    await import('../src/content/index.ts')
    await vi.waitFor(() => { expect(sendMessage).toHaveBeenCalledTimes(1) })

    window.getSelection = () => ({ toString: () => 'quoted text' }) as unknown as Selection
    document.dispatchEvent(new Event('selectionchange'))
    await new Promise((resolve) => { setTimeout(resolve, 400) })

    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('reports a settled selection once a panel has armed the document', async () => {
    const sendMessage = stubChrome({ selectionWatch: true })
    await import('../src/content/index.ts')
    await vi.waitFor(() => { expect(sendMessage).toHaveBeenCalledTimes(1) })

    window.getSelection = () => ({ toString: () => 'quoted text' }) as unknown as Selection
    document.dispatchEvent(new Event('selectionchange'))

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'DSH_SELECTION',
        selection: expect.objectContaining({ text: 'quoted text' }),
      })
    }, { timeout: 2_000 })
  })
})
