'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

/**
 * Evaluates one of the extension's plain global-scope scripts in a fresh VM
 * context and returns the named top-level bindings.
 *
 * The sources are not modules — build.js concatenates them — so there is
 * nothing to require(). Top-level `const` declarations are lexical and never
 * become properties of the context's global object, hence the epilogue that
 * copies the requested names out explicitly.
 */
const loadScript = (relativePath, exportNames, sandbox = {}) => {
    const file = path.join(ROOT, 'src', relativePath);
    const source = fs.readFileSync(file, 'utf-8');
    const context = vm.createContext(sandbox);
    const epilogue = `\n;globalThis.__exports = { ${exportNames.join(', ')} };\n`;

    vm.runInContext(source + epilogue, context, { filename: file });

    return { exports: context.__exports, context: sandbox };
};

module.exports = { loadScript, ROOT };
