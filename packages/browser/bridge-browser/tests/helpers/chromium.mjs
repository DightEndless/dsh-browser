import { access, readdir, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

export { chromium }

async function executable(path) {
  if (typeof path !== 'string') return undefined
  const cleanPath = path.trim().replace(/^["']|["']$/g, '')
  if (cleanPath === '') return undefined
  try {
    const s = await stat(cleanPath)
    if (!s.isFile()) return undefined
    await access(cleanPath, constants.X_OK)
    return cleanPath
  } catch {
    return undefined
  }
}

export function playwrightCacheRoot({ platform = process.platform, env = process.env, home = homedir(), cwd = process.cwd() } = {}) {
  const configured = env.PLAYWRIGHT_BROWSERS_PATH?.trim()
  if (configured !== undefined && configured !== '' && configured !== '0') {
    return isAbsolute(configured) ? configured : resolve(cwd, configured)
  }
  if (platform === 'darwin') return join(home, 'Library', 'Caches', 'ms-playwright')
  if (platform === 'win32') return join(env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'ms-playwright')
  return join(env.XDG_CACHE_HOME ?? join(home, '.cache'), 'ms-playwright')
}

/**
 * Returns candidate root directories where Playwright-managed or custom-cached
 * browser binaries might reside.
 *
 * Search precedence:
 * 1. Explicit `PLAYWRIGHT_BROWSERS_PATH` environment variable (highest priority).
 * 2. Monorepo/workspace-level `.browsers` directories:
 *    When working within monorepo workspaces (such as `D:\dsh-browser-hunt\.browsers`
 *    or a repository-root `.browsers`), test runners or developers often place
 *    pre-downloaded browsers in a root folder. We walk upward (up to 5 directory
 *    levels) from both the current module's directory and the current process working
 *    directory (`cwd`) to locate any such workspace `.browsers` caches without requiring
 *    manual environment configuration. Note: this upward scan assumes execution takes
 *    place within the workspace tree; if running outside, standard Playwright cache roots apply.
 * 3. Platform default Playwright cache root (e.g. `%LOCALAPPDATA%\ms-playwright`).
 */
export function candidateBrowserRoots({ platform = process.platform, env = process.env, home = homedir(), cwd = process.cwd() } = {}) {
  const roots = []
  const configured = env.PLAYWRIGHT_BROWSERS_PATH?.trim()
  if (configured !== undefined && configured !== '' && configured !== '0') {
    roots.push(isAbsolute(configured) ? configured : resolve(cwd, configured))
  }
  const metaDir = fileURLToPath(new URL('.', import.meta.url))
  let dir = metaDir
  for (let i = 0; i < 5; i++) {
    roots.push(resolve(dir, '.browsers'))
    dir = resolve(dir, '..')
  }
  dir = cwd
  for (let i = 0; i < 5; i++) {
    roots.push(resolve(dir, '.browsers'))
    dir = resolve(dir, '..')
  }
  roots.push(playwrightCacheRoot({ platform, env, home, cwd }))
  return Array.from(new Set(roots))
}

export function systemBrowserCandidates({ platform = process.platform, requireExtensions = false } = {}) {
  if (platform === 'darwin') {
    return requireExtensions
      ? ['/Applications/Chromium.app/Contents/MacOS/Chromium']
      : [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ]
  }
  if (platform === 'linux') {
    return requireExtensions
      ? ['/usr/bin/chromium', '/usr/bin/chromium-browser']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  }
  return []
}

async function newestPlaywrightChromium({ requireExtensions = false, platform = process.platform, env = process.env, home = homedir(), cwd = process.cwd() } = {}) {
  const roots = candidateBrowserRoots({ platform, env, home, cwd })
  const relativeExecutables = requireExtensions ? [
    ['chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    ['chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    ['chrome-mac', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    ['chrome-mac-arm64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    ['chrome-linux64', 'chrome'],
    ['chrome-linux', 'chrome'],
    ['chrome-win64', 'chrome.exe'],
    ['chrome-win', 'chrome.exe'],
  ] : [
    ['chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    ['chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    ['chrome-mac', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    ['chrome-mac-arm64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    ['chrome-linux64', 'chrome'],
    ['chrome-linux', 'chrome'],
    ['chrome-win64', 'chrome.exe'],
    ['chrome-win', 'chrome.exe'],
    ['headless-shell-mac-arm64', 'headless_shell'],
    ['headless-shell-mac', 'headless_shell'],
    ['headless-shell-linux', 'headless_shell'],
    ['headless-shell-win64', 'headless_shell.exe'],
    ['headless-shell-win', 'headless_shell.exe'],
  ]
  for (const cacheRoot of roots) {
    let entries
    try {
      entries = await readdir(cacheRoot, { withFileTypes: true })
    } catch {
      continue
    }
    const candidates = entries
      .filter((entry) => entry.isDirectory() && (requireExtensions
        ? /^chromium-/u.test(entry.name)
        : /^(?:chromium|chromium_headless_shell)-/u.test(entry.name)))
      .sort((left, right) => right.name.localeCompare(left.name, undefined, { numeric: true }))

    for (const entry of candidates) {
      for (const parts of relativeExecutables) {
        const found = await executable(join(cacheRoot, entry.name, ...parts))
        if (found !== undefined) return found
      }
    }
  }
  return undefined
}

export async function findChromiumExecutable(
  override = process.env.PLAYWRIGHT_CHROMIUM_PATH,
  { requireExtensions = false, platform = process.platform, env = process.env, home = homedir(), cwd = process.cwd() } = {},
) {
  const explicit = await executable(override)
  if (explicit !== undefined) return explicit
  if (chromium && typeof chromium.executablePath === 'function') {
    try {
      const bundled = await executable(chromium.executablePath())
      if (bundled !== undefined) {
        if (!requireExtensions || !/headless_shell/iu.test(bundled)) {
          return bundled
        }
      }
    } catch {
      // Bundled lookup can throw or fail if browser is not installed in standard location
    }
  }
  const cached = await newestPlaywrightChromium({ requireExtensions, platform, env, home, cwd })
  if (cached !== undefined) return cached
  for (const candidate of systemBrowserCandidates({ platform, requireExtensions })) {
    const found = await executable(candidate)
    if (found !== undefined) return found
  }
  return undefined
}
