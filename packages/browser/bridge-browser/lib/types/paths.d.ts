/**
 * Tiny path helpers shared by the bridge plugin and its tests.
 *
 * @module
 */
/** Whether the current process runs on Windows. */
export declare const isWindows: boolean;
/**
 * Whether POSIX permission bits are meaningful here. Windows reports synthetic
 * modes (`0o666`) for every file, so tests that assert `0600` must skip there.
 */
export declare const supportsPosixFileMode: boolean;
//# sourceMappingURL=paths.d.ts.map