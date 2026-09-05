'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers/load.js');

// init.js registers a DOMContentLoaded listener at load time; everything else it
// touches is deferred until that fires, so a stub listener is enough.
const { exports: init } = loadScript('popup/init.js', ['wrapCssBlock', 'isMacPlatform'], {
    document: { addEventListener() {} },
});

test('wrapCssBlock re-indents every declaration', async (t) => {
    await t.test('indents all lines, not just the first', () => {
        const body = '--background: oklch(1 0 0);\n--foreground: oklch(0 0 0);';
        assert.equal(
            init.wrapCssBlock(':root', body),
            ':root {\n  --background: oklch(1 0 0);\n  --foreground: oklch(0 0 0);\n}'
        );
    });

    await t.test('normalises pre-existing indentation', () => {
        const body = '      --a: red;\n\t--b: blue;';
        assert.equal(init.wrapCssBlock('.dark', body), '.dark {\n  --a: red;\n  --b: blue;\n}');
    });

    await t.test('drops blank lines', () => {
        assert.equal(init.wrapCssBlock(':root', '--a: red;\n\n\n--b: blue;'),
            ':root {\n  --a: red;\n  --b: blue;\n}');
    });
});

test('isMacPlatform reads the platform hint', async (t) => {
    const detect = (platform) => {
        const { exports } = loadScript('popup/init.js', ['isMacPlatform'], {
            document: { addEventListener() {} },
            navigator: { platform },
        });
        return exports.isMacPlatform();
    };

    await t.test('detects macOS', () => assert.equal(detect('MacIntel'), true));
    await t.test('detects other platforms', () => assert.equal(detect('Win32'), false));
});
