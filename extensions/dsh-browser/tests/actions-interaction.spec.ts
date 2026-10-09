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
  // jsdom has no layout engine, so every element would look unrendered and the
  // Tab order would come out empty.
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue({ length: 1 } as unknown as DOMRectList)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

/** Snapshot the page so the element inventory exists. */
async function snapshotIds(): Promise<ElementIds> {
  const ids = new ElementIds()
  await runAction('browser_snapshot', {}, { ids, budget: BUDGET })
  return ids
}

/** Run one action against an existing inventory, letting its settle timers fire. */
async function run(ids: ElementIds, action: string, args: Record<string, unknown>): Promise<{ text: string }> {
  const pending = runAction(action, args, { ids, budget: BUDGET })
  await vi.advanceTimersByTimeAsync(5_000)
  return await pending
}

describe('browser_press default actions', () => {
  it('moves focus on Tab the way the browser would', async () => {
    document.body.innerHTML = '<input id="a"><input id="b"><button id="c">go</button>'
    document.getElementById('a')!.focus()
    const ids = await snapshotIds()

    const result = await run(ids, 'browser_press', { key: 'Tab' })

    expect(document.activeElement).toBe(document.getElementById('b'))
    expect(result.text).toContain('focus moved')
  })

  it('moves focus backwards on Shift+Tab', async () => {
    document.body.innerHTML = '<input id="a"><input id="b">'
    document.getElementById('b')!.focus()
    const ids = await snapshotIds()

    await run(ids, 'browser_press', { key: 'Shift+Tab' })

    expect(document.activeElement).toBe(document.getElementById('a'))
  })

  it('submits the surrounding form on Enter', async () => {
    document.body.innerHTML = '<form><input name="q"></form>'
    const form = document.querySelector('form')!
    // jsdom does not implement real submission, so the handler stops it.
    const submitted = vi.fn((event: Event) => event.preventDefault())
    form.addEventListener('submit', submitted)
    document.querySelector('input')!.focus()
    const ids = await snapshotIds()

    const result = await run(ids, 'browser_press', { key: 'Enter' })

    expect(submitted).toHaveBeenCalledTimes(1)
    expect(result.text).toContain('submitted')
  })

  it.each(['Enter', ' ', 'Spacebar'])('does not submit multiline or non-text controls with %s', async (key) => {
    for (const markup of ['<textarea></textarea>', '<select><option>One</option></select>', '<div contenteditable="true">edit</div>', '<div tabindex="0">focus</div>']) {
      document.body.innerHTML = `<form>${markup}<button>Submit</button></form>`
      const form = document.querySelector('form')!
      const submitted = vi.fn((event: Event) => event.preventDefault())
      form.addEventListener('submit', submitted)
      ;(form.firstElementChild as HTMLElement).focus()
      await run(await snapshotIds(), 'browser_press', { key })
      expect(submitted).not.toHaveBeenCalled()
    }
  })

  it('does not submit text inputs or activate links with Space', async () => {
    document.body.innerHTML = '<form><input><a href="#next">Link</a></form>'
    const submitted = vi.fn((event: Event) => event.preventDefault())
    const clicked = vi.fn((event: Event) => event.preventDefault())
    document.querySelector('form')!.addEventListener('submit', submitted)
    document.querySelector('a')!.addEventListener('click', clicked)
    for (const el of document.querySelectorAll<HTMLElement>('input, a')) {
      el.focus()
      await run(await snapshotIds(), 'browser_press', { key: ' ' })
    }
    expect(submitted).not.toHaveBeenCalled()
    expect(clicked).not.toHaveBeenCalled()
  })

  it.each(['Enter', ' '])('activates buttons with %s without bypassing their handlers', async (key) => {
    document.body.innerHTML = '<form><button type="button">Go</button></form>'
    const clicked = vi.fn()
    const button = document.querySelector('button')!
    button.addEventListener('click', clicked)
    button.focus()
    await run(await snapshotIds(), 'browser_press', { key })
    expect(clicked).toHaveBeenCalledTimes(1)
  })

  it('toggles checkboxes on Space without submitting', async () => {
    document.body.innerHTML = '<form><input type="checkbox"></form>'
    const input = document.querySelector('input')!
    input.focus()
    await run(await snapshotIds(), 'browser_press', { key: ' ' })
    expect(input.checked).toBe(true)
  })

  it('uses the default submitter and respects a disabled default button', async () => {
    document.body.innerHTML = '<form id="form"><button disabled>Submit</button></form><input form="form">'
    const input = document.querySelector('input')!
    const button = document.querySelector('button')!
    const submitted = vi.fn((event: Event) => event.preventDefault())
    document.querySelector('form')!.addEventListener('submit', submitted)
    input.focus()
    await run(await snapshotIds(), 'browser_press', { key: 'Enter' })
    expect(submitted).not.toHaveBeenCalled()
    button.disabled = false
    await run(await snapshotIds(), 'browser_press', { key: 'Enter' })
    expect(submitted).toHaveBeenCalledTimes(1)
    expect((submitted.mock.calls[0]![0] as SubmitEvent).submitter).toBe(button)
  })

  it('does not implicitly submit multiple text inputs without a submit button', async () => {
    document.body.innerHTML = '<form><input><input></form>'
    const submitted = vi.fn((event: Event) => event.preventDefault())
    document.querySelector('form')!.addEventListener('submit', submitted)
    document.querySelector('input')!.focus()
    await run(await snapshotIds(), 'browser_press', { key: 'Enter' })
    expect(submitted).not.toHaveBeenCalled()
  })

  it('leaves the key alone when the page already handled it', async () => {
    document.body.innerHTML = '<input id="a"><input id="b">'
    const first = document.getElementById('a')!
    first.addEventListener('keydown', (event) => event.preventDefault())
    first.focus()
    const ids = await snapshotIds()

    const result = await run(ids, 'browser_press', { key: 'Tab' })

    expect(document.activeElement).toBe(first)
    expect(result.text).toContain('the page handled it')
  })
})

describe('browser_type on choice controls', () => {
  it('chooses a drop-down option by its visible label', async () => {
    document.body.innerHTML = '<select><option value="1">One</option><option value="2">Two</option></select>'
    const select = document.querySelector('select')!
    const ids = await snapshotIds()

    const result = await run(ids, 'browser_type', { index: ids.indexOf(select), text: 'Two' })

    expect(select.value).toBe('2')
    expect(result.text).toContain('Two')
  })

  it('names the available options when nothing matches', async () => {
    document.body.innerHTML = '<select><option value="1">One</option><option value="2">Two</option></select>'
    const select = document.querySelector('select')!
    const ids = await snapshotIds()

    const pending = runAction('browser_type', { index: ids.indexOf(select), text: 'Three' }, { ids, budget: BUDGET })
    // Attach the assertion before advancing the clock: the rejection happens
    // while the fake timers move, and a late handler is an unhandled rejection.
    const rejected = expect(pending).rejects.toThrow(/One \| Two/)
    await vi.advanceTimersByTimeAsync(5_000)
    await rejected
  })

  it('checks a checkbox and reports the new state', async () => {
    document.body.innerHTML = '<input type="checkbox" id="agree">'
    const box = document.querySelector('input')! as HTMLInputElement
    const ids = await snapshotIds()

    const result = await run(ids, 'browser_type', { index: ids.indexOf(box), text: 'true' })

    expect(box.checked).toBe(true)
    expect(result.text).toContain('checked')
  })
})

describe('browser_wait conditions', () => {
  it('returns once the selector appears', async () => {
    document.body.innerHTML = '<main>loading</main>'
    const ids = await snapshotIds()

    const pending = runAction('browser_wait', { selector: '#done', timeoutMs: 2_000 }, { ids, budget: BUDGET })
    document.body.insertAdjacentHTML('beforeend', '<div id="done">ok</div>')
    await vi.advanceTimersByTimeAsync(5_000)

    await expect(pending).resolves.toMatchObject({ text: expect.stringContaining('appeared') })
  })

  it('reports a timeout instead of hanging when the condition never holds', async () => {
    document.body.innerHTML = '<main>loading</main>'
    const ids = await snapshotIds()

    const pending = runAction('browser_wait', { selector: '#never', timeoutMs: 600 }, { ids, budget: BUDGET })
    const rejected = expect(pending).rejects.toThrow(/Timed out after 600ms/)
    await vi.advanceTimersByTimeAsync(5_000)
    await rejected
  })

  it('rejects a malformed selector instead of polling forever', async () => {
    document.body.innerHTML = '<main>loading</main>'
    const ids = await snapshotIds()

    const pending = runAction('browser_wait', { selector: ':::not-css:::', timeoutMs: 600 }, { ids, budget: BUDGET })
    const rejected = expect(pending).rejects.toThrow(/not a valid CSS selector/)
    await vi.advanceTimersByTimeAsync(5_000)
    await rejected
  })
})
