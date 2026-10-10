/**
 * Crash classification for the extension build.
 *
 * Windows on Node 24.14.0 crashes `vite build` with STATUS_STACK_BUFFER_OVERRUN
 * (0xC0000409) while the process is tearing down: every target prints its
 * "built in Nms" line, writes complete output, and only then dies. The next Node
 * patch release does not do this, so the build must not fail because of it — but
 * it also must not mask a real crash. The two are told apart by the output: a
 * teardown crash leaves fresh artifacts behind, a real crash does not.
 *
 * Exported for unit tests; scripts/build.mjs consumes it.
 */

/** STATUS_STACK_BUFFER_OVERRUN: the exit code this Node version reports. */
export const TEARDOWN_CRASH_CODE = 3221226505

/**
 * Whether a failed target exited through the Windows teardown crash.
 * @param status - exit status reported by spawnSync (null when killed by signal).
 * @param signal - terminating signal, when there was one.
 */
export function isTeardownCrash(status, signal) {
  return process.platform === 'win32' && signal === null && status === TEARDOWN_CRASH_CODE
}

/**
 * Whether any file under the directory was written at or after the given time.
 * @param directory - directory to scan.
 * @param since - epoch milliseconds the target started at.
 * @param fsModule - injectable fs implementation, so the check is testable.
 */
export function hasFreshOutput(directory, since, fsModule) {
  let entries
  try {
    entries = fsModule.readdirSync(directory, { withFileTypes: true })
  } catch {
    return false
  }
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) {
      if (hasFreshOutput(path, since, fsModule)) return true
      continue
    }
    try {
      if (fsModule.statSync(path).mtimeMs >= since) return true
    } catch {
      // A file that vanished mid-scan cannot prove the target succeeded.
    }
  }
  return false
}

/**
 * Decide what a finished target means, given how it exited and what it wrote.
 * @param result - spawnSync result for the target.
 * @param outDir - the target's output directory.
 * @param startedAt - epoch milliseconds the target started at.
 * @param fsModule - injectable fs implementation, so the check is testable.
 * @returns `ok` for success, `teardown-crash` for the known Node bug, `failed` otherwise.
 */
export function classifyTarget(result, outDir, startedAt, fsModule) {
  if (result.status === 0) return 'ok'
  if (isTeardownCrash(result.status, result.signal ?? null) && hasFreshOutput(outDir, startedAt, fsModule)) {
    return 'teardown-crash'
  }
  return 'failed'
}
