import { copyManifest, outDir, targetBuild } from './vite.shared.ts'

/**
 * Page main-world companion: classic script, and the one target that must run
 * outside the isolated world so `javascript:` activations are not discarded.
 */
export default targetBuild('src/content/main-world.ts', 'iife', 'main-world.js', false)

export { copyManifest, outDir }
