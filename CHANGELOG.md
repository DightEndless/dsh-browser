# Changelog

Notable changes to this workspace. Two packages ship from here and are versioned
in the same entry, because a bridge change usually needs a matching extension
change:

- `dsh-browser-extension` — `extensions/dsh-browser`
- `@dightendless/dsh-bridge-browser` — `packages/browser/bridge-browser`

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
