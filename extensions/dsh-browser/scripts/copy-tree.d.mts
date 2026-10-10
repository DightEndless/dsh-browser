/**
 * Types for the directory copy the build uses instead of `fs.cpSync`, which
 * crashes on Windows when the destination path contains non-ASCII characters.
 * The module stays plain .mjs because scripts/build.mjs runs it directly under
 * Node, with no TypeScript step; this declaration lets the test import it under
 * `strict` without turning on `allowJs`.
 */

/** Recursively copy `from` into `to`, creating `to` when it does not exist. */
export declare function copyTree(from: string, to: string): void
