/**
 * Re-copy the built Edge extension into ~/.dsh/browser-extension-edge.
 *
 *   node refresh-edge-extension.cjs
 *
 * Run this after rebuilding with `node scripts/build.mjs --edge` (from
 * extensions/dsh-browser). Edge reloads an unpacked extension from this folder,
 * so point the browser at this path once; later refreshes need a click on the
 * reload button in edge://extensions.
 */
const { cpSync, readFileSync, rmSync, existsSync } = require('node:fs')
const path = require('node:path')

const root = __dirname
const dist = path.join(root, 'extensions', 'dsh-browser', 'dist')
const target = path.join(process.env.USERPROFILE ?? 'C:\\Users\\24425', '.dsh', 'browser-extension-edge')

if (!existsSync(dist)) {
  console.error(`build output missing: ${dist}\nrun: cd extensions/dsh-browser && node scripts/build.mjs --edge`)
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
cpSync(dist, target, { recursive: true })

const manifest = JSON.parse(readFileSync(path.join(target, 'manifest.json'), 'utf8'))
const name = JSON.parse(readFileSync(path.join(target, '_locales', 'en', 'messages.json'), 'utf8')).extensionName.message
console.log(`refreshed ${target}`)
console.log(`  name: ${name}`)
console.log(`  version: ${manifest.version}`)
console.log('In Edge: edge://extensions -> dsh Browser Assistant (Edge) -> Reload.')
