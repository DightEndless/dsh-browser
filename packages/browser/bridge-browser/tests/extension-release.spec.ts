import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  releasePackagedExtension,
  defaultExtensionSourceDir,
  EXTENSION_VERSION_FILE,
} from '../src/extension-release.ts'

describe('releasePackagedExtension', () => {
  let tempDir: string
  let mockSource: string
  let mockTarget: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'dsh-ext-release-test-'))
    mockSource = join(tempDir, 'source-extension')
    mockTarget = join(tempDir, 'target-extension')

    mkdirSync(mockSource, { recursive: true })
    writeFileSync(join(mockSource, 'manifest.json'), JSON.stringify({ name: 'test-ext', version: '1.2.3' }), 'utf8')
    writeFileSync(join(mockSource, 'background.js'), 'console.log("bg");', 'utf8')
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('installs extension when target directory is fresh', () => {
    const result = releasePackagedExtension({
      sourceDir: mockSource,
      targetDir: mockTarget,
    })

    expect(result.status).toBe('installed')
    expect(result.version).toBe('1.2.3')
    expect(existsSync(join(mockTarget, 'manifest.json'))).toBe(true)
    expect(existsSync(join(mockTarget, 'background.js'))).toBe(true)
    expect(existsSync(join(mockTarget, EXTENSION_VERSION_FILE))).toBe(true)
    expect(readFileSync(join(mockTarget, EXTENSION_VERSION_FILE), 'utf8').trim()).toBe('1.2.3')
  })

  it('skips copying when version marker matches (idempotent)', () => {
    // Initial install
    const first = releasePackagedExtension({
      sourceDir: mockSource,
      targetDir: mockTarget,
    })
    expect(first.status).toBe('installed')

    // Add a canary file to target to prove it is not overwritten or wiped
    writeFileSync(join(mockTarget, 'canary.txt'), 'do-not-delete', 'utf8')

    // Second call with same version
    const second = releasePackagedExtension({
      sourceDir: mockSource,
      targetDir: mockTarget,
    })

    expect(second.status).toBe('up-to-date')
    expect(second.version).toBe('1.2.3')
    expect(existsSync(join(mockTarget, 'canary.txt'))).toBe(true)
    expect(readFileSync(join(mockTarget, 'canary.txt'), 'utf8')).toBe('do-not-delete')
  })

  it('overwrites target directory when version changes', () => {
    // Install version 1.2.3
    releasePackagedExtension({
      sourceDir: mockSource,
      targetDir: mockTarget,
    })
    expect(readFileSync(join(mockTarget, EXTENSION_VERSION_FILE), 'utf8').trim()).toBe('1.2.3')

    // Bump version in source
    writeFileSync(join(mockSource, 'manifest.json'), JSON.stringify({ name: 'test-ext', version: '1.2.4' }), 'utf8')
    writeFileSync(join(mockSource, 'background.js'), 'console.log("bg v2");', 'utf8')

    // Call release again
    const updated = releasePackagedExtension({
      sourceDir: mockSource,
      targetDir: mockTarget,
    })

    expect(updated.status).toBe('installed')
    expect(updated.version).toBe('1.2.4')
    expect(readFileSync(join(mockTarget, EXTENSION_VERSION_FILE), 'utf8').trim()).toBe('1.2.4')
    expect(readFileSync(join(mockTarget, 'background.js'), 'utf8')).toBe('console.log("bg v2");')
  })

  it('does not throw when target path is unwritable (graceful degradation)', () => {
    // Create a regular file where the target directory should be
    const unwritablePath = join(tempDir, 'file-blocking-dir')
    writeFileSync(unwritablePath, 'blocking file', 'utf8')
    const badTarget = join(unwritablePath, 'sub-dir')

    const warnSpy = vi.fn()
    let result: ReturnType<typeof releasePackagedExtension> | undefined

    expect(() => {
      result = releasePackagedExtension({
        sourceDir: mockSource,
        targetDir: badTarget,
        logger: { warn: warnSpy },
      })
    }).not.toThrow()

    expect(result).toBeDefined()
    expect(result!.status).toBe('failed')
    expect(result!.error).toBeDefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('does not throw when bundled source is missing', () => {
    const nonExistentSource = join(tempDir, 'non-existent')
    const warnSpy = vi.fn()

    const result = releasePackagedExtension({
      sourceDir: nonExistentSource,
      targetDir: mockTarget,
      logger: { warn: warnSpy },
    })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('Bundled extension source not found')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('prunes stale files from target directory when upgrading to a new version', () => {
    // Install version 1.2.3 with an extra file
    writeFileSync(join(mockSource, 'stale-asset.js'), 'console.log("old");', 'utf8')
    releasePackagedExtension({
      sourceDir: mockSource,
      targetDir: mockTarget,
    })
    expect(existsSync(join(mockTarget, 'stale-asset.js'))).toBe(true)

    // Remove the stale file in source and bump version to 1.2.4
    rmSync(join(mockSource, 'stale-asset.js'))
    writeFileSync(join(mockSource, 'manifest.json'), JSON.stringify({ name: 'test-ext', version: '1.2.4' }), 'utf8')

    // Release update
    const updated = releasePackagedExtension({
      sourceDir: mockSource,
      targetDir: mockTarget,
    })

    expect(updated.status).toBe('installed')
    expect(updated.version).toBe('1.2.4')
    // Stale asset must be pruned from target
    expect(existsSync(join(mockTarget, 'stale-asset.js'))).toBe(false)
    // Core files must remain
    expect(existsSync(join(mockTarget, 'manifest.json'))).toBe(true)
    expect(existsSync(join(mockTarget, 'background.js'))).toBe(true)
  })

  it('fails gracefully when bundled manifest is invalid JSON or lacks version', () => {
    writeFileSync(join(mockSource, 'manifest.json'), 'invalid JSON {', 'utf8')
    const warnSpy = vi.fn()

    const result = releasePackagedExtension({
      sourceDir: mockSource,
      targetDir: mockTarget,
      logger: { warn: warnSpy },
    })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('Failed to read bundled extension manifest')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('reinstalls when target manifest version does not match version file', () => {
    // Initial install
    releasePackagedExtension({
      sourceDir: mockSource,
      targetDir: mockTarget,
    })

    // Corrupt or alter target manifest version while keeping .dsh-extension-version
    writeFileSync(join(mockTarget, 'manifest.json'), JSON.stringify({ name: 'test-ext', version: 'corrupted-version' }), 'utf8')

    // Next call must detect the discrepancy and reinstall rather than reporting up-to-date
    const refreshed = releasePackagedExtension({
      sourceDir: mockSource,
      targetDir: mockTarget,
    })

    expect(refreshed.status).toBe('installed')
    expect(JSON.parse(readFileSync(join(mockTarget, 'manifest.json'), 'utf8')).version).toBe('1.2.3')
  })

  it('can release the real repo bundled extension without errors', () => {
    const realSource = defaultExtensionSourceDir()
    expect(existsSync(realSource)).toBe(true)

    const result = releasePackagedExtension({
      sourceDir: realSource,
      targetDir: mockTarget,
    })

    expect(result.status).toBe('installed')
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(existsSync(join(mockTarget, 'manifest.json'))).toBe(true)
    expect(existsSync(join(mockTarget, 'background.js'))).toBe(true)
    expect(existsSync(join(mockTarget, 'panel/index.html'))).toBe(true)
  })
})
