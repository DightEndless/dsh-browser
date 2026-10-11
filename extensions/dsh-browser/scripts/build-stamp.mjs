import { createHash } from 'node:crypto'
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'

/**
 * Computes deterministic SHA-256 hash of all extension source inputs.
 */
export function computeSourceHash(extensionDir) {
  const hash = createHash('sha256')
  const trackedItems = [
    'src',
    '_locales',
    'assets',
    'manifest.json',
    'manifest.firefox.json',
    'package.json',
    'vite.background.config.ts',
    'vite.content.config.ts',
    'vite.mainworld.config.ts',
    'vite.panel.config.ts',
    'scripts/build.mjs',
    'scripts/copy-tree.mjs',
    'scripts/build-crash.mjs',
    'scripts/build-stamp.mjs',
  ]

  function walk(relPath) {
    const fullPath = join(extensionDir, relPath)
    if (!existsSync(fullPath)) return
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      const entries = readdirSync(fullPath).sort()
      for (const entry of entries) {
        walk(join(relPath, entry))
      }
    } else if (stat.isFile()) {
      hash.update(relPath.replace(/\\/g, '/') + '\0')
      hash.update(readFileSync(fullPath))
    }
  }

  for (const item of trackedItems) {
    walk(item)
  }
  return hash.digest('hex')
}

export function getGitInfo(repoDir) {
  try {
    const commit = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    let branch = 'unknown'
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoDir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {}
    return { commit, branch }
  } catch {
    return { commit: 'unknown', branch: 'unknown' }
  }
}

export function writeBuildStamp(distDir, extensionDir, repoDir = resolve(extensionDir, '../..')) {
  const sourceHash = computeSourceHash(extensionDir)
  const gitInfo = getGitInfo(repoDir)
  const stamp = {
    builtAt: new Date().toISOString(),
    gitCommit: gitInfo.commit,
    gitBranch: gitInfo.branch,
    sourceHash,
  }
  const stampPath = join(distDir, 'build-stamp.json')
  writeFileSync(stampPath, JSON.stringify(stamp, null, 2) + '\n', 'utf8')
  return stamp
}

export function verifyBuildStamp(distDir, extensionDir, repoDir = resolve(extensionDir, '../..')) {
  const manifestPath = join(distDir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    return {
      valid: false,
      reason: `Extension dist not built at ${distDir}. Run "pnpm --filter dsh-browser-extension run build" (or "pnpm build") first.`,
    }
  }

  const stampPath = join(distDir, 'build-stamp.json')
  if (!existsSync(stampPath)) {
    return {
      valid: false,
      reason: `Extension dist is missing build stamp at ${stampPath}. The artifacts in dist/ are missing or predate build-stamp tracking. Run "pnpm --filter dsh-browser-extension run build" (or "pnpm build") first.`,
    }
  }

  let stamp
  try {
    stamp = JSON.parse(readFileSync(stampPath, 'utf8'))
  } catch (err) {
    return {
      valid: false,
      reason: `Extension build stamp at ${stampPath} is corrupted: ${err.message}. Run "pnpm build" to rebuild.`,
    }
  }

  const gitInfo = getGitInfo(repoDir)
  if (gitInfo.commit !== 'unknown' && stamp.gitCommit !== 'unknown' && stamp.gitCommit !== gitInfo.commit) {
    return {
      valid: false,
      reason: `Extension dist is STALE! Built from commit ${stamp.gitCommit.slice(0, 8)} (${stamp.gitBranch}), but current HEAD is ${gitInfo.commit.slice(0, 8)} (${gitInfo.branch}). Run "pnpm --filter dsh-browser-extension run build" (or "pnpm build") before running tests.`,
      stamp,
      current: gitInfo,
    }
  }

  const currentSourceHash = computeSourceHash(extensionDir)
  if (stamp.sourceHash !== currentSourceHash) {
    return {
      valid: false,
      reason: `Extension dist is STALE! Source files in extensions/dsh-browser have been modified since the last build (source hash ${stamp.sourceHash.slice(0, 8)} != current ${currentSourceHash.slice(0, 8)}). Run "pnpm --filter dsh-browser-extension run build" (or "pnpm build") before running tests.`,
      stamp,
      currentHash: currentSourceHash,
    }
  }

  return {
    valid: true,
    stamp,
  }
}
