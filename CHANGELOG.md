# Changelog

Notable changes to this workspace. Two packages ship from here and are versioned
in the same entry, because a bridge change usually needs a matching extension
change:

- `dsh-browser-extension` — `extensions/dsh-browser`
- `@dightendless/dsh-bridge-browser` — `packages/browser/bridge-browser`

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.3.3 — 2026-10-11

### Added

- **`browser_dialog`: a native JavaScript dialog is handed to the model, not answered for it.**
  `alert`, `confirm`, `prompt` and `beforeunload` freeze the tab's JavaScript thread, and the
  content script that every tool goes through is part of what stops answering. The failure was
  therefore reported as a timeout — twice in a row, with the second message telling the model
  to use the very tool that had just timed out. The debugger channel now reports the dialog
  while it is still cheap to do so (`[Native JS dialog opened: confirm("…")]`, with the
  warning that nothing else will work until it is answered), and `browser_dialog` answers it:
  `action: 'accept'` or `'dismiss'`, plus `promptText` for a prompt — an accepted prompt with
  no text submits the page's own default. Nothing is answered on the model's behalf, the hold
  window is 60 seconds, and after it the dialog can no longer be answered at all, which is
  reported as such. The call goes through the approval prompt like every other
  state-changing tool.
- **CSS-hidden checkboxes and radios are reachable.** A control made invisible the usual way
  (`opacity: 0`, or a zero-sized input behind a styled label) has no snapshot number of its
  own, so it could be read but never clicked. Its visible label is now indexed as the proxy —
  `[4] checkbox "Custom Styled Switch (via label)"` — and clicking or toggling that number
  drives the real input, including the `disabled` case.
- **`browser_click_at` reaches hover-gated and off-screen targets.** The click sends a
  `mouseMoved` first, so a control that ignores a click until it has seen a pointer event now
  responds; and an element outside the viewport is scrolled into view, re-measured, and only
  clicked if it really landed inside — the result says so
  (`(scrolled into view before clicking)`).

### Fixed

- **`browser_reload` could not rescue a frozen tab.** It was routed through the content
  script, which is exactly what a frozen tab cannot answer, so the model received a second
  identical timeout and a message pointing back at `browser_reload`. On a content-script
  timeout it now falls back to browser-level `chrome.tabs.reload`, which resets the page in
  milliseconds. This is also the escape hatch for a pending native dialog.
- **The Windows end-to-end smoke test skipped silently and reported green.** Its Chromium
  discovery hard-coded browser directory names and inner layouts (`chromium-1217`, `chrome-win`)
  and ignored `PLAYWRIGHT_BROWSERS_PATH`, so the one test that loads a built extension into a
  real browser never ran on this platform. Discovery now walks the workspace and the Playwright
  cache for whatever is actually installed.
- **The benchmark suite could not start on Windows.** It spawned `pnpm`, which is a shell
  wrapper rather than an executable, so the backend died with `ENOENT`. It now resolves DSH's
  own entry point and runs it under the current Node.

### Notes

- Both artifacts change in this release. The 0.3.1 and 0.3.2 extension zips differed from
  their predecessors by the manifest version alone; this one carries the four extension
  changes above.
- Developer-only: the L2 harness now refuses to start when `dist/` was built from a different
  commit, or from sources edited since the build. A stale build is indistinguishable from a
  real regression — it produced four false failures before this guard existed.
- `.gitattributes` normalises line endings across the repository (`*.ps1`, `*.cmd` and `*.bat`
  stay CRLF).
## 0.3.2 — 2026-10-11

### Fixed

- **`@deepseek-ai/cordis` no longer pins an alpha host to the rc line.** 0.3.1 widened
  the `dsh-*` peers but left cordis at `~4.0.4`, and that alone kept the install broken:
  every `0.2.1-alpha.1` package declares `peer @deepseek-ai/cordis@~4.0.5-alpha.1`, so npm
  resolved cordis down to 4.0.4 and then failed with `ERESOLVE` on the alpha packages.
  The range is now `~4.0.4 || ~4.0.5-alpha.1`, which the rc line and the alpha line each
  satisfy. Found by installing the published 0.3.1 tarball next to the alpha peers in an
  empty project — the peer check failed there, not in the source tree.

### Notes

- 0.3.1 was published 20 minutes earlier and cannot be republished; the fix ships as
  0.3.2. The two releases are otherwise identical, and the extension is unchanged again:
  its zip differs from 0.3.1 by the manifest version alone.
- Verified after the fix: `npm install @dightendless/dsh-bridge-browser@0.3.2` alongside
  the `0.2.1-alpha.1` peer set resolves with exit 0 in an empty project.

## 0.3.1 — 2026-10-11

### Changed

- **The published package accepts the `0.2.1-alpha` line.** Every `@deepseek-ai/dsh-*`
  peer was pinned to exactly `0.2.0-rc.2`, so a DSH `0.2.1-alpha.1` host — the build the
  plugin marketplace states it verifies against — failed its peer check before the plugin
  ever loaded. The peers are now `0.2.0-rc.2 || >=0.2.1-alpha.1 <0.3.0`: both the rc line
  this tree develops against and the alpha line it is verified against are explicit, which
  is what the marketplace's publishing checklist asks for by name.
- **`@deepseek-ai/dsh-invariants` is an optional peer now.** It has no `0.2.1-alpha.*`
  publication at all (`latest` is `0.0.1-rc.1`, `next` is `0.2.0-rc.2`), and this package
  only imports its types: the companion plugin carries `inject: ['invariants']`, so a host
  without that service never mounts it. Optional keeps the alpha install clean without
  dropping the invariant companion where the service does exist.
- **The READMEs name npm beside the release tarball** — `npm i @dightendless/dsh-bridge-browser`
  — and both language sides carry the runtime note reworded for the alpha line.

### Distribution

- `dightendless-dsh-bridge-browser-0.3.1.tgz` — prebuilt plugin package.
- `dsh-browser-extension-0.3.1.zip` — prebuilt extension (forward-slash zip entries).
- `@dightendless/dsh-bridge-browser@0.3.1` on npm.

### Notes

- The extension and the bridge package are versioned together; no extension code changed
  in this release, so the zip differs from 0.3.0 by its manifest version alone.
- This release removes the install-time blocker. It is not by itself proof that the plugin
  loads on a `0.2.1-alpha.1` host — that load check belongs to the marketplace's own
  verification run.

## 0.3.0 — 2026-10-11

### Fixed

- **An approved pointer action can no longer be redirected by the page.** A snapshot
  number was resolved to a point through the `data-dsh-el` attribute, which any page
  script can read, move, or invent; `browser_click_at`, `browser_hover` and
  `browser_drag` now resolve it through the content script's registry in the
  extension's isolated world instead. Verified live against a forged attribute.
- **A reloaded extension no longer fills the error list.** The content script left in
  open tabs after a reload called into a dead `chrome.runtime`, which throws
  synchronously, so "Extension context invalidated" escaped every `.catch()`. Calls
  out check the context first, and an orphaned selection watcher disposes itself.
- **`browser_batch` answers as failed when a step fails**, carrying the per-step
  report in the message instead of reporting success with the failure in prose.

### Changed

- **The package description is market-facing** (it is what listings and package
  views show first) instead of a sentence an automated evaluator read as "needs an
  API key".
- **Install links point at this release**: the plugin tarball and the extension zip
  both come from `v0.3.0`.

### Distribution

- `dightendless-dsh-bridge-browser-0.3.0.tgz` — prebuilt plugin package.
- `dsh-browser-extension-0.3.0.zip` — prebuilt extension (forward-slash zip entries).
- The `v0.2.0` assets were rebuilt in place so their URLs install the corrected
  README rather than one that pointed at the upstream repository.

## Standalone fork release — 2026-10-10

Distribution changes that make this tree installable on its own, without the
upstream package it was forked from.

### Changed

- **The bridge package is now `@dightendless/dsh-bridge-browser`** (it was
  `@yuxianglin/dsh-bridge-browser`). A profile that carried both this fork and
  the upstream package would have resolved one dependency name twice, and the
  second install would have replaced the first, so the fork takes a name of its
  own. The plugin id (`bridge-browser`), every tool name, and the token file at
  `~/.dsh/ext-bridge-token` are unchanged, so an installed extension keeps
  working and needs no re-pairing.
- **The installers fetch this fork.** `scripts/install.ps1` and
  `scripts/install.sh` still download a source archive, build both packages,
  register the bridge, and hand the extension to the browser; only the
  repository they read from changed, so the advertised one-liner installs this
  tree.
- **`cordis.patch.yml` no longer uses the `!!js` tag.** The two
  environment-driven config rows are still documented in the file as something
  to add back deliberately; the shipped patch is plain YAML, so it also parses
  in a standard YAML reader.

### Added

- **A `prepare` script in the bridge package.** A git install ships no build
  output, so without it the profile installs the plugin and then fails to load
  its entry point; `pnpm install` now builds the package itself.

### Fixed

- **The extension build died on Windows under Node 24.14.0.** Every vite target
  printed its result, wrote its files, and then the process exited with
  STATUS_STACK_BUFFER_OVERRUN, so a complete build was reported as a failure and
  the release only had the first target's output. The build now starts vite
  through Node's own entry point instead of the `node_modules/.bin` shell shim,
  and separates that teardown crash from a real failure by whether the target
  actually wrote output. A later Node release does not crash at all.

## Unreleased — 2026-10-10

### Fixed

- **`browser_screenshot` could not take a viewport capture.** Every call failed
  with a permission error about `<all_urls>`/`activeTab`, even with the
  extension's site access set to all sites, because `captureVisibleTab` needs
  that permission for the photographed tab. It now falls back to the DevTools
  protocol, which the extension may use through its `debugger` permission and
  which reads the same viewport from the renderer; the answer says which route
  produced the image. The viewport path had no test at all — the mock chrome did
  not even define `captureVisibleTab` — so both that and the mime it built
  (`image/image/jpeg`) went unnoticed; both are now pinned by tests.
- **`fullPage: true` repeated the page instead of capturing it.** A clip
  rectangle taller than the viewport does not extend the captured area: the
  compositor repainted the current screenful into everything below the fold, so a
  long page came back as the same slice stacked down the image, at the device
  pixel ratio rather than CSS pixels. The capture now grows the layout viewport to
  the measured page height, waits for the reflow, shoots, and then restores the
  scroll position and clears the override, so a 5144px page yields a 5144px image
  and the reader is left where they were.
- **`browser_upload` attached nothing.** The bridge read the file in a second
  message sent after the approval, but the extension never received that message,
  and the four dispatch sites never named the approval the bridge was waiting for,
  so every upload timed out no matter what the user answered. The bridge now reads
  the file up front and the approved dispatch carries the bytes, which makes the
  seam work across version mismatches in either direction. A failed upload names
  the missing file instead of blaming the page.
- **A lost tab binding was a dead end.** When the stored tab was gone, every page
  tool answered "The controlled tab was closed" and no prompt was shown, so a
  session could not recover on its own. A stale binding is now re-established on
  the next tool call and adopts the tab the user is actually looking at; the guard
  refuses only when another session already holds a *different* page.

### Removed

- The unused `tool.approved` / `tool.upload` protocol frames, the extension-side
  waiter that held them, and the temporary upload diagnostics. Nothing on either
  side sends or reads them.

### Tests

- Batch coverage for `browser_batch` with `snapshot: true`, a lifecycle test for
  recovered bindings, and an upload test that asserts the bytes the bridge read
  reach the dispatch. The batch privacy test now uses `browser_eval`, because the
  whitelist rejected its previous `browser_snapshot` step before the privacy gate
  could be the thing under test.

## Extension 0.3.0 / bridge package 0.2.0 — 2026-10-09

### Added

- **Whole-page screenshots.** `browser_screenshot` takes `fullPage: true` and
  composes the entire scrollable document into one image through the DevTools
  protocol, instead of forcing a scroll-then-shoot round trip per screenful. The
  pixels come from the renderer rather than from the window, so this form also
  needs no tab activation and does not pull the user away from what they were
  reading. A capture stops at 16 000 CSS pixels of height and says so when it
  does.
- **`browser_hover`** rests the pointer on an element or a viewport point with a
  protocol mouse move, so menus, tooltips, and previews that only appear on hover
  actually appear. The move is sent twice, because some menus ignore the entry
  event, and the call settles briefly before answering so the page has time to
  react. Read the result with a following snapshot.
- **`browser_drag`** presses, moves along an interpolated path, and releases —
  the shape sliders, sortable lists, canvas handles, and map panes actually read.
  Jumping straight from press to release would look like a teleport, if the page
  saw a move at all. Each end is addressed by element index or viewport fractions.
- **`browser_batch`** runs a list of page actions inside one call, so a sequence
  that is already known costs one round trip instead of one per step. Steps run
  in order and stop at the first failure unless `stopOnError: false`; the last
  step can append the page state with `snapshot: true`. Tab-collection tools and
  navigation are rejected inside a batch, which keeps one batch on one page.
- **Point tools now take an element index.** `browser_click_at`, `browser_hover`,
  and `browser_drag` resolve an index through the `data-dsh-el` numbering the
  snapshot already writes onto inventoried elements, so a target no longer has to
  be located by eye from a screenshot. An element that has left the page, or one
  that sits outside the viewport, is reported instead of acted on.

### Changed

- **`browser_eval` runs with a user gesture.** Clipboard writes, fullscreen
  requests, and media playback are gated on transient activation, which a bare
  `Runtime.evaluate` never carries. The flag lets an expression do what a click
  could have done.
- **One approval covers a whole batch.** The batch's own prompt lists every step
  it will run by reusing the per-tool summaries, and the inner dispatch does not
  prompt again. The page-content privacy gate is a separate condition and still
  applies to every step, so turning prompts off inside a batch cannot widen what
  may leave the page.

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
