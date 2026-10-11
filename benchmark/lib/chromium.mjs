// Re-export shared Chromium discovery helpers from bridge-browser tests.
// Note: benchmark/ is a private dev/test harness package ("private": true),
// while @dightendless/dsh-bridge-browser publishes only files matching its
// "files" whitelist (lib/**, src, cordis.patch.yml) — tests/ is never included
// in published npm artifacts. This cross-package test import is therefore safe
// and stays strictly internal to workspace development.
export * from '../../packages/browser/bridge-browser/tests/helpers/chromium.mjs'
