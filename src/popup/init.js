// Re-indents every declaration, not just the first. The old template literal
// put two spaces before the opening line and left the rest flush left.
const wrapCssBlock = (selector, body) => {
    const lines = body
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `  ${line}`);

    return `${selector} {\n${lines.join('\n')}\n}`;
};

const isMacPlatform = () => /mac|iphone|ipad/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent
);

const applyShortcutLabels = () => {
    const modifier = isMacPlatform() ? '\u2318' : 'Ctrl';
    if (controls.shortcutHint) {
        controls.shortcutHint.textContent = `${modifier} + Enter to generate`;
    }
    if (controls.shortcutKbd) {
        controls.shortcutKbd.textContent = `${modifier}\u21B5`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize component logic
    applyShortcutLabels();
    initMessageDismiss();
    initDropdown();
    initApiKeyListeners();
    initGeneratorListeners();

    // Load API Keys and perform initial scan
    chrome.storage.local.get(['geminiApiKey', 'apiKeys'], (result) => {
        const rawKeys = result.apiKeys || [];
        // Migration: Convert string keys to objects if necessary
        apiKeys = rawKeys.map(k => {
            if (typeof k === 'string') return { key: k, name: 'Imported Key' };
            if (k && k.key) return k;
            return null;
        }).filter(k => k !== null);
        
        if (result.geminiApiKey) {
            geminiApiKey = result.geminiApiKey;
            if (!apiKeys.some(k => k.key === geminiApiKey)) {
                apiKeys.push({ key: geminiApiKey, name: 'Active Key' });
                chrome.storage.local.set({ apiKeys });
            }
            showView('main');
        } else {
            showView('setup');
        }
        renderKeyList();
    });

    // Success View: Copy handlers
    results.copyLight.onclick = () => copyToClipboard(wrapCssBlock(':root', themes.light), results.copyLight);
    results.copyDark.onclick = () => copyToClipboard(wrapCssBlock('.dark', themes.dark), results.copyDark);
    results.copyFull.onclick = () => copyToClipboard(
        `${wrapCssBlock(':root', themes.light)}\n\n${wrapCssBlock('.dark', themes.dark)}`,
        results.copyFull
    );

    // Show errors in the UI instead of letting them break the popup silently.
    // The handler deliberately does NOT return true: returning true cancels the
    // default logging, which made every runtime error invisible in DevTools.
    window.onerror = (message, source, lineno, colno, error) => {
        showError(error || new Error(message));
    };

    window.onunhandledrejection = (event) => {
        showError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
    };
});
