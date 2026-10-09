/**
 * Build all three extension targets sequentially into dist/ (or dist-firefox/
 * with --firefox):
 * background (es|iife) → content (iife) → panel (React). The first target
 * cleans the output; the later ones append. Pass --watch for dev rebuilds.
 */

import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
  for (const config of configs) {
    const result = spawnSync('vite', ['build', '--config', config], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
  tagEdgeManifest()
}
