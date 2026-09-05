'use strict';

// The popup sources are plain browser scripts that build.js concatenates into a
// single file, so they share one global scope: a const declared in state.js is
// legitimately referenced from generator.js. That makes the *bundle*, not the
// individual source file, the only unit where no-undef can be evaluated
// correctly — so no-undef runs against dist/popup.js and is off for src/.

const browserGlobals = {
    window: 'readonly',
    document: 'readonly',
    navigator: 'readonly',
    console: 'readonly',
    fetch: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    TextDecoder: 'readonly',
    AbortController: 'readonly',
    DOMException: 'readonly',
    CSS: 'readonly',
    URL: 'readonly',
    chrome: 'readonly',
};

const styleRules = {
    'no-unused-vars': ['error', { args: 'none' }],
    'no-empty': ['error', { allowEmptyCatch: false }],
    'no-var': 'error',
    'prefer-const': 'error',
    eqeqeq: ['error', 'smart'],
};

// Rules that can only be judged across the whole concatenated scope. Linting a
// single source file in isolation reports every top-level symbol as unused (it
// is consumed by a sibling file) and every `let` as never-reassigned (it is
// reassigned by a sibling file), so these are evaluated on the bundle instead.
const wholeProgramRules = {
    'no-undef': 'error',
    'no-unused-vars': ['error', { args: 'none' }],
    'prefer-const': 'error',
};

const perFileRules = {
    'no-undef': 'off',
    // vars: 'local' still catches an unused variable inside a function, which
    // is where the real dead code lives.
    'no-unused-vars': ['error', { vars: 'local', args: 'none' }],
    'prefer-const': 'off',
};

module.exports = [
    {
        ignores: ['node_modules/**'],
    },
    {
        // Sources: style and dead-code rules only.
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: browserGlobals,
        },
        rules: { ...styleRules, ...perFileRules },
    },
    {
        // The bundle: the one place cross-file references actually resolve.
        files: ['dist/popup.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: browserGlobals,
        },
        rules: { ...styleRules, ...wholeProgramRules },
    },
    {
        files: ['build.js', 'scripts/**/*.js', 'test/**/*.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'writable',
                __dirname: 'readonly',
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                globalThis: 'readonly',
            },
        },
        rules: styleRules,
    },
];
