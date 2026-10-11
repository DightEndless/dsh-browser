/**
 * Release bundled browser extension files to ~/.dsh/browser-extension on startup.
 *
 * This provides zero-config unpacked extension readiness: when the bridge
 * plugin is installed into DSH, it unpacks the bundled extension to the standard
 * directory so the user only has to click "Load unpacked" once in their browser.
 *
 * @module
 */
export declare const EXTENSION_VERSION_FILE = ".dsh-extension-version";
export interface ExtensionReleaseResult {
    status: 'installed' | 'up-to-date' | 'failed';
    sourceDir: string;
    targetDir: string;
    version: string;
    error?: string;
}
export interface ExtensionReleaseOptions {
    sourceDir?: string;
    targetDir?: string;
    logger?: {
        info?: (msg: string) => void;
        warn?: (msg: string) => void;
        error?: (msg: string) => void;
    };
}
/**
 * Determine the default source directory containing the bundled extension.
 */
export declare function defaultExtensionSourceDir(): string;
/**
 * Determine the default target directory under the active DSH home.
 */
export declare function defaultExtensionTargetDir(): string;
/**
 * Release the bundled extension to the destination directory if not already current.
 * Idempotent: checks .dsh-extension-version against bundled manifest version.
 * Safe: catches filesystem errors without throwing, logging a warning instead.
 */
export declare function releasePackagedExtension(options?: ExtensionReleaseOptions): ExtensionReleaseResult;
//# sourceMappingURL=extension-release.d.ts.map