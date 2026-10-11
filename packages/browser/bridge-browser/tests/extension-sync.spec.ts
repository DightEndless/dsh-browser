import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = fileURLToPath(new URL('.', import.meta.url))
const bridgePkgDir = resolve(testDir, '..')
const repoRoot = resolve(bridgePkgDir, '../../..')
const distDir = resolve(repoRoot, 'extensions/dsh-browser/dist')
const packagedExtDir = resolve(bridgePkgDir, 'extension')
const packageJsonPath = resolve(bridgePkgDir, 'package.json')

function getRelativeFiles(dir: string, baseDir: string = dir): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...getRelativeFiles(full, baseDir))
    } else if (entry.isFile()) {
      results.push(join(dir, entry.name).slice(baseDir.length + 1).replace(/\\/g, '/'))
    }
  }
  return results.sort()
}

export function compareExtensionDirectories(
  dist: string,
  pkgExt: string,
  ignoredFiles: Set<string> = new Set(['build-stamp.json']),
): { matches: boolean; differences: string[] } {
  const distFiles = getRelativeFiles(dist).filter(f => !ignoredFiles.has(f))
  const pkgFiles = getRelativeFiles(pkgExt).filter(f => !ignoredFiles.has(f))

  const differences: string[] = []

  const distSet = new Set(distFiles)
  const pkgSet = new Set(pkgFiles)

  for (const file of distFiles) {
    if (!pkgSet.has(file)) {
      differences.push(`Missing in packaged extension: ${file}`)
    }
  }

  for (const file of pkgFiles) {
    if (!distSet.has(file)) {
      differences.push(`Extraneous in packaged extension: ${file}`)
    }
  }

  for (const file of distFiles) {
    if (pkgSet.has(file)) {
      const distBuf = readFileSync(join(dist, file))
      const pkgBuf = readFileSync(join(pkgExt, file))
      if (Buffer.compare(distBuf, pkgBuf) !== 0) {
        differences.push(`Content mismatch for: ${file} (dist size: ${distBuf.length}, pkg size: ${pkgBuf.length})`)
      }
    }
  }

  return {
    matches: differences.length === 0,
    differences,
  }
}

describe('packaged extension consistency', () => {
  it('includes extension in package.json files array', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    expect(pkg.files).toContain('extension')
  })

  it('contains all required extension assets in packages/browser/bridge-browser/extension', () => {
    expect(existsSync(packagedExtDir)).toBe(true)
    const requiredFiles = [
      'manifest.json',
      'background.js',
      'content.js',
      'main-world.js',
      'panel/index.html',
      'panel/assets/index.js',
      'panel/assets/index.css',
      'panel/assets/deepseek-256.png',
      '_locales/en/messages.json',
      '_locales/zh_CN/messages.json',
      '_locales/zh_TW/messages.json',
      'assets/icons/icon16.png',
      'assets/icons/icon32.png',
      'assets/icons/icon48.png',
      'assets/icons/icon128.png',
      'assets/icons/deepseek-256.png',
      'assets/icons/deepseek.ico',
    ]

    for (const rel of requiredFiles) {
      const full = join(packagedExtDir, rel)
      expect(existsSync(full), `Expected ${rel} to exist in packaged extension`).toBe(true)
      expect(statSync(full).size, `Expected ${rel} to not be empty`).toBeGreaterThan(0)
    }
  })

  it('is byte-for-byte identical to extensions/dsh-browser/dist (excluding build-stamp.json)', () => {
    if (!existsSync(distDir)) {
      throw new Error(`dist directory not found at ${distDir}. Run "pnpm build" first.`)
    }

    const { matches, differences } = compareExtensionDirectories(distDir, packagedExtDir)
    expect(
      differences,
      `Packaged extension does not match extensions/dsh-browser/dist. Run "node scripts/sync-extension-into-package.mjs".\nDifferences:\n${differences.join('\n')}`,
    ).toEqual([])
    expect(matches).toBe(true)
  })

  it('detects byte discrepancies and missing files when directories differ', () => {
    // Assert build-stamp.json exists in distDir and triggers a mismatch when unignored
    expect(existsSync(join(distDir, 'build-stamp.json')), 'distDir should contain build-stamp.json').toBe(true)
    const testComparison = compareExtensionDirectories(distDir, packagedExtDir, new Set())
    expect(testComparison.matches).toBe(false)
    expect(testComparison.differences.some(d => d.includes('build-stamp.json'))).toBe(true)
  })

  it('detects content mismatches, missing files, and extraneous files across mock directories', () => {
    const baseTemp = mkdtempSync(join(tmpdir(), 'dsh-sync-spec-'))
    const mockA = join(baseTemp, 'dirA')
    const mockB = join(baseTemp, 'dirB')

    try {
      mkdirSync(mockA, { recursive: true })
      mkdirSync(mockB, { recursive: true })

      // File identical
      writeFileSync(join(mockA, 'same.txt'), 'hello', 'utf8')
      writeFileSync(join(mockB, 'same.txt'), 'hello', 'utf8')

      // Content mismatch
      writeFileSync(join(mockA, 'diff.txt'), 'foo-version-1', 'utf8')
      writeFileSync(join(mockB, 'diff.txt'), 'bar-version-2', 'utf8')

      // Missing in B
      writeFileSync(join(mockA, 'only-in-a.txt'), 'a-only', 'utf8')

      // Extraneous in B
      writeFileSync(join(mockB, 'only-in-b.txt'), 'b-only', 'utf8')

      const result = compareExtensionDirectories(mockA, mockB)
      expect(result.matches).toBe(false)
      expect(result.differences.some(d => d.includes('Content mismatch for: diff.txt'))).toBe(true)
      expect(result.differences.some(d => d.includes('Missing in packaged extension: only-in-a.txt'))).toBe(true)
      expect(result.differences.some(d => d.includes('Extraneous in packaged extension: only-in-b.txt'))).toBe(true)
    } finally {
      rmSync(baseTemp, { recursive: true, force: true })
    }
  })
})
