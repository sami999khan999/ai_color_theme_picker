// Puts the stored format, model, prompt and history back in place. Only the API
// keys used to survive a popup close.
const restorePreferences = (stored) => {
    applyFormatSelection(stored[STORAGE_KEYS.format]);

    selectedModel = stored[STORAGE_KEYS.model] || DEFAULT_MODEL;
    if (controls.modelSelect) controls.modelSelect.value = selectedModel;

    if (stored[STORAGE_KEYS.prompt] && controls.userPrompt) {
        controls.userPrompt.value = stored[STORAGE_KEYS.prompt];
    }

    themeHistory = Array.isArray(stored[STORAGE_KEYS.history]) ? stored[STORAGE_KEYS.history] : [];

    const last = stored[STORAGE_KEYS.lastTheme];
    if (last && last.light && last.dark) {
        themes.light = last.light;
        themes.dark = last.dark;
    }
};

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

    if (controls.modelSelect) {
        controls.modelSelect.onchange = () => {
            selectedModel = controls.modelSelect.value;
            persistPreferences();
        };
    }

    // Load stored keys, preferences and history.
    chrome.storage.local.get(Object.values(STORAGE_KEYS), (result) => {
        const rawKeys = result.apiKeys || [];
        // Migration: Convert string keys to objects if necessary
        apiKeys = rawKeys.map(k => {
            if (typeof k === 'string') return { key: k, name: 'Imported Key' };
            if (k && k.key) return k;
            return null;
        }).filter(k => k !== null);
        
        restorePreferences(result);

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
        renderHistory();
        restorePreviewState();
    });

    // Success View: Copy handlers
    results.copyLight.onclick = () => copyToClipboard(wrapCssBlock(':root', themes.light), results.copyLight);
    results.copyDark.onclick = () => copyToClipboard(wrapCssBlock('.dark', themes.dark), results.copyDark);
    results.copyFull.onclick = () => copyToClipboard(
        `${wrapCssBlock(':root', themes.light)}\n\n${wrapCssBlock('.dark', themes.dark)}`,
        results.copyFull
    );

    if (results.copyTailwind) {
        results.copyTailwind.onclick = () =>
            copyToClipboard(toTailwindTheme(themes.light), results.copyTailwind);
    }

    if (results.copyJson) {
        results.copyJson.onclick = () =>
            copyToClipboard(toThemeJson(themes.light, themes.dark), results.copyJson);
    }

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
