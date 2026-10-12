// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runAction } from '../src/content/actions.ts'
import { ElementIds } from '../src/content/ids.ts'

const BUDGET = { maxItems: 20, maxForms: 10, maxChars: 8_000 }

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    right: 100,
    bottom: 20,
    width: 100,
    height: 20,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('H10: link navigation and delta state', () => {
  it('resets delta state on link navigation so subsequent wait does not report stale document or (No visible changes.)', async () => {
    document.body.innerHTML = '<main><h1>Example Domain</h1><p><a href="https://iana.org/help/example-domains">Learn more</a></p></main>'
    const link = document.querySelector('a')!
    link.scrollIntoView = vi.fn()
    const ids = new ElementIds()

    // 1. Initial snapshot on example.com
    const snap1 = await runAction('browser_snapshot', {}, { ids, budget: BUDGET })
    expect(snap1.text).toContain('Example Domain')

    // 2. Click the cross-origin link
    const clickPromise = runAction('browser_click', { index: ids.indexOf(link) }, {
      ids,
      budget: BUDGET,
      includePageDelta: true,
    })
    await vi.advanceTimersByTimeAsync(50)
    const clickResult = await clickPromise
    expect(clickResult.navigationPending).toBe(true)

    // 3. Immediately calling a wait or action with delta before a fresh snapshot must NOT return stale delta with "(No visible changes.)"
    const waitPromise = runAction('browser_wait', { ms: 100 }, {
      ids,
      budget: BUDGET,
      includePageDelta: true,
    })
    await vi.advanceTimersByTimeAsync(300)
    const waitResult = await waitPromise

    // In bug H10, resetDeltaState() was never called in clickAction, so lastSnapshot retained the old document and waitResult.pageContent was populated with stale "(No visible changes.)"
    expect(waitResult.pageContent).toBeUndefined()
  })

  it('detects anchor when indexed element is enclosed by an anchor link', async () => {
    // An interactive control inside an anchor, e.g. <a href="https://iana.org/help/example-domains"><button type="button">Inside Button</button></a>
    document.body.innerHTML = '<main><a href="https://iana.org/help/example-domains"><button type="button">Inside Button</button></a></main>'
    const button = document.querySelector('button')!
    button.scrollIntoView = vi.fn()
    const ids = new ElementIds()

    await runAction('browser_snapshot', {}, { ids, budget: BUDGET })
    const buttonIndex = ids.indexOf(button)
    expect(buttonIndex).toBeGreaterThanOrEqual(1)

    const clickPromise = runAction('browser_click', { index: buttonIndex }, {
      ids,
      budget: BUDGET,
      includePageDelta: true,
    })
    await vi.advanceTimersByTimeAsync(50)
    const clickResult = await clickPromise

    // Must recognize enclosing anchor and schedule controlled navigation rather than hanging in waitForPageSettled
    expect(clickResult.navigationPending).toBe(true)
    expect(clickResult.text).toContain('Clicked link')
  })

  it('preserves single navigation dispatch on plain <a> click without double navigation', async () => {
    document.body.innerHTML = '<main><a href="https://iana.org/help/example-domains">Learn more</a></main>'
    const link = document.querySelector('a')!
    link.scrollIntoView = vi.fn()
    const ids = new ElementIds()

    await runAction('browser_snapshot', {}, { ids, budget: BUDGET })

    let clickEventCount = 0
    link.addEventListener('click', () => {
      clickEventCount++
    })

    const clickPromise = runAction('browser_click', { index: ids.indexOf(link) }, {
      ids,
      budget: BUDGET,
      includePageDelta: true,
    })
    await vi.advanceTimersByTimeAsync(50)
    const clickResult = await clickPromise

    expect(clickResult.navigationPending).toBe(true)
    expect(clickEventCount).toBe(1)
  })

  it('allows SPA client-side routers to cancel navigation via preventDefault() without navigationPending', async () => {
    document.body.innerHTML = '<main><h1>Home</h1><a href="/spa-target">SPA Link</a></main>'
    const link = document.querySelector('a')!
    link.scrollIntoView = vi.fn()
    link.addEventListener('click', (e) => {
      e.preventDefault()
      document.querySelector('main')!.innerHTML = '<h1>SPA Target</h1>'
    })
    const ids = new ElementIds()

    await runAction('browser_snapshot', {}, { ids, budget: BUDGET })
    const clickPromise = runAction('browser_click', { index: ids.indexOf(link) }, {
      ids,
      budget: BUDGET,
      includePageDelta: true,
    })
    await vi.advanceTimersByTimeAsync(150)
    const clickResult = await clickPromise

    expect(clickResult.navigationPending).toBeUndefined()
    expect(clickResult.text).toContain('Clicked link')
    expect(clickResult.pageContent).toContain('SPA Target')
  })

  it('handles same-origin path navigation on <a> without opening new tabs', async () => {
    document.body.innerHTML = '<main><a href="/internal-page">Internal Link</a></main>'
    const link = document.querySelector('a')!
    link.scrollIntoView = vi.fn()
    const ids = new ElementIds()

    await runAction('browser_snapshot', {}, { ids, budget: BUDGET })
    const clickPromise = runAction('browser_click', { index: ids.indexOf(link) }, {
      ids,
      budget: BUDGET,
      includePageDelta: true,
    })
    await vi.advanceTimersByTimeAsync(50)
    const clickResult = await clickPromise

    expect(clickResult.navigationPending).toBe(true)
    expect(clickResult.text).toContain('Clicked link')
  })

  it('handles <button> with location.href navigation without double activation', async () => {
    document.body.innerHTML = '<main><button type="button">Go somewhere</button></main>'
    const button = document.querySelector('button')!
    button.scrollIntoView = vi.fn()
    let buttonClicks = 0
    button.addEventListener('click', () => {
      buttonClicks++
      location.href = 'https://iana.org/target'
    })
    const ids = new ElementIds()

    await runAction('browser_snapshot', {}, { ids, budget: BUDGET })
    const clickPromise = runAction('browser_click', { index: ids.indexOf(button) }, {
      ids,
      budget: BUDGET,
      includePageDelta: true,
    })
    await vi.advanceTimersByTimeAsync(150)
    const clickResult = await clickPromise

    expect(buttonClicks).toBe(1)
    expect(clickResult.text).toContain('Clicked [')
  })
})

