document.addEventListener('DOMContentLoaded', () => {
    // Initialize component logic
    initDropdown();
    initApiKeyListeners();
    initGeneratorListeners();

    // Load API Keys and perform initial scan
    chrome.storage.local.get(['geminiApiKey', 'apiKeys'], (result) => {
        let rawKeys = result.apiKeys || [];
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
            performInitialScan();
        } else {
            showView('setup');
        }
        renderKeyList();
    });

    // Success View: Copy handlers
    results.copyLight.onclick = () => copyToClipboard(`:root {\n  ${themes.light}\n}`, results.copyLight);
    results.copyDark.onclick = () => copyToClipboard(`.dark {\n  ${themes.dark}\n}`, results.copyDark);
    results.copyFull.onclick = () => copyToClipboard(`:root {\n  ${themes.light}\n}\n\n.dark {\n  ${themes.dark}\n}`, results.copyFull);

    // Global Error Handling to prevent "breaking errors"
    window.onerror = (message, source, lineno, colno, error) => {
        showError(error || new Error(message));
        return true; 
    };

    window.onunhandledrejection = (event) => {
        showError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
    };
});
