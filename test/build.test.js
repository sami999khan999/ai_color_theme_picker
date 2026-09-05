'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildBundle, OUTPUT_FILE, JS_FILES } = require('../build.js');

test('the bundle is deterministic', () => {
    // Determinism is what makes the staleness check possible; the build used to
    // stamp a timestamp into the header, so no two builds ever matched.
    assert.equal(buildBundle(), buildBundle());
});

test('dist/popup.js matches a fresh build of src/', () => {
    // popup.html loads dist/popup.js, so a stale bundle means src/ edits have no
    // effect at runtime.
    assert.ok(fs.existsSync(OUTPUT_FILE), 'dist/popup.js is missing — run `node build.js`');
    assert.equal(
        fs.readFileSync(OUTPUT_FILE, 'utf-8'),
        buildBundle(),
        'dist/popup.js is stale — run `node build.js` and commit the result'
    );
});

test('every source listed in the build exists', () => {
    for (const file of JS_FILES) {
        assert.ok(fs.existsSync(`${__dirname}/../src/${file}`), `missing src/${file}`);
    }
});
