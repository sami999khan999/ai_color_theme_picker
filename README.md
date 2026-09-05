# Color Theme Picker (Theme AI)

A Chrome extension for developers and designers. It analyses the colours of the
page you are on and asks Gemini to generate a matching set of Tailwind /
shadcn-ui CSS variables for both light and dark mode.

## Features

### Site-aware colour analysis
- Scans the active tab for its computed colours and any shadcn CSS variables it
  already defines, and uses them as the starting point for the theme.
- Normalises every CSS colour format — named colours, `lab()`, `oklch()` and the
  rest — to sRGB hex through a canvas round-trip, with a regex fallback for
  pages whose CSP blocks canvas.
- Generates output in **OKLCH**, HEX, RGB, HSL, or LCH.

### AI theme generation
- Uses Google's Gemini — **`gemini-2.5-flash`** by default, switchable to Pro or
  Flash-Lite in settings.
- Takes an optional style prompt ("Sleek SaaS dashboard with slate tones",
  "Vibrant cyberpunk neon") which is prioritised over the scraped palette.
- Streams the response so you can watch the CSS being written, and can be
  cancelled mid-generation.

### Accessibility checking
- Every foreground/background pair in the generated theme is measured against
  **WCAG AA**, in both light and dark mode, with failures listed first. The model
  is not reliable at contrast, and an inaccessible theme is a broken theme.

### Live preview
- Apply the generated theme to the page you are on before you copy it, and
  revert it with the same button.

### Tailwind and shadcn/ui ready
- Emits the full shadcn variable set — `--background`, `--primary`, `--accent`,
  `--muted`, `--chart-1..5`, `--sidebar-*` and the rest.
- Produces both a `:root` (light) and a `.dark` block.
- Copy either block on its own, export the whole thing, or export as a
  Tailwind v4 `@theme inline` block or JSON.

### Key management
- Store several Gemini API keys under names like "Personal" or "Work" and switch
  between them.
- Links straight to Google AI Studio to get a free key.

### Keyboard
- **Ctrl+Enter** (**⌘+Enter** on macOS) generates a theme from the prompt box.

---

## Technical architecture

No runtime dependencies. Plain browser JavaScript, hand-written CSS, inline SVG.

- **`src/shared/`** — code used across the extension: `icons.js` holds the inline
  SVG set; `utils.js` holds error formatting, CSS block extraction, SSE frame
  splitting, clipboard handling, and `extractColorsFunc`, the routine injected
  into the page to collect its colours.
- **`src/popup/`** — the application itself: `state.js` (DOM handles and shared
  state), `ui.js` (view switching, palette rendering, the format dropdown),
  `api-keys.js` (key storage and the saved-key list), `generator.js` (prompt
  construction, the Gemini request, stream parsing), and `init.js` (bootstrap
  and event wiring).
- **`dist/popup.js`** — the generated bundle that `popup.html` actually loads.
- **`test/`** — `node:test` suites for the pure logic.

### Build

`build.js` concatenates the seven source files, in dependency order, into
`dist/popup.js`. There is no transpiling, minification, or module system: the
files share a single global scope, which is why the order in `JS_FILES` matters.

The build is deterministic — the same sources always produce a byte-identical
bundle — so CI can verify that the committed bundle matches `src/`.

> **`dist/popup.js` is committed on purpose.** `popup.html` loads it directly, so
> `Load unpacked` has to work from a clean clone. The consequence is that
> **editing `src/` without rebuilding changes nothing at runtime.** Always run
> `npm run build` and commit the result.

---

## Installation (development)

1. Clone the repository. [Node.js](https://nodejs.org/) 18+ is required to build.
2. Build the bundle:
   ```bash
   npm install     # only needed for linting and tests
   npm run build
   ```
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the project root.

After any change under `src/`, run `npm run build` again and hit **Reload** on
the extension card.

### Development scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Rebuild `dist/popup.js` from `src/`. |
| `npm test` | Run the `node:test` suites. |
| `npm run lint` | Run ESLint over sources, the bundle, and tooling. |
| `npm run check:dist` | Fail if the committed bundle is stale. |
| `npm run verify` | Build, lint, and test in one go. |
| `npm run format` | Apply Prettier. |

---

## Usage

Open the popup and click the gear icon to:

- Add, switch between, or delete **Gemini API keys**.
- Return to the generator.

In the generator you can set a style prompt and pick the **colour format**. Your
prompt, format, model and most recent theme are remembered between sessions, and
the last five themes are listed under **Recent Themes** for one-click restore.

---

## Privacy

- **Direct to Google.** The extension talks to the Gemini API and nothing else.
  There is no backend, no analytics, and no telemetry.
- **Local storage.** Settings and API keys are kept in `chrome.storage.local` on
  your machine. Note that `chrome.storage.local` is **not encrypted** — keys are
  stored in plaintext, readable by anything with access to your Chrome profile.
  Treat a stored key the way you would treat any credential in a config file, and
  prefer a key scoped to this use.
- **No third-party requests.** Fonts and assets are bundled rather than fetched
  from a CDN, so opening the popup contacts nobody.
- **Page access.** Colour extraction runs only on the tab you are on, only when
  you click Generate, via the `activeTab` permission. The extension has no
  persistent content script and requests no all-sites host permission.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Planned work is tracked in
[IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md).

## License

[MIT](LICENSE)
