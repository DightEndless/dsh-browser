/**
 * Types for the build's crash classification helper. The helper stays a plain
 * .mjs module because scripts/build.mjs runs it directly under Node, with no
 * TypeScript step; this declaration is what lets the unit test import it under
 * `strict` without turning on `allowJs`.
 */

/** STATUS_STACK_BUFFER_OVERRUN: the exit code the crashing Node version reports. */
export declare const TEARDOWN_CRASH_CODE: number

/** Whether a failed target exited through the Windows teardown crash. */
export declare function isTeardownCrash(status: number | null, signal: string | null): boolean

/** Whether any file under the directory was written at or after the given time. */
export declare function hasFreshOutput(
  directory: string,
  since: number,
  fsModule: { readdirSync: typeof import('node:fs').readdirSync; statSync: typeof import('node:fs').statSync },
): boolean

/** What a finished target means: success, the known Node bug, or a real failure. */
export declare function classifyTarget(
  result: { status: number | null; signal?: string | null },
  outDir: string,
  startedAt: number,
  fsModule: { readdirSync: typeof import('node:fs').readdirSync; statSync: typeof import('node:fs').statSync },
): 'ok' | 'teardown-crash' | 'failed'
