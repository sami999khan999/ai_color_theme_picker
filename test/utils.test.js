'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers/load.js');

// Values returned from a VM context carry that realm's prototypes, so arrays
// are copied into the host realm before deepEqual compares them.

const { exports: utils } = loadScript('shared/utils.js', [
    'getFriendlyError',
    'extractCssBlock',
    'splitSseFrames',
    'extractColorsFunc',
]);

test('getFriendlyError branches on the HTTP status, not the message text', async (t) => {
    const withStatus = (status, message = 'boom') => Object.assign(new Error(message), { status });

    await t.test('maps auth failures', () => {
        assert.match(utils.getFriendlyError(withStatus(401)), /Invalid API Key/);
        assert.match(utils.getFriendlyError(withStatus(403)), /Invalid API Key/);
    });

    await t.test('maps quota and server failures', () => {
        assert.match(utils.getFriendlyError(withStatus(429)), /Quota exhausted/);
        assert.match(utils.getFriendlyError(withStatus(500)), /busy/);
        assert.match(utils.getFriendlyError(withStatus(503)), /busy/);
    });

    await t.test('does not misreport an unrelated error mentioning "key"', () => {
        // The old substring matcher reported this as an auth failure.
        const err = new Error('Unexpected token in JSON at key 3');
        assert.equal(utils.getFriendlyError(err), 'Unexpected token in JSON at key 3');
    });

    await t.test('does not misreport an unrelated error mentioning "limit"', () => {
        const err = new Error('Scroll limit reached');
        assert.equal(utils.getFriendlyError(err), 'Scroll limit reached');
    });

    await t.test('recognises aborts and network failures', () => {
        const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
        assert.match(utils.getFriendlyError(abort), /timed out or was cancelled/);
        assert.match(utils.getFriendlyError(new Error('Failed to fetch')), /Connection failed/);
    });

    await t.test('falls back for an empty error', () => {
        assert.match(utils.getFriendlyError(new Error('')), /unexpected error/i);
    });
});

test('extractCssBlock counts braces instead of stopping at the first one', async (t) => {
    await t.test('reads a flat block', () => {
        const css = ':root {\n  --a: red;\n}\n.dark {\n  --a: blue;\n}';
        assert.equal(utils.extractCssBlock(css, ':root'), '--a: red;');
        assert.equal(utils.extractCssBlock(css, '.dark'), '--a: blue;');
    });

    await t.test('survives a nested block that truncated the old regex', () => {
        const css = ':root {\n  --a: red;\n  @media (min-width: 1px) { --b: green; }\n  --c: blue;\n}';
        const body = utils.extractCssBlock(css, ':root');
        assert.match(body, /--c: blue;/);
        assert.match(body, /--b: green;/);
    });

    await t.test('returns null for a missing selector', () => {
        assert.equal(utils.extractCssBlock(':root { --a: red; }', '.dark'), null);
    });

    await t.test('returns null when the stream was cut off mid-block', () => {
        assert.equal(utils.extractCssBlock(':root { --a: red;', ':root'), null);
    });

    await t.test('escapes selector metacharacters', () => {
        // '.dark' must not match 'xdark' via an unescaped dot.
        assert.equal(utils.extractCssBlock('xdark { --a: red; }', '.dark'), null);
    });
});

test('splitSseFrames handles frames that straddle chunk boundaries', async (t) => {
    await t.test('returns complete payloads and keeps the remainder', () => {
        const { payloads, remainder } = utils.splitSseFrames('data: {"x":1}\n\ndata: {"y":2}\ndata: {"par');
        assert.deepEqual(Array.from(payloads), ['{"x":1}', '{"y":2}']);
        assert.equal(remainder, 'data: {"par');
    });

    await t.test('resumes a split frame on the next chunk', () => {
        const first = utils.splitSseFrames('data: {"par');
        const second = utils.splitSseFrames(first.remainder + 'tial":3}\n');
        assert.deepEqual(Array.from(second.payloads), ['{"partial":3}']);
        assert.equal(second.remainder, '');
    });

    await t.test('skips [DONE] sentinels and non-data lines', () => {
        const { payloads } = utils.splitSseFrames(': comment\nevent: ping\ndata: [DONE]\ndata: {"z":9}\n');
        assert.deepEqual(Array.from(payloads), ['{"z":9}']);
    });
});

// A stand-in for the browser APIs extractColorsFunc reaches for once injected
// into the page. Counters let the tests assert on call volume, which is the
// whole point of the memoisation.
const makeDom = ({ elementCount, colorFor, canvasThrows = false }) => {
    const counters = { getComputedStyle: 0, getImageData: 0 };
    const element = {};
    const elements = Array.from({ length: elementCount }, () => element);
    let pending = '';

    const sandbox = {
        document: {
            body: element,
            documentElement: element,
            querySelector: () => element,
            querySelectorAll: () => elements,
            createElement: () => ({
                getContext: () =>
                    canvasThrows
                        ? null
                        : {
                              fillRect() {},
                              set fillStyle(value) {
                                  pending = value;
                              },
                              getImageData() {
                                  counters.getImageData++;
                                  const seed = Number(/\d+/.exec(pending)?.[0] ?? 0);
                                  return { data: [seed % 256, (seed * 7) % 256, (seed * 13) % 256] };
                              },
                          },
            }),
        },
        window: {
            getComputedStyle: () => {
                const index = counters.getComputedStyle++;
                return { ...colorFor(index), getPropertyValue: () => '' };
            },
        },
    };

    return { sandbox, counters };
};

test('extractColorsFunc keeps the page scan cheap', async (t) => {
    await t.test('memoises repeated colours instead of re-reading the canvas', () => {
        const { sandbox, counters } = makeDom({
            elementCount: 5000,
            colorFor: () => ({
                color: 'rgb(1)',
                backgroundColor: 'rgb(2)',
                borderColor: 'transparent',
                fill: 'none',
                stroke: 'rgb(3)',
            }),
        });
        const { exports } = loadScript('shared/utils.js', ['extractColorsFunc'], sandbox);

        exports.extractColorsFunc();

        // Three distinct colour strings across 5,000 elements. Without the cache
        // this was five canvas readbacks per element.
        assert.equal(counters.getImageData, 3);
    });

    await t.test('stops traversing once the colour cap is reached', () => {
        const { sandbox, counters } = makeDom({
            elementCount: 5000,
            colorFor: (i) => ({
                color: `rgb(${i})`,
                backgroundColor: `rgb(${i + 10000})`,
                borderColor: 'transparent',
                fill: 'none',
                stroke: 'transparent',
            }),
        });
        const { exports } = loadScript('shared/utils.js', ['extractColorsFunc'], sandbox);

        const result = exports.extractColorsFunc();

        assert.equal(result.palette.length, 60);
        assert.ok(
            counters.getComputedStyle < 100,
            `expected an early exit, got ${counters.getComputedStyle} getComputedStyle calls`
        );
    });

    await t.test('normalises colours to uppercase sRGB hex', () => {
        const { sandbox } = makeDom({
            elementCount: 1,
            colorFor: () => ({
                color: 'rgb(255)',
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                fill: 'none',
                stroke: 'none',
            }),
        });
        const { exports } = loadScript('shared/utils.js', ['extractColorsFunc'], sandbox);

        for (const hex of exports.extractColorsFunc().palette) {
            assert.match(hex, /^#[0-9A-F]{6}$/);
        }
    });

    await t.test('falls back to a regex when the canvas is unavailable', () => {
        const { sandbox } = makeDom({
            elementCount: 1,
            canvasThrows: true,
            colorFor: () => ({
                color: 'rgb(18, 52, 86)',
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                fill: 'none',
                stroke: 'none',
            }),
        });
        const { exports } = loadScript('shared/utils.js', ['extractColorsFunc'], sandbox);

        assert.ok(exports.extractColorsFunc().palette.includes('#123456'));
    });
});

test('export helpers reshape the theme for other toolchains', async (t) => {
    const { exports: exporters } = loadScript('shared/utils.js', ['toTailwindTheme', 'toThemeJson'], {
        // utils.js uses parseCssVariables from color.js, which shares the bundle's
        // global scope; the sandbox stands in for that.
        parseCssVariables: (body) => {
            const vars = {};
            const regex = /(--[\w-]+):\s*([^;]+);/g;
            let match;
            while ((match = regex.exec(body)) !== null) vars[match[1]] = match[2].trim();
            return vars;
        },
    });

    await t.test('emits Tailwind v4 --color-* tokens pointing at the originals', () => {
        const out = exporters.toTailwindTheme('--background: white; --primary: blue; --radius: 0.5rem;');
        assert.match(out, /^@theme inline \{/);
        assert.match(out, /--color-background: var\(--background\);/);
        assert.match(out, /--color-primary: var\(--primary\);/);
        // --radius is a length, not a colour.
        assert.doesNotMatch(out, /--color-radius/);
    });

    await t.test('emits both modes as JSON', () => {
        const json = JSON.parse(exporters.toThemeJson('--a: red;', '--a: black;'));
        assert.deepEqual(json, { light: { '--a': 'red' }, dark: { '--a': 'black' } });
    });
});
