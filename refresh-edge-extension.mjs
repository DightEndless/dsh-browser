/**
 * Re-copy the built Edge extension into the folder Edge loads it from.
 *
 *   node refresh-edge-extension.mjs
 *
 * Run this after rebuilding with `node scripts/build.mjs --edge` (from
 * extensions/dsh-browser). Edge reloads an unpacked extension from this folder,
 * so point the browser at this path once; later refreshes need a click on the
 * reload button in edge://extensions.
 *
 * The folder follows DSH_HOME when that is set and `~/.dsh` otherwise, the same
 * way the bridge and the installer resolve it; the previous version fell back to
 * a hard-coded `C:\Users\<one name>`. The copy goes through the extension build's
 * copyTree rather than fs.cpSync, which dies on this Node version when the
 * destination path holds non-ASCII characters.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyTree } from './extensions/dsh-browser/scripts/copy-tree.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const dist = join(root, 'extensions', 'dsh-browser', 'dist')
const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const target = join(dshHome, 'browser-extension-edge')

if (!existsSync(dist)) {
  console.error(`build output missing: ${dist}\nrun: cd extensions/dsh-browser && node scripts/build.mjs --edge`)
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
copyTree(dist, target)

const manifest = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'))
const name = JSON.parse(readFileSync(join(target, '_locales', 'en', 'messages.json'), 'utf8')).extensionName.message
console.log(`refreshed ${target}`)
console.log(`  name: ${name}`)
console.log(`  version: ${manifest.version}`)
if (typeof manifest.key !== 'string') {
  // The Edge build is the same bundle with its own public key, so the browser
  // gives it a stable id of its own; a dist without that key is the Chrome
  // build, which Edge would then install as a second copy of the same add-on.
  console.warn('  warning: this build carries no Edge key — rebuild with `node scripts/build.mjs --edge` first')
}
console.log('In Edge: edge://extensions -> dsh Browser Assistant (Edge) -> Reload.')
