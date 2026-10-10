/**
 * Build every extension target sequentially into dist/ (or dist-firefox/
 * with --firefox): background (es|iife) → content (iife) → main world (iife) →
 * panel (React). The first target cleans the output; the later ones append.
 * Pass --watch for dev rebuilds, --edge for the Edge-tagged Chromium build.
 *
 * Each target runs vite through Node's own entry point rather than the
 * `node_modules/.bin` shell shim: spawning that shim needs a shell on Windows,
 * and a teardown crash on that path (STATUS_STACK_BUFFER_OVERRUN, reported by
 * Node 24.14.0 after the output is already written) would fail the build for
 * no reason. scripts/build-crash.mjs tells that crash apart from a real one.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyTarget } from './build-crash.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const watch = process.argv.includes('--watch')

// --firefox switches the manifest and background bundle for the Firefox build.
if (process.argv.includes('--firefox')) {
  process.env.EXT_TARGET = 'firefox'
}

// --edge builds the same Chromium bundle for Microsoft Edge. The runtime tells
// the two apart by user agent; only the manifest name needs to differ so the
// two installs are recognizable in their browser's extension list.
if (process.argv.includes('--edge')) {
  process.env.EXT_TARGET = process.env.EXT_TARGET ?? 'edge'
}

/** Where this build's passes land. */
const distDir = resolve(root, process.env.EXT_TARGET === 'firefox' ? 'dist-firefox' : 'dist')

/**
 * One public key for the Edge build. Chromium derives the unpacked extension id
 * from this key, so the Edge install gets a stable id of its own — that id is
 * what the bridge uses to tell the two browser installs apart.
 */
const EDGE_MANIFEST_KEY = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDN6hM0rsDYGbzQPQfOygqlRtQgKUXMfnSjhIBL7LnReAVBEd7ZmKtyN2qmSasMl4HZpMhVe2rPWVVwBDl6iyNE/Kok6E6v6V3vCLGsOpQAuuNVye/3QxzIldzG/jQAdWZiyXReRVapOhZtLjGfywCvlWq7Sl/e3sbc0vWybSDI2QIDAQAB'

/** Rename the Edge build and give it its own extension id. */
function tagEdgeManifest() {
  if (process.env.EXT_TARGET !== 'edge') return
  for (const locale of ['en', 'zh_CN', 'zh_TW']) {
    const path = new URL(`../dist/_locales/${locale}/messages.json`, import.meta.url)
    const messages = JSON.parse(readFileSync(path, 'utf8'))
    const current = messages.extensionName?.message
    if (typeof current !== 'string' || current.endsWith('(Edge)')) continue
    messages.extensionName.message = `${current} (Edge)`
    writeFileSync(path, `${JSON.stringify(messages, null, 2)}\n`)
  }
  const manifestPath = new URL('../dist/manifest.json', import.meta.url)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.key = EDGE_MANIFEST_KEY
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log('tagged Edge extension name and manifest key')
}

/**
 * Locate vite's entry point. Its exports map hides `bin/vite.js`, so read the
 * package's own `bin` field instead of guessing the path.
 */
function resolveViteBin() {
  const require = createRequire(import.meta.url)
  const packagePath = require.resolve('vite/package.json')
  const bin = JSON.parse(readFileSync(packagePath, 'utf8')).bin
  const relative = typeof bin === 'string' ? bin : bin.vite
  return resolve(packagePath, '..', relative)
}

const configs = [
  'vite.background.config.ts',
  'vite.content.config.ts',
  'vite.mainworld.config.ts',
  'vite.panel.config.ts',
]

if (watch) {
  // 三个 watcher 并行启动（串行时第一个永不停机，后面的永远不会启动）。
  const children = configs.map((config) => spawn('vite', ['build', '--config', config, '--watch'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }))
  for (const child of children) {
    child.on('exit', (code) => { if (code !== 0) process.exit(code ?? 1) })
  }
} else {
  const viteBin = resolveViteBin()
  if (!existsSync(viteBin)) {
    console.error(`build: vite entry not found at ${viteBin}`)
    process.exit(1)
  }
  let teardownCrashes = 0
  for (const config of configs) {
    const startedAt = Date.now()
    const result = spawnSync(process.execPath, [viteBin, 'build', '--config', config], {
      cwd: root,
      stdio: 'inherit',
    })
    const outcome = classifyTarget(result, distDir, startedAt, { readdirSync, statSync })
    if (outcome === 'failed') {
      console.error(`build: ${config} failed (status ${result.status ?? 'none'}, signal ${result.signal ?? 'none'})`)
      process.exit(result.status ?? 1)
    }
    if (outcome === 'teardown-crash') {
      teardownCrashes += 1
      console.warn(`build: ${config} wrote its output, then hit the Node teardown crash (0x${result.status.toString(16)}); continuing`)
    }
  }
  tagEdgeManifest()
  if (teardownCrashes > 0) {
    console.warn(`build: ${teardownCrashes} target(s) crashed after writing output — Node ${process.version} does this on Windows; the artifacts are complete`)
  }
}
