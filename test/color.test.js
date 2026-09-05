'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers/load.js');

const { exports: color } = loadScript('shared/color.js', [
    'relativeLuminance',
    'contrastRatio',
    'wcagLevel',
    'parseCssVariables',
    'auditContrast',
]);

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

test('relativeLuminance matches the WCAG reference values', () => {
    assert.equal(Math.round(color.relativeLuminance(WHITE) * 1000) / 1000, 1);
    assert.equal(color.relativeLuminance(BLACK), 0);
    // Mid grey #808080 has a known luminance of ~0.2159.
    assert.ok(Math.abs(color.relativeLuminance([128, 128, 128]) - 0.2159) < 0.001);
});

test('contrastRatio is symmetric and correctly bounded', async (t) => {
    await t.test('black on white is the 21:1 maximum', () => {
        assert.equal(Math.round(color.contrastRatio(BLACK, WHITE) * 100) / 100, 21);
    });

    await t.test('order does not matter', () => {
        assert.equal(color.contrastRatio(BLACK, WHITE), color.contrastRatio(WHITE, BLACK));
    });

    await t.test('a colour against itself is 1:1', () => {
        assert.equal(color.contrastRatio([12, 34, 56], [12, 34, 56]), 1);
    });
});

test('wcagLevel maps ratios to the published thresholds', () => {
    assert.equal(color.wcagLevel(21), 'AAA');
    assert.equal(color.wcagLevel(7), 'AAA');
    assert.equal(color.wcagLevel(4.5), 'AA');
    assert.equal(color.wcagLevel(4.49), 'AA Large');
    assert.equal(color.wcagLevel(3), 'AA Large');
    assert.equal(color.wcagLevel(2.99), 'Fail');
});

test('parseCssVariables reads declarations out of a rule body', () => {
    const vars = color.parseCssVariables('--a: red;\n  --b-c: oklch(1 0 0 / 10%);\n  --radius: 0.5rem;');
    assert.equal(vars['--a'], 'red');
    assert.equal(vars['--b-c'], 'oklch(1 0 0 / 10%)');
    assert.equal(vars['--radius'], '0.5rem');
});

test('auditContrast reports the shadcn foreground pairs', async (t) => {
    // Stands in for the browser's colour parsing.
    const toRgb = (value) => {
        const named = { white: WHITE, black: BLACK, grey: [128, 128, 128], nonsense: null };
        return named[value] ?? null;
    };

    await t.test('flags a failing pair and passes a good one', () => {
        const body = '--background: white; --foreground: black; --primary: grey; --primary-foreground: white;';
        const report = color.auditContrast(body, toRgb);

        const background = report.find(r => r.label === 'background');
        const primary = report.find(r => r.label === 'primary');

        assert.equal(background.ratio, 21);
        assert.equal(background.passesAA, true);
        assert.equal(background.level, 'AAA');

        // White on mid grey is ~3.95:1 — readable at large sizes only.
        assert.equal(primary.passesAA, false);
        assert.equal(primary.level, 'AA Large');
    });

    await t.test('skips pairs the theme does not define', () => {
        const report = color.auditContrast('--background: white; --foreground: black;', toRgb);
        assert.equal(report.length, 1);
    });

    await t.test('skips pairs the browser cannot parse', () => {
        const body = '--background: nonsense; --foreground: black;';
        assert.deepEqual(Array.from(color.auditContrast(body, toRgb)), []);
    });
});
