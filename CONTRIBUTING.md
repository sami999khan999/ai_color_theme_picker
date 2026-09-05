# Contributing

## Setup

```bash
npm install
npm run verify   # build + lint + test
```

## The one thing that will catch you out

`popup.html` loads `dist/popup.js`, **not** the files in `src/`. Editing a source
file and reloading the extension does nothing until you rebuild:

```bash
npm run build
```

`dist/popup.js` is committed deliberately, so `Load unpacked` works from a clean
clone. Commit the rebuilt bundle alongside your source change — CI fails if the
two disagree (`npm run check:dist`).

## How the code is organised

The sources are plain browser scripts, not modules. `build.js` concatenates them
in the order listed in `JS_FILES`, and they share a single global scope: a `const`
declared in `state.js` is visible to `generator.js`. Two consequences:

- **Order matters.** A file may only use symbols declared in a file listed above
  it, at call time.
- **Linting is split.** `no-undef`, `no-unused-vars` and `prefer-const` can only
  be judged across the whole concatenated program, so ESLint applies them to
  `dist/popup.js`. `src/**` gets the rules that are meaningful per-file. See
  `eslint.config.js`.

## Tests

`node:test`, no test dependencies:

```bash
npm test
```

Because the sources are global-scope scripts, `test/helpers/load.js` evaluates a
file in a `node:vm` context and copies out the bindings under test. Values that
cross the VM boundary carry that realm's prototypes, so copy arrays into the host
realm (`Array.from(...)`) before `deepEqual` compares them.

Prefer testing pure logic — error mapping, CSS extraction, SSE framing, colour
normalisation. `extractColorsFunc` is testable against the stub DOM in
`test/utils.test.js`.

## Style

Prettier is configured but has deliberately not been run across the existing
code, to avoid a repo-wide reformat burying real diffs. Match the surrounding
style: 4-space indent in JS, 2 in HTML/CSS/JSON.

## Before opening a PR

```bash
npm run verify
npm run check:dist
```

Planned work is tracked in [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md); ticking a
box there in the same PR is welcome.
