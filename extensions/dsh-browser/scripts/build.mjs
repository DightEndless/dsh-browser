/**
 * Build every extension target sequentially into dist/ (or dist-firefox/
 * with --firefox): background (es|iife) → content (iife) → main world (iife) →
 * panel (React). The first target cleans the output; the later ones append.
 * Pass --watch for dev rebuilds, --edge for the Edge-tagged Chromium build.
 *
 * Each target runs vite through Node's own entry point rather than the
 * `node_modules/.bin` shell shim: spawning that shim needs a shell on Windows,
 * and the teardown crash described below rides in on that path.
 *
 * Node 24.14.0 on Windows kills a finished vite process with
 * STATUS_STACK_BUFFER_OVERRUN. That crash can land *inside* vite's closeBundle,
 * after the JS bundle is written but before the plugin has copied the files the
 * manifest references — leaving a build that looks successful and an extension
 * that Chrome refuses to load (a missing `_locales/<locale>/messages.json` is
 * fatal when the manifest declares `default_locale`). So the static copies are
 * re-applied here after the targets, and the result is checked against the
 * manifest before the build may report success.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyTarget } from './build-crash.mjs'
import { copyTree } from './copy-tree.mjs'

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

const isFirefox = process.env.EXT_TARGET === 'firefox'

/** Where this build's passes land. */
const distDir = resolve(root, isFirefox ? 'dist-firefox' : 'dist')

/** The manifest this build copies into dist/manifest.json. */
const manifestFile = isFirefox ? 'manifest.firefox.json' : 'manifest.json'

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
    if (!existsSync(path)) continue
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
 * Copy the files no bundler emits: the manifest, the locale catalogs, and the
 * icons. vite's copy plugin does the same thing, but it runs inside the process
 * that can die mid-copy, so this repeats it where a crash cannot reach. The
 * copies go through copyTree, not fs.cpSync: see scripts/copy-tree.mjs.
 */
function syncStaticFiles() {
  mkdirSync(distDir, { recursive: true })
  copyFileSync(resolve(root, manifestFile), resolve(distDir, 'manifest.json'))
  copyTree(resolve(root, '_locales'), resolve(distDir, '_locales'))
  copyTree(resolve(root, 'assets'), resolve(distDir, 'assets'))
}

/**
 * Insist that every path the built manifest references exists in dist. A missing
 * locale catalog or icon makes the browser refuse the whole extension, and the
 * browser's error names the file rather than the build step that lost it.
 */
function assertDistComplete() {
  const manifest = JSON.parse(readFileSync(resolve(distDir, 'manifest.json'), 'utf8'))
  const referenced = new Set()
  /** Collect the manifest's file references: anything shaped like a bundled file. */
  const collect = (value) => {
    if (typeof value === 'string') {
      if (/\.(js|html|css|png|ico|json|jpg|svg)$/i.test(value)) referenced.add(value.replace(/^\//, ''))
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) collect(item)
      return
    }
    if (value !== null && typeof value === 'object') {
      for (const item of Object.values(value)) collect(item)
    }
  }
  collect(manifest)
  if (typeof manifest.default_locale === 'string') referenced.add(`_locales/${manifest.default_locale}/messages.json`)

  const missing = [...referenced].sort().filter((relative) => !existsSync(resolve(distDir, relative)))
  if (missing.length === 0) return
  console.error(`build: the manifest references ${missing.length} file(s) that are not in ${distDir}:`)
  for (const relative of missing) console.error(`  ${relative}`)
  process.exit(1)
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
  // A crash inside the last target's closeBundle can leave the JS bundles in
  // place and the static files missing, so both steps run again from here and
  // the build refuses to pass until the manifest's own list is satisfied.
  syncStaticFiles()
  assertDistComplete()
  tagEdgeManifest()
  if (teardownCrashes > 0) {
    console.warn(`build: ${teardownCrashes} target(s) crashed after writing output — Node ${process.version} does this on Windows; the artifacts were completed from source`)
  }
}
