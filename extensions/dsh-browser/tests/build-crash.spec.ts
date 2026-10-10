// @vitest-environment jsdom
import { mkdtempSync, mkdirSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TEARDOWN_CRASH_CODE,
  classifyTarget,
  hasFreshOutput,
  isTeardownCrash,
} from '../scripts/build-crash.mjs'

const fsModule = { readdirSync, statSync }

/** Create a scratch directory that is removed after the test. */
function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'build-crash-'))
  created.push(dir)
  return dir
}

const created: string[] = []

afterEach(() => {
  restorePlatform()
  while (created.length > 0) rmSync(created.pop() as string, { recursive: true, force: true })
})

/** Report a chosen platform without disturbing the rest of the process object. */
function onPlatform(platform: string): void {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')
  if (original !== undefined && savedPlatform === undefined) savedPlatform = original
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

let savedPlatform: PropertyDescriptor | undefined

function restorePlatform(): void {
  if (savedPlatform === undefined) return
  Object.defineProperty(process, 'platform', savedPlatform)
  savedPlatform = undefined
}

describe('isTeardownCrash', () => {
  it('recognizes the Windows teardown crash and nothing else', () => {
    onPlatform('win32')
    expect(isTeardownCrash(TEARDOWN_CRASH_CODE, null)).toBe(true)
    expect(isTeardownCrash(1, null)).toBe(false)
    expect(isTeardownCrash(0, null)).toBe(false)
    // A signal death is a different failure, however the status reads.
    expect(isTeardownCrash(null, 'SIGSEGV')).toBe(false)
  })

  it('does not claim the crash on platforms that never showed it', () => {
    onPlatform('linux')
    expect(isTeardownCrash(TEARDOWN_CRASH_CODE, null)).toBe(false)
  })
})

describe('hasFreshOutput', () => {
  it('finds a file written after the target started', () => {
    const dir = scratch()
    const startedAt = Date.now()
    writeFileSync(join(dir, 'background.js'), 'built')
    utimesSync(join(dir, 'background.js'), new Date(startedAt + 1000), new Date(startedAt + 1000))
    expect(hasFreshOutput(dir, startedAt, fsModule)).toBe(true)
  })

  it('finds a file in a nested directory', () => {
    const dir = scratch()
    mkdirSync(join(dir, 'panel', 'assets'), { recursive: true })
    const startedAt = Date.now()
    const nested = join(dir, 'panel', 'assets', 'index.js')
    writeFileSync(nested, 'built')
    utimesSync(nested, new Date(startedAt + 1000), new Date(startedAt + 1000))
    expect(hasFreshOutput(dir, startedAt, fsModule)).toBe(true)
  })

  it('reports no output when everything predates the target', () => {
    const dir = scratch()
    const file = join(dir, 'background.js')
    writeFileSync(file, 'stale')
    const stale = new Date(Date.now() - 60_000)
    utimesSync(file, stale, stale)
    expect(hasFreshOutput(dir, Date.now() - 1000, fsModule)).toBe(false)
  })

  it('reports no output for a directory that does not exist', () => {
    expect(hasFreshOutput(join(tmpdir(), 'build-crash-missing-dir'), Date.now(), fsModule)).toBe(false)
  })
})

describe('classifyTarget', () => {
  it('accepts a clean exit', () => {
    const dir = scratch()
    expect(classifyTarget({ status: 0, signal: null }, dir, Date.now(), fsModule)).toBe('ok')
  })

  it('accepts the teardown crash when the output was written', () => {
    onPlatform('win32')
    const dir = scratch()
    const startedAt = Date.now()
    const file = join(dir, 'background.js')
    writeFileSync(file, 'built')
    utimesSync(file, new Date(startedAt + 1000), new Date(startedAt + 1000))
    expect(classifyTarget({ status: TEARDOWN_CRASH_CODE, signal: null }, dir, startedAt, fsModule)).toBe('teardown-crash')
  })

  it('fails the same crash when nothing was written', () => {
    onPlatform('win32')
    const dir = scratch()
    expect(classifyTarget({ status: TEARDOWN_CRASH_CODE, signal: null }, dir, Date.now(), fsModule)).toBe('failed')
  })

  it('fails an ordinary non-zero exit even with fresh output', () => {
    onPlatform('win32')
    const dir = scratch()
    const startedAt = Date.now()
    const file = join(dir, 'background.js')
    writeFileSync(file, 'built')
    utimesSync(file, new Date(startedAt + 1000), new Date(startedAt + 1000))
    expect(classifyTarget({ status: 1, signal: null }, dir, startedAt, fsModule)).toBe('failed')
  })
})
