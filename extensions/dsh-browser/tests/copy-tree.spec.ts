// @vitest-environment jsdom
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { copyTree } from '../scripts/copy-tree.mjs'

const created: string[] = []

/** A scratch directory that is removed after the test. */
function scratch(prefix = 'copy-tree-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  created.push(dir)
  return dir
}

afterEach(() => {
  while (created.length > 0) rmSync(created.pop() as string, { recursive: true, force: true })
})

describe('copyTree', () => {
  it('copies nested directories and file contents', () => {
    const source = scratch()
    mkdirSync(join(source, 'icons'), { recursive: true })
    mkdirSync(join(source, 'nested', 'deeper'), { recursive: true })
    writeFileSync(join(source, 'top.txt'), 'top')
    writeFileSync(join(source, 'icons', 'icon16.png'), 'icon')
    writeFileSync(join(source, 'nested', 'deeper', 'deep.txt'), 'deep')

    const destination = join(scratch(), 'out')
    copyTree(source, destination)

    expect(readFileSync(join(destination, 'top.txt'), 'utf8')).toBe('top')
    expect(readFileSync(join(destination, 'icons', 'icon16.png'), 'utf8')).toBe('icon')
    expect(readFileSync(join(destination, 'nested', 'deeper', 'deep.txt'), 'utf8')).toBe('deep')
  })

  it('overwrites an existing file instead of failing', () => {
    const source = scratch()
    writeFileSync(join(source, 'messages.json'), 'new')
    const destination = scratch()
    writeFileSync(join(destination, 'messages.json'), 'old')

    copyTree(source, destination)

    expect(readFileSync(join(destination, 'messages.json'), 'utf8')).toBe('new')
  })

  it('copes with a destination path that holds non-ASCII characters', () => {
    // This is the shape that kills fs.cpSync on Node 24.14.0 under Windows: a
    // checkout in a directory like `dsh工作区` lost every icon and locale catalog
    // from the build, and Chrome then refused to load the extension.
    const source = scratch()
    mkdirSync(join(source, 'icons'), { recursive: true })
    writeFileSync(join(source, 'icons', 'icon16.png'), 'icon')

    const destination = join(scratch(), '工作区', 'dist')
    copyTree(source, destination)

    expect(readdirSync(join(destination, 'icons'))).toEqual(['icon16.png'])
    expect(readFileSync(join(destination, 'icons', 'icon16.png'), 'utf8')).toBe('icon')
  })
})

describe('the extension build avoids fs.cpSync', () => {
  it('does not call cpSync from the build script or its vite plugin', () => {
    // A regression guard, because the failure mode is a process crash rather
    // than a failed assertion: reintroducing cpSync silently costs the build its
    // static files on any checkout whose path is not pure ASCII.
    for (const relative of ['../scripts/build.mjs', '../vite.shared.ts']) {
      const text = readFileSync(new URL(relative, import.meta.url), 'utf8')
      expect(text).not.toMatch(/\bcpSync\s*\(/)
    }
  })
})
