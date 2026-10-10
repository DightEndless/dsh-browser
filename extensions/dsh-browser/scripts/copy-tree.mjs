/**
 * Copy a directory tree without fs.cpSync.
 *
 * Node 24.14.0 on Windows dies with STATUS_STACK_BUFFER_OVERRUN inside
 * fs.cpSync when the destination path contains characters outside ASCII, which
 * is any checkout living under a path like `dsh工作区`. The crash takes the whole
 * process with it: in the extension build that happens after vite has written
 * the JS bundles and before the manifest's static files are copied, so the build
 * looks successful while the extension is missing its icons and locale catalogs
 * — and Chrome refuses to load an extension whose `default_locale` has no
 * catalog. `mkdirSync`, `copyFileSync`, and a plain directory walk are all
 * unaffected by that path shape, so the tree is walked by hand.
 *
 * Exported for the build and for unit tests; scripts/build.mjs and
 * vite.shared.ts both use it.
 */

import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Recursively copy `from` into `to`, creating `to` when it does not exist.
 * @param from - source directory.
 * @param to - destination directory; existing files are overwritten.
 */
export function copyTree(from, to) {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name)
    const destination = join(to, entry.name)
    if (entry.isDirectory()) copyTree(source, destination)
    else copyFileSync(source, destination)
  }
}
