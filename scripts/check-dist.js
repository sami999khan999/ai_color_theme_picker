/**
 * Fails when dist/popup.js does not match a fresh build of src/.
 *
 * The bundle has to stay committed for `Load unpacked` to work from a clean
 * clone, which means it can silently drift from the sources it was built from.
 */

const fs = require('fs');
const { buildBundle, OUTPUT_FILE } = require('../build.js');

const expected = buildBundle();
const actual = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, 'utf-8') : null;

if (actual === null) {
    console.error('dist/popup.js is missing. Run `node build.js`.');
    process.exit(1);
}

if (actual !== expected) {
    console.error('dist/popup.js is stale: it does not match a fresh build of src/.');
    console.error('Run `node build.js` and commit the result.');
    process.exit(1);
}

console.log('dist/popup.js is up to date with src/.');
