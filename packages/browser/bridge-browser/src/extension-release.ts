/**
 * Release bundled browser extension files to ~/.dsh/browser-extension on startup.
 *
 * This provides zero-config unpacked extension readiness: when the bridge
 * plugin is installed into DSH, it unpacks the bundled extension to the standard
 * directory so the user only has to click "Load unpacked" once in their browser.
 *
 * @module
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'

export const EXTENSION_VERSION_FILE = '.dsh-extension-version'

export interface ExtensionReleaseResult {
  status: 'installed' | 'up-to-date' | 'failed'
  sourceDir: string
  targetDir: string
  version: string
  error?: string
}

export interface ExtensionReleaseOptions {
  sourceDir?: string
  targetDir?: string
  logger?: {
    info?: (msg: string) => void
    warn?: (msg: string) => void
    error?: (msg: string) => void
  }
}

/**
 * Determine the default source directory containing the bundled extension.
 */
export function defaultExtensionSourceDir(): string {
  return resolve(fileURLToPath(new URL('../extension', import.meta.url)))
}

/**
 * Determine the default target directory under the active DSH home.
 */
export function defaultExtensionTargetDir(): string {
  return dshHomePath('browser-extension')
}

/**
 * Prune entries in target directory that no longer exist in source directory.
 * Best-effort: catches filesystem errors without failing the overall update.
 */
function pruneStaleEntries(target: string, source: string): void {
  if (!existsSync(target)) return
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === EXTENSION_VERSION_FILE) continue
    const src = join(source, entry.name)
    const dst = join(target, entry.name)
    if (!existsSync(src)) {
      try {
        rmSync(dst, { recursive: true, force: true })
      } catch {
        // Best-effort cleanup
      }
    } else if (entry.isDirectory()) {
      try {
        const srcStat = statSync(src)
        if (!srcStat.isDirectory()) {
          rmSync(dst, { recursive: true, force: true })
        } else {
          pruneStaleEntries(dst, src)
        }
      } catch {
        // Best-effort cleanup
      }
    }
  }
}

/**
 * Recursively copy directory tree using mkdirSync and copyFileSync.
 * Avoids fs.cpSync due to Node 24 Windows non-ASCII path crash (STATUS_STACK_BUFFER_OVERRUN).
 */
function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name)
    const dst = join(to, entry.name)
    if (entry.isDirectory()) {
      copyTree(src, dst)
    } else if (entry.isFile()) {
      copyFileSync(src, dst)
    }
  }
}

/**
 * Release the bundled extension to the destination directory if not already current.
 * Idempotent: checks .dsh-extension-version against bundled manifest version.
 * Safe: catches filesystem errors without throwing, logging a warning instead.
 */
export function releasePackagedExtension(
  options: ExtensionReleaseOptions = {},
): ExtensionReleaseResult {
  const sourceDir = options.sourceDir ?? defaultExtensionSourceDir()
  const targetDir = options.targetDir ?? defaultExtensionTargetDir()
  const logger = options.logger

  if (!existsSync(sourceDir) || !existsSync(join(sourceDir, 'manifest.json'))) {
    const error = `Bundled extension source not found at ${sourceDir}`
    logger?.warn?.(`browser bridge: ${error}`)
    return {
      status: 'failed',
      sourceDir,
      targetDir,
      version: 'unknown',
      error,
    }
  }

  let version = 'unknown'
  try {
    const manifest = JSON.parse(readFileSync(join(sourceDir, 'manifest.json'), 'utf8'))
    if (typeof manifest.version === 'string' && manifest.version.trim().length > 0) {
      version = manifest.version.trim()
    } else {
      throw new Error('manifest.json does not contain a valid version string')
    }
  } catch (err: any) {
    const error = `Failed to read bundled extension manifest: ${err.message}`
    logger?.warn?.(`browser bridge: ${error}`)
    return {
      status: 'failed',
      sourceDir,
      targetDir,
      version: 'unknown',
      error,
    }
  }

  const versionFile = join(targetDir, EXTENSION_VERSION_FILE)
  const targetManifest = join(targetDir, 'manifest.json')

  if (existsSync(versionFile) && existsSync(targetManifest)) {
    try {
      const existingVersion = readFileSync(versionFile, 'utf8').trim()
      const targetManifestData = JSON.parse(readFileSync(targetManifest, 'utf8'))
      if (existingVersion === version && targetManifestData?.version === version) {
        return {
          status: 'up-to-date',
          sourceDir,
          targetDir,
          version,
        }
      }
    } catch {
      // Version file or manifest unreadable; proceed with update
    }
  }

  try {
    mkdirSync(targetDir, { recursive: true })
    pruneStaleEntries(targetDir, sourceDir)
    copyTree(sourceDir, targetDir)
    writeFileSync(versionFile, `${version}\n`, 'utf8')
    return {
      status: 'installed',
      sourceDir,
      targetDir,
      version,
    }
  } catch (err: any) {
    const error = `Failed to write extension to ${targetDir}: ${err.message}`
    logger?.warn?.(`browser bridge: ${error}`)
    return {
      status: 'failed',
      sourceDir,
      targetDir,
      version,
      error,
    }
  }
}
