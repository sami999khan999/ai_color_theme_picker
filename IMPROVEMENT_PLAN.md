# Improvement Plan — Color Theme Picker (Theme AI)

## Overview

This document is a remediation plan for the `ai_color_theme_picker` Chrome extension, produced from a
full read of every source file in the repository.

**What the project is today:** a Manifest V3 Chrome extension, ~2,800 lines of dependency-free
vanilla JavaScript in a single commit. The popup scrapes colors from the active tab via
`chrome.scripting.executeScript`, sends them to Google Gemini with a large prompt, streams the
response back, and extracts `:root` / `.dark` blocks of shadcn/Tailwind CSS variables. A hand-written
bundler (`build.js`) concatenates seven source files into `dist/popup.js` in a fixed order.

**What the audit found:** the extension works for the happy path, but it ships a
privilege-escalating XSS in the popup, injects a completely dead content script into every page the
user visits, and runs a page scan that can freeze a large tab for seconds. Below those are a series
of concrete functional bugs, a total absence of tooling/tests/CI, and a README that misdescribes the
code in four places.

The work is organized into **seven phases**, ordered so that each one is independently shippable and
earlier phases de-risk later ones. Phases 1–3 are corrective; 4–5 build the safety net and fix the
docs; 6–7 improve the product.

---

## How to use this plan

Each phase has a goal, a checklist, and exit criteria. Check items off as they land. Every task cites
the file and line where the problem lives, so tasks can be picked up independently.

**Severity key**

| Badge | Meaning |
| --- | --- |
| 🔴 **Critical** | Security hole or data loss. Fix before any public release. |
| 🟠 **High** | Broken behavior users will hit in normal use. |
| 🟡 **Medium** | Degraded experience, fragility, or maintainability debt. |
| 🟢 **Low** | Polish, docs, and nice-to-haves. |

**Verifying any change**

```bash
node build.js                         # regenerate dist/popup.js
# then: chrome://extensions → Developer mode → Reload → open the popup
```

`dist/popup.js` is a committed build artifact. **Editing `src/` without re-running `node build.js`
changes nothing at runtime** — the popup loads `dist/popup.js`, not the sources. Re-run the build and
commit the result with every change.

---

## Phase 1 — Security & Permission Hardening

> **Goal:** close the XSS, remove the unused code that is injected into every page the user browses,
> and stop leaking the API key into URL-shaped logs. Nothing else should ship before this phase does.

- [x] 🔴 **Fix the XSS in the saved-key list.** `src/popup/api-keys.js:16-28` interpolates `item.name`
      — free-form user input — directly into `element.innerHTML`. A key named
      `<img src=x onerror="...">` executes in the popup's privileged context, which has access to
      `chrome.storage.local` where **every saved API key is stored in plaintext**. Rebuild the row
      with `document.createElement` and `textContent`; reserve `innerHTML` for the trusted `ICONS.*`
      SVG constants from `src/shared/icons.js`.
- [x] 🔴 **Delete the dead content-script layer.** `manifest.json:14-19` injects
      `src/content/content.js` into `<all_urls>`, which injects `src/content/inject.js` into every
      page's main world on every page load. Nothing ever sends the `CALL_AI_VIA_INJECTION` message
      that would activate it — the string appears only at `src/content/content.js:17` — and nothing
      listens for the `AI_RESPONSE_FROM_PAGE` reply. The entire `src/content/` tree is unreachable
      from the popup yet runs everywhere. Remove the directory, the `content_scripts` block, and the
      `web_accessible_resources` block. This also drops the "read and change all your data on all
      websites" warning shown at install.
- [x] 🔴 **Do not reintroduce unvalidated `postMessage`.** For the record of why the above is not just
      dead weight: `src/content/content.js:28` accepts `FROM_PAGE_CONTEXT` messages with no origin
      check, and both sides post with a `'*'` target origin. Any page could forge an AI response or
      read the relayed prompt. Resolved by deletion; noted so the bridge is not rebuilt this way.
- [x] 🟠 **Move the API key out of the URL.** `src/popup/generator.js:171` sends it as
      `?key=${geminiApiKey}`. Pass it in the `x-goog-api-key` header instead, so it stays out of
      anything that records request URLs.
- [x] 🟠 **Declare `host_permissions`.** `manifest.json:13` lists only
      `["storage","clipboardWrite","activeTab","scripting"]` — no host permissions at all. The call to
      `generativelanguage.googleapis.com` currently succeeds only because that endpoint returns
      permissive CORS headers, which is a dependency on someone else's server config. Add
      `"host_permissions": ["https://generativelanguage.googleapis.com/*"]`.
- [x] 🟡 **Stop fetching fonts from a third party.** `src/popup/popup.html:8-10` loads Plus Jakarta
      Sans from `fonts.googleapis.com` every time the popup opens. That is a third-party request on
      every use, it contradicts the "No Tracking" claim in `README.md:78`, and it leaves the popup on
      a fallback font when offline. Self-host the `.woff2` under `assets/` or switch to a system font
      stack.
- [x] 🟡 **Declare an explicit CSP.** `manifest.json` has no
      `content_security_policy.extension_pages` entry. Add one rather than relying on the MV3 default.

**Exit criteria:** a key named `<img src=x onerror=alert(1)>` renders as literal text; `src/content/`
is gone and the install prompt no longer requests all-site access; the key travels in a header; the
extension still generates a theme end to end.

---

## Phase 2 — Correctness Bugs

> **Goal:** fix the defects a user hits in normal operation — spurious errors on open, duplicate
> generations, truncated themes, and misreported failures.

- [x] 🟠 **Fix or remove `performInitialScan`.** `src/popup/generator.js:1-13` has two problems.
      First, `chrome.tabs.query` and `tab.url.startsWith('chrome://')` sit **outside** the `try`
      block, so a tab whose `url` is unreadable throws a `TypeError` that escapes as an unhandled
      rejection into the global handler at `src/popup/init.js:42` and paints a spurious error strip
      the moment the popup opens. Second, the scan result is assigned to a local `pageColors` and
      then **discarded** — a full-page color sweep runs on every popup open and is thrown away.
      Either delete the function outright, or guard `!tab.url` and cache the result for
      `handleGenerate` to reuse.
- [x] 🟠 **Prevent double generation.** `src/popup/generator.js:281-286` invokes `handleGenerate`
      straight from the keydown handler without consulting `isGenerating`. That flag
      (`src/popup/state.js:51`) is assigned in two places and **never read anywhere in the codebase**.
      Two quick keypresses start two concurrent streams that race to write the same DOM. Check the
      flag at the top of `handleGenerate` and return early.
- [x] 🟠 **Stop hijacking Shift+Enter.** The same handler treats a bare `shiftKey` as submit, so users
      cannot type a newline in the prompt textarea — the one place a multi-line input is expected.
      Restrict the shortcut to Ctrl/Cmd+Enter and update the hint at `src/popup/popup.html:76`.
- [x] 🟠 **Fix the CSS block extractor.** `src/popup/generator.js:246-247` uses non-greedy
      `/:root\s*{([\s\S]+?)}/`. The first `}` terminates the match, so any nested block or `@media`
      wrapper in the model output silently truncates the theme to a fragment, and the user is told
      generation succeeded. Replace both regexes with a brace-counting extractor that finds the
      matching close brace.
- [x] 🟠 **Fix the invalid alpha syntax in the prompt.** `src/popup/generator.js:108-109` and `:122`
      instruct the model to emit `--border: <color> / <opacity>`. Combined with rule 2 at `:162`
      ("FULLY WRAPPED, VALID CSS color values"), this reliably produces uncompilable CSS such as
      `rgb(1, 2, 3) / 0.1`. The correct shadcn form places alpha inside the color function:
      `oklch(1 0 0 / 10%)`. Rewrite the skeleton accordingly.
- [x] 🟠 **Report blocked responses honestly.** The stream loop reads only
      `candidates[0].content.parts[0].text` and swallows every exception at
      `src/popup/generator.js:229` with an empty `catch`. When Gemini returns a `promptFeedback.
      blockReason` or `finishReason: "SAFETY"`, `fullText` stays empty and the user sees "couldn't
      parse the CSS colors" — pointing them at their prompt wording instead of the real cause. Read
      those fields and surface them.
- [x] 🟡 **Fix the copy-button label corruption.** `src/shared/utils.js:44-50` stores
      `element.innerHTML` in `original` at click time. A second click inside the 1,500 ms window
      captures the *"Copied"* markup as `original`, so the button is permanently relabeled. Capture
      the label once at init, or ignore clicks while the timer is pending.
- [x] 🟡 **Stop suppressing the console.** `src/popup/init.js:37-40` returns `true` from
      `window.onerror`, which cancels the default logging. Every runtime error becomes invisible in
      DevTools — the reason several bugs in this list could persist unnoticed. Log the error before
      returning.
- [x] 🟡 **Replace substring-based error classification.** `src/shared/utils.js:17` maps *any* message
      containing the substring `key` to "Invalid API Key", and `:10` maps any `limit` to a quota
      message — so an unrelated error mentioning a JSON key is reported as an auth failure. Capture
      the HTTP status at the fetch site in `generator.js` and branch on that instead.
- [x] 🟢 **Resolve the `⌘G` discrepancy.** `src/popup/popup.html:103` renders `<kbd>⌘G</kbd>` and
      `README.md:30` documents `⌘G` / `Ctrl+G`, but no handler for it exists anywhere. Either
      implement it through a `manifest.json` `commands` entry or remove the claim from both places.

**Exit criteria:** opening the popup on a `chrome://` tab shows no error; holding Ctrl+Enter starts
exactly one generation; Shift+Enter inserts a newline; a response containing a nested block yields a
complete theme; a safety-blocked response reports the block reason.

---

## Phase 3 — Performance & Reliability

> **Goal:** stop the page scan from freezing large tabs, and make the network call resilient.

- [x] 🟠 **Make the color scan fast.** `src/shared/utils.js:98-108` calls
      `document.querySelectorAll('*')`, runs `getComputedStyle` on every element, and for each of five
      properties calls `toHex` — which does a canvas `fillRect` plus a `getImageData` round-trip
      (`utils.js:66-71`). On a 10,000-element page that is ~50,000 `getImageData` calls, each of which
      forces a readback: seconds of blocked main thread on a page the user is looking at. Three fixes,
      in order of impact:
  - [x] Memoize `toHex` in a `Map` keyed on the raw color string. Real pages reuse a handful of colors
        across thousands of elements, so the hit rate is very high and this alone removes most of the
        cost.
  - [x] Bail out before touching the canvas for `transparent`, `none`, and `rgba(0, 0, 0, 0)` — the
        guard at `utils.js:63` already identifies them but still falls through for everything else.
  - [x] Stop traversing once the 60-color cap at `utils.js:115` is reached, rather than scanning every
        element and slicing at the end.
- [x] 🟡 **Switch the stream to `?alt=sse`.** `src/popup/generator.js:171` omits it, so the response is
      a raw JSON array. That forces the 55-line hand-rolled brace-matching scanner at
      `generator.js:196-238`, which additionally restarts its scan from index 0 after every extracted
      object. Appending `&alt=sse` yields newline-delimited `data:` frames and lets most of that code
      be deleted.
- [x] 🟡 **Add a timeout and cancellation.** The fetch at `generator.js:171` has no `AbortController`.
      A stalled stream leaves the spinner spinning with no way out but closing the popup. Add a
      timeout, and wire the controller to a Cancel button in the generating view.
- [x] 🟢 **Retry transient failures.** `src/shared/utils.js:27` already has user-facing copy for
      "Gemini is currently busy" — back it with an actual retry-with-backoff on `429` and `503`.

**Exit criteria:** scanning a large content-heavy page (e.g. a long Wikipedia article) completes
without a visible freeze; a stalled request times out with a clear message instead of hanging.

---

## Phase 4 — Build, Tooling & Tests

> **Goal:** make the project safe to change. There is currently no way to know a change broke
> something short of manually clicking through the popup.

- [ ] 🟡 **Add a `.gitignore`.** The repository has none.
- [ ] 🟡 **Decide and document the `dist/` policy.** `dist/popup.js` is committed, and it **must
      remain committed** — `Load unpacked` has to work from a clean clone, and `src/popup/popup.html:184`
      loads `../../dist/popup.js` directly. The risk is drift: an edit to `src/` that is not rebuilt
      silently does nothing. Add a build check that fails when the committed bundle does not match a
      fresh build of `src/`.
- [ ] 🟡 **Add a `package.json`** with `build`, `lint`, and `test` scripts, so the project has a
      conventional entry point. Keep runtime dependencies at zero — that constraint is a genuine
      strength of this codebase and worth preserving.
- [ ] 🟡 **Add ESLint (with the `webextensions` environment) and Prettier.** There is no linter or
      formatter today. A linter would have caught the unread `isGenerating` and the unused
      `pageColors` in Phase 2 automatically.
- [ ] 🟡 **Add tests.** There are none. `node --test` keeps the dependency count at zero. Start with
      the pure logic, which is the highest-value and easiest to cover:
  - [ ] `getFriendlyError` (`src/shared/utils.js:1`) — one case per branch, including the
        misclassification fixed in Phase 2.
  - [ ] The new brace-counting CSS extractor — nested blocks, `@media` wrappers, missing `.dark`.
  - [ ] `renderPalette`'s variable regex (`src/popup/ui.js:97`) and its raw-number fallback at `:111`.
  - [ ] `toHex` (`src/shared/utils.js:62`) against a stubbed canvas context, including the CSP
        fallback path at `:73`.
- [ ] 🟡 **Add CI** at `.github/workflows/ci.yml` — the repo has no `.github/` directory. Run build,
      lint, and test on push and PR, and assert the committed `dist/popup.js` matches a fresh build.
- [ ] 🟢 **Note the ES-module migration path.** `build.js:18-26` depends on a hand-maintained file
      order, and every module communicates through mutable globals declared in `src/popup/state.js`.
      Moving to real ES modules with `type="module"` in `popup.html` would remove the custom bundler
      entirely. Record it as a follow-up; do not block this phase on it.

**Exit criteria:** `npm run build && npm run lint && npm test` passes locally and in CI, and CI fails
when `dist/` is stale.

---

## Phase 5 — Documentation Accuracy

> **Goal:** the README currently describes a codebase that does not exist. Fix every claim.

- [ ] 🟢 **Wrong model name.** `README.md:13` says "Gemini 1.5 Flash"; `src/popup/generator.js:171`
      calls `gemini-2.5-flash`.
- [ ] 🟢 **Non-existent directory.** `README.md:41` documents `src/init/`. No such directory exists —
      the file is `src/popup/init.js`.
- [ ] 🟢 **Wrong description of `src/content/`.** `README.md:40` calls it "high-performance scripts for
      non-invasive DOM scanning and color extraction". The content scripts do no scanning whatsoever;
      extraction happens via `chrome.scripting.executeScript` from the popup
      (`src/popup/generator.js:49`). This section disappears with the deletion in Phase 1.
- [ ] 🟢 **Unimplemented shortcut.** `README.md:30` documents `⌘G` / `Ctrl+G`, which does not exist
      (see Phase 2).
- [ ] 🟢 **Overstated key security.** `README.md:23` calls the key store "Secure Profiles". Keys are
      stored unencrypted in `chrome.storage.local`. State that plainly.
- [ ] 🟢 **Document the build-then-reload loop** prominently — editing `src/` alone has no effect.
- [ ] 🟢 **Add `LICENSE`, `CONTRIBUTING.md`, and a `CLAUDE.md`.** None exist.

**Exit criteria:** every factual statement in `README.md` is verifiable against the code.

---

## Phase 6 — Accessibility & UX Polish

> **Goal:** make the popup usable by keyboard and screen reader, and stop it losing user data.

- [ ] 🟠 **Make the format dropdown accessible.** `src/popup/popup.html:82-97` builds it entirely from
      `<div>`s with no `role`, `aria-expanded`, `aria-selected`, or `tabindex`, and
      `src/popup/ui.js:129-160` binds only `onclick`. It is unreachable by keyboard and invisible to
      screen readers. Either add full listbox semantics with arrow-key handling, or replace it with a
      styled native `<select>`.
- [ ] 🟠 **Confirm before deleting a key.** `src/popup/api-keys.js:33` wires delete directly to a
      single click with no confirmation, and `deleteKey` at `:48` removes it immediately. One misclick
      loses a key permanently, and there is no way to view a stored key to recover it.
- [ ] 🟡 **Announce errors, and stop hiding them.** `#error-display` (`src/popup/popup.html:177`) has
      no `role="alert"`, so screen readers never announce it. The 4-second and 6-second auto-hide
      timers at `src/popup/ui.js:44` and `:84` also dismiss messages mid-read. Add the role and
      replace the timers with a manual dismiss.
- [ ] 🟡 **Manage focus across views.** `showView` (`src/popup/ui.js:5-30`) toggles a `.hidden` class
      and never moves focus, so keyboard focus is left on an element in a now-hidden view.
- [x] 🟡 **Don't discard a renamed key.** `src/popup/api-keys.js:71-73` skips the `push` when the key
      value already exists, silently throwing away the newly typed name. Update the existing entry's
      name instead.
- [x] 🟢 **Fix key masking for short input.** `src/popup/api-keys.js:12` builds
      `key.slice(0, 6) + '...' + key.slice(-4)`. For a key under 10 characters the two slices overlap
      and characters are duplicated. Guard on length.
- [ ] 🟢 **Mark unrenderable swatches.** `src/popup/ui.js:115` assigns the model's raw value to
      `box.style.backgroundColor`. An invalid value is silently dropped by the browser, leaving a blank
      box with no explanation. Validate with `CSS.supports` and flag failures — this is also the
      clearest signal that the alpha-syntax bug from Phase 2 has regressed.
- [ ] 🟢 **Fix copy indentation.** `src/popup/init.js:32-34` wraps the theme body in
      `` `:root {\n  ${themes.light}\n}` ``, indenting only the first line; every subsequent line lands
      flush left. Re-indent each line.

**Exit criteria:** the whole popup is operable by keyboard alone; a screen reader announces errors;
no single click can destroy a saved key.

---

## Phase 7 — Feature Enhancements

> **Goal:** build on the now-stable base. Ordered by value to the target user.

- [ ] 🟠 **Persist user settings.** `selectedFormatValue` (`src/popup/state.js:46`) is a module global
      initialized to `'oklch'` on every popup open, and the prompt and last result are equally
      ephemeral — closing the popup loses everything. This directly contradicts `README.md:69`, which
      tells users to "Change the Color Format ... for the next generation". Persist format, last
      prompt, and last theme to `chrome.storage.local` and restore them on open.
- [ ] 🟠 **Validate contrast.** Compute WCAG AA contrast ratios for each generated
      foreground/background pair and flag failures in the result view. The model is not reliable at
      this, and it is the single most valuable addition for the developer/designer audience — an
      inaccessible theme is a broken theme.
- [ ] 🟡 **Theme history.** Store the last N generated themes with their source site and let the user
      reopen them. Cheap to build once persistence exists.
- [ ] 🟡 **Live preview.** Inject the generated variables into the active tab behind a toggle so the
      user sees the theme applied before copying, then revert cleanly on close.
- [ ] 🟡 **More export formats.** A Tailwind v4 `@theme` block, and a JSON export.
- [ ] 🟢 **Model selection.** `gemini-2.5-flash` is hard-coded at `src/popup/generator.js:171`. Let the
      user choose, and default to the current flash model.
- [ ] 🟢 **Regenerate with the same prompt** from the result view, for quick iteration.

**Exit criteria:** settings survive a popup close; generated themes carry a pass/fail contrast report.

---

## Issue Index

| # | Issue | File | Line | Severity | Phase |
| --- | --- | --- | --- | --- | --- |
| 1 | XSS via unescaped key name in `innerHTML` | `src/popup/api-keys.js` | 16-28 | 🔴 Critical | 1 |
| 2 | Dead content script injected into every page | `manifest.json` / `src/content/` | 14-25 | 🔴 Critical | 1 |
| 3 | `postMessage` with no origin validation | `src/content/content.js` | 28 | 🔴 Critical | 1 |
| 4 | API key passed in URL query string | `src/popup/generator.js` | 171 | 🟠 High | 1 |
| 5 | No `host_permissions` declared | `manifest.json` | 13 | 🟠 High | 1 |
| 6 | Remote Google Fonts fetch on every open | `src/popup/popup.html` | 8-10 | 🟡 Medium | 1 |
| 7 | No explicit CSP | `manifest.json` | — | 🟡 Medium | 1 |
| 8 | `performInitialScan` throws, result discarded | `src/popup/generator.js` | 1-13 | 🟠 High | 2 |
| 9 | Double generation; `isGenerating` never read | `src/popup/generator.js` | 281-286 | 🟠 High | 2 |
| 10 | Shift+Enter blocks newline in textarea | `src/popup/generator.js` | 282 | 🟠 High | 2 |
| 11 | Non-greedy regex truncates theme blocks | `src/popup/generator.js` | 246-247 | 🟠 High | 2 |
| 12 | Prompt yields invalid `<color> / <opacity>` | `src/popup/generator.js` | 108-109, 122 | 🟠 High | 2 |
| 13 | Safety blocks reported as parse failures | `src/popup/generator.js` | 229 | 🟠 High | 2 |
| 14 | Copy button label permanently corrupted | `src/shared/utils.js` | 44-50 | 🟡 Medium | 2 |
| 15 | `window.onerror` suppresses all console output | `src/popup/init.js` | 37-40 | 🟡 Medium | 2 |
| 16 | Substring-based error misclassification | `src/shared/utils.js` | 10, 17 | 🟡 Medium | 2 |
| 17 | `⌘G` advertised but not implemented | `src/popup/popup.html` | 103 | 🟢 Low | 2 |
| 18 | Page scan freezes large tabs | `src/shared/utils.js` | 98-108 | 🟠 High | 3 |
| 19 | Hand-rolled JSON stream parser; no `alt=sse` | `src/popup/generator.js` | 171, 196-238 | 🟡 Medium | 3 |
| 20 | No fetch timeout or cancellation | `src/popup/generator.js` | 171 | 🟡 Medium | 3 |
| 21 | No retry on 429/503 | `src/popup/generator.js` | 177 | 🟢 Low | 3 |
| 22 | No `.gitignore`; `dist/` drift undetected | repo root | — | 🟡 Medium | 4 |
| 23 | No `package.json`, linter, or formatter | repo root | — | 🟡 Medium | 4 |
| 24 | Zero tests | repo root | — | 🟡 Medium | 4 |
| 25 | No CI | `.github/` | — | 🟡 Medium | 4 |
| 26 | Fragile global-scope concatenation | `build.js` | 18-26 | 🟢 Low | 4 |
| 27 | README: wrong model name | `README.md` | 13 | 🟢 Low | 5 |
| 28 | README: non-existent `src/init/` | `README.md` | 41 | 🟢 Low | 5 |
| 29 | README: `src/content/` misdescribed | `README.md` | 40 | 🟢 Low | 5 |
| 30 | README: documents unimplemented `⌘G` | `README.md` | 30 | 🟢 Low | 5 |
| 31 | README: overstates key security | `README.md` | 23 | 🟢 Low | 5 |
| 32 | Dropdown has no keyboard or ARIA support | `src/popup/popup.html` | 82-97 | 🟠 High | 6 |
| 33 | Key deletion has no confirmation | `src/popup/api-keys.js` | 33, 48 | 🟠 High | 6 |
| 34 | Error strip not announced; auto-hides | `src/popup/ui.js` | 44, 84 | 🟡 Medium | 6 |
| 35 | No focus management across views | `src/popup/ui.js` | 5-30 | 🟡 Medium | 6 |
| 36 | Renaming an existing key silently no-ops | `src/popup/api-keys.js` | 71-73 | 🟡 Medium | 6 |
| 37 | Key masking overlaps on short keys | `src/popup/api-keys.js` | 12 | 🟢 Low | 6 |
| 38 | Invalid swatch colors render blank | `src/popup/ui.js` | 115 | 🟢 Low | 6 |
| 39 | Copy output indentation broken | `src/popup/init.js` | 32-34 | 🟢 Low | 6 |
| 40 | Format/prompt/result not persisted | `src/popup/state.js` | 46 | 🟠 High | 7 |
| 41 | No contrast validation | — | — | 🟠 High | 7 |
| 42 | Model hard-coded | `src/popup/generator.js` | 171 | 🟢 Low | 7 |

---

## Suggested Sequencing

Phases 1 through 3 fix real defects and should land in order — Phase 1 deletes code that Phases 2 and
3 would otherwise have to reason about. Phase 4 is worth pulling forward if more than one person will
work on this, since it makes every later change verifiable. Phases 5, 6, and 7 are independent of one
another and can be scheduled freely.
