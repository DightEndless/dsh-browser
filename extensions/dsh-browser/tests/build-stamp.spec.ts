// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error Node ESM script module without declaration file
import { computeSourceHash, writeBuildStamp, verifyBuildStamp } from '../scripts/build-stamp.mjs'

describe('build-stamp', () => {
  function createTempExtension() {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-test-ext-'))
    const srcDir = join(dir, 'src')
    const distDir = join(dir, 'dist')
    mkdirSync(srcDir, { recursive: true })
    mkdirSync(distDir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf8')
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ manifest_version: 3 }), 'utf8')
    writeFileSync(join(srcDir, 'index.ts'), 'console.log("hello")', 'utf8')
    return {
      dir,
      distDir,
      srcDir,
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
    }
  }

  it('computes deterministic source hash', () => {
    const fixture = createTempExtension()
    try {
      const h1 = computeSourceHash(fixture.dir)
      const h2 = computeSourceHash(fixture.dir)
      expect(h1).toHaveLength(64)
      expect(h1).toBe(h2)

      // Modify source file
      writeFileSync(join(fixture.srcDir, 'index.ts'), 'console.log("modified")', 'utf8')
      const h3 = computeSourceHash(fixture.dir)
      expect(h3).not.toBe(h1)
    } finally {
      fixture.cleanup()
    }
  })

  it('detects missing manifest in dist', () => {
    const fixture = createTempExtension()
    try {
      const emptyDist = join(fixture.dir, 'empty-dist')
      mkdirSync(emptyDist, { recursive: true })
      const res = verifyBuildStamp(emptyDist, fixture.dir, fixture.dir)
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('Extension dist not built')
    } finally {
      fixture.cleanup()
    }
  })

  it('detects missing build stamp in dist', () => {
    const fixture = createTempExtension()
    try {
      writeFileSync(join(fixture.distDir, 'manifest.json'), '{}', 'utf8')
      const res = verifyBuildStamp(fixture.distDir, fixture.dir, fixture.dir)
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('missing build stamp')
    } finally {
      fixture.cleanup()
    }
  })

  it('validates a freshly written build stamp', () => {
    const fixture = createTempExtension()
    try {
      writeFileSync(join(fixture.distDir, 'manifest.json'), '{}', 'utf8')
      writeBuildStamp(fixture.distDir, fixture.dir, fixture.dir)

      const res = verifyBuildStamp(fixture.distDir, fixture.dir, fixture.dir)
      expect(res.valid).toBe(true)
      expect(res.stamp).toBeDefined()
    } finally {
      fixture.cleanup()
    }
  })

  it('rejects stale dist when source hash mismatches', () => {
    const fixture = createTempExtension()
    try {
      writeFileSync(join(fixture.distDir, 'manifest.json'), '{}', 'utf8')
      writeBuildStamp(fixture.distDir, fixture.dir, fixture.dir)

      // Modify source file after build
      writeFileSync(join(fixture.srcDir, 'index.ts'), 'console.log("new edit")', 'utf8')

      const res = verifyBuildStamp(fixture.distDir, fixture.dir, fixture.dir)
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('source hash')
    } finally {
      fixture.cleanup()
    }
  })

  it('rejects stale dist when commit hash mismatches', () => {
    const fixture = createTempExtension()
    try {
      try {
        const { execSync } = require('node:child_process')
        execSync('git init && git config user.email "t@t" && git config user.name "t" && git commit --allow-empty -m "initial"', {
          cwd: fixture.dir,
          stdio: 'ignore',
        })
      } catch {
        return // Skip if git cannot be run
      }
      writeFileSync(join(fixture.distDir, 'manifest.json'), '{}', 'utf8')
      const stamp = writeBuildStamp(fixture.distDir, fixture.dir, fixture.dir)
      // Manually set an outdated commit
      stamp.gitCommit = '0000000000000000000000000000000000000000'
      writeFileSync(join(fixture.distDir, 'build-stamp.json'), JSON.stringify(stamp), 'utf8')

      const res = verifyBuildStamp(fixture.distDir, fixture.dir, fixture.dir)
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('STALE')
      expect(res.reason).toContain('Built from commit 00000000')
    } finally {
      fixture.cleanup()
    }
  })
})
