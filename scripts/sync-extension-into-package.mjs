#!/usr/bin/env node
/**
 * Synchronize the built browser extension artifacts from extensions/dsh-browser/dist
 * into packages/browser/bridge-browser/extension/ for packaging with the bridge plugin.
 *
 * Walks the source tree recursively with readdirSync and copyFileSync rather than
 * fs.cpSync to avoid the Node 24 Windows non-ASCII path crash (STATUS_STACK_BUFFER_OVERRUN).
 */

import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourceDir = resolve(repoRoot, 'extensions/dsh-browser/dist')
const targetDir = resolve(repoRoot, 'packages/browser/bridge-browser/extension')

export function syncExtension(source = sourceDir, target = targetDir) {
  if (!existsSync(source) || !existsSync(join(source, 'manifest.json'))) {
    throw new Error(
      `Source extension dist not found at ${source}. Run "pnpm --filter dsh-browser-extension run build" (or "pnpm build") first.`
    )
  }

  // Remove existing target files to ensure stale artifacts are pruned.
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true })
  }
  mkdirSync(target, { recursive: true })

  let copiedCount = 0

  function copyTree(from, to) {
    mkdirSync(to, { recursive: true })
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (entry.name === 'build-stamp.json') {
        // Exclude ephemeral dev build stamp from the published package extension.
        continue
      }
      const srcPath = join(from, entry.name)
      const dstPath = join(to, entry.name)
      if (entry.isDirectory()) {
        copyTree(srcPath, dstPath)
      } else if (entry.isFile()) {
        copyFileSync(srcPath, dstPath)
        copiedCount += 1
      }
    }
  }

  copyTree(source, target)
  return { copiedCount, target }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = syncExtension()
  console.log(`Synced ${result.copiedCount} extension files to ${result.target}`)
}
