'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers/load.js');

const { exports: storage } = loadScript('popup/storage.js', ['addHistoryEntry', 'STORAGE_KEYS', 'DEFAULT_MODEL']);

test('addHistoryEntry keeps the list short, fresh and free of duplicates', async (t) => {
    const entry = (site, createdAt = 0) => ({ site, createdAt, light: 'l', dark: 'd', format: 'oklch' });

    await t.test('puts the newest entry first', () => {
        const out = storage.addHistoryEntry(entry('b'), [entry('a')]);
        assert.deepEqual(Array.from(out).map(e => e.site), ['b', 'a']);
    });

    await t.test('replaces an earlier entry for the same site', () => {
        // Regenerating one page repeatedly must not evict everything else.
        const out = storage.addHistoryEntry(entry('a', 2), [entry('a', 1), entry('b')]);
        assert.deepEqual(Array.from(out).map(e => e.site), ['a', 'b']);
        assert.equal(out[0].createdAt, 2);
    });

    await t.test('caps the list at five', () => {
        const existing = ['a', 'b', 'c', 'd', 'e'].map(s => entry(s));
        const out = storage.addHistoryEntry(entry('f'), existing);
        assert.equal(out.length, 5);
        assert.deepEqual(Array.from(out).map(e => e.site), ['f', 'a', 'b', 'c', 'd']);
    });
});

test('storage keys and default model are stable', () => {
    // These are persisted, so renaming one silently orphans a user's settings.
    assert.equal(storage.STORAGE_KEYS.activeKey, 'geminiApiKey');
    assert.equal(storage.STORAGE_KEYS.apiKeys, 'apiKeys');
    assert.equal(storage.DEFAULT_MODEL, 'gemini-2.5-flash');
});
