'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildBundle, buildFiles, DIST_DIR, JS_FILES } = require('../build.js');

test('the bundle is deterministic', () => {
    // Determinism is what makes the staleness check possible; the build used to
    // stamp a timestamp into the header, so no two builds ever matched.
    assert.equal(buildBundle(), buildBundle());
});

test('release/ matches a fresh build of src/', () => {
    // The extension runs from release/, so a stale file there means src/ edits
    // have no effect at runtime.
    for (const [out, content] of Object.entries(buildFiles())) {
        const outPath = path.join(DIST_DIR, out);
        assert.ok(fs.existsSync(outPath), `release/${out} is missing — run \`node build.js\``);
        assert.ok(
            fs.readFileSync(outPath).equals(content),
            `release/${out} is stale — run \`node build.js\` and commit the result`
        );
    }
});

test('every source listed in the build exists', () => {
    for (const file of JS_FILES) {
        assert.ok(fs.existsSync(`${__dirname}/../src/${file}`), `missing src/${file}`);
    }
});
