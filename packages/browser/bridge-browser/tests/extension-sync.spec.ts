import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
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
    const testComparison = compareExtensionDirectories(distDir, packagedExtDir, new Set())
    // Because build-stamp.json is in distDir but not in packagedExtDir, it should detect the difference when not ignored:
    if (existsSync(join(distDir, 'build-stamp.json'))) {
      expect(testComparison.matches).toBe(false)
      expect(testComparison.differences.some(d => d.includes('build-stamp.json'))).toBe(true)
    }
  })
})
