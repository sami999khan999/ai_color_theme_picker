# Notes for Claude

## Build before you believe anything

`src/popup/popup.html` loads `../../dist/popup.js`. The files under `src/` are
**not** loaded at runtime. Any change to `src/` requires:

```bash
node build.js      # or: npm run build
```

and the regenerated `dist/popup.js` must be committed with the change. `npm run
check:dist` and a test both fail if it drifts. This is the single most common way
to make a change that appears to do nothing.

## Architecture in one paragraph

A Manifest V3 Chrome extension with no runtime dependencies. The popup reads the
active tab's colours with `chrome.scripting.executeScript` (injecting
`extractColorsFunc` from `src/shared/utils.js`), builds a prompt, and streams
`gemini-2.5-flash` over `alt=sse`. `:root` and `.dark` blocks are pulled out of
the response by `extractCssBlock` and rendered as swatch grids. There is no
background service worker and no content script.

## Conventions

- Sources are concatenated global-scope scripts, ordered by `JS_FILES` in
  `build.js`. There is no module system. A new file must be added to that list.
- 4-space indent in JS, 2 in HTML/CSS/JSON. Arrow-function consts for top-level
  functions.
- Never render user-controlled text with `innerHTML`. Key names are user input
  and the popup is a privileged context holding plaintext API keys — use
  `textContent`. `innerHTML` is only for the trusted `ICONS` constants.
- The extension declares a strict `extension_pages` CSP with no `unsafe-inline`,
  so inline `style="..."` attributes will not apply. Put styles in `popup.css`.

## Verification

```bash
npm run verify      # build + lint + test
```

There is no automated end-to-end test of the popup. To check behaviour by hand:
load the unpacked extension at `chrome://extensions`, open the popup on an
ordinary website, and generate a theme.

## Open work

[IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md) tracks the remaining phases and their
checklists.
