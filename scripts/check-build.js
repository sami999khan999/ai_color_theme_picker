/**
 * Fails when extension-build/ does not match a fresh build of src/.
 *
 * The build has to stay committed for `Load unpacked` to work from a clean
 * clone, which means it can silently drift from the sources it was built from.
 */

const fs = require('fs');
const path = require('path');
const { buildFiles, DIST_DIR } = require('../build.js');

const stale = Object.entries(buildFiles())
    .filter(([out, content]) => {
        const outPath = path.join(DIST_DIR, out);
        return !fs.existsSync(outPath) || !fs.readFileSync(outPath).equals(content);
    })
    .map(([out]) => `extension-build/${out}`);

if (stale.length) {
    console.error(`Missing or stale: ${stale.join(', ')}. It does not match a fresh build of src/.`);
    console.error('Run `node build.js` and commit the result.');
    process.exit(1);
}

console.log('extension-build/ is up to date with src/.');
