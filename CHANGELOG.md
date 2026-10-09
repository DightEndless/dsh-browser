# Changelog

Notable changes to this workspace. Two packages ship from here and are versioned
in the same entry, because a bridge change usually needs a matching extension
change:

- `dsh-browser-extension` — `extensions/dsh-browser`
- `@yuxianglin/dsh-bridge-browser` — `packages/browser/bridge-browser`

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Extension 0.2.0 / bridge package 0.1.0 — 2026-10-09

### Added

- **`browser_screenshot`** captures the visible area of the controlled tab, saves
  it as a local image file, and returns that path. The bridge stays text-only on
  the wire: the extension ships base64 in the tool result and the DSH side is the
  only place that turns it into a file, so the image bytes never reach the model —
  only a path it can open. Use it when the page's meaning is visual (captcha,
  chart, layout) or when the picture itself is out of reach (inline `data:` URLs,
  CSS background images, login-gated images).
- **`browser_upload`** attaches a local file to an `<input type=file>` by path. A
  file input cannot be filled from script, so the bytes travel from the DSH side
  and are rebuilt into a real `File` through a `DataTransfer` list — the same
  shape a drop or paste produces. Reads are capped at 8 MB, the approval prompt
  names the file, and the result reports only its name and size.
- **`browser_eval`** evaluates a JavaScript expression in the controlled tab and
  returns its value. MV3 forbids `eval` for extension code, so the page's own
  engine is the only place an expression can run: the extension attaches to the
  DevTools protocol, evaluates, and detaches again on every call rather than
  holding a session open. That needs the `debugger` permission and puts a
  browser-level "being controlled" banner on screen while a call runs. Every call
  is approved on its own and the expression is shown in full in that prompt.
- **`browser_click_at`** clicks a viewport point with **trusted** mouse input over
  the same protocol. Event dispatch from a content script is not trusted input,
  so pages that check `isTrusted` ignore it, and a target with no element to
  address — a spot inside an image — cannot be reached by inventory number at all.
  Callers give `x`/`y` as viewport fractions, which is how a screenshot maps back
  onto the page regardless of device pixel ratio.
- **`browser_wait`** takes `selector`, `text`, `gone`, and `timeoutMs`, so a call
  can wait for a condition instead of a fixed delay, and reports a clear timeout
  rather than hanging.
- **`browser_type`** can choose a `<select>` option — matching the visible label
  first, then the value, and listing the available options when nothing matches —
  and can check or uncheck checkboxes and radios (`true`/`false`).
- A **per-tab lock** serializes page tools, so two sessions cannot interleave
  clicks and typing on the same page. The second caller fails fast with an
  explanation instead of queueing behind a long timeout.
- **Firefox** now declares the MAIN-world companion content script in
  `manifest.firefox.json`, so `javascript:` links behave the same as on Chromium.
  (`world` is available from Firefox 128; this extension requires 140.)

### Changed

- **`browser_press`** now reproduces the default action a real key press would
  have: `Tab` moves focus following the page's tab order (`Shift+Tab` backwards),
  and `Enter`/`Space` submit the surrounding form or activate the focused control.
  Form submission goes through `requestSubmit`, so validation runs. If the page
  calls `preventDefault`, the bridge stays out of the way.

### Fixed

- A content script that accepted a message but never answered — a frozen or
  discarded tab, or a stuck page script — used to hang until the bridge's full
  timeout with no explanation. The round trip is now bounded and the failure
  names the likely cause and the next step (`browser_reload`, then a fresh
  snapshot).
- The page-sharing privacy boundary still runs before any tab access; the new
  lock was moved behind it after the existing test caught the regression.

### Removed

  build), and the `main-world` companion no longer rewrites `confirm`/`alert` on
  trace of either.
