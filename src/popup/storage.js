// Everything the popup remembers between sessions. Previously only the API keys
// survived a close: the colour format reset to oklch on every open, and the
// prompt and generated theme were lost entirely.

const STORAGE_KEYS = {
    activeKey: 'geminiApiKey',
    apiKeys: 'apiKeys',
    format: 'colorFormat',
    prompt: 'lastPrompt',
    lastTheme: 'lastTheme',
    history: 'themeHistory',
    model: 'geminiModel',
    preview: 'activePreview',
};

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_HISTORY = 5;

const readStorage = (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve));
const writeStorage = (values) => new Promise(resolve => chrome.storage.local.set(values, resolve));

const persistPreferences = () => writeStorage({
    [STORAGE_KEYS.format]: selectedFormatValue,
    [STORAGE_KEYS.model]: selectedModel,
    [STORAGE_KEYS.prompt]: controls.userPrompt ? controls.userPrompt.value : '',
});

// Newest first, de-duplicated by site so repeatedly regenerating one page does
// not push everything else out of a five-entry list.
const addHistoryEntry = (entry, history) => {
    const deduped = history.filter(item => item.site !== entry.site);
    return [entry, ...deduped].slice(0, MAX_HISTORY);
};

const persistTheme = async (theme) => {
    const stored = await readStorage([STORAGE_KEYS.history]);
    const history = Array.isArray(stored[STORAGE_KEYS.history]) ? stored[STORAGE_KEYS.history] : [];

    themeHistory = addHistoryEntry(theme, history);

    await writeStorage({
        [STORAGE_KEYS.lastTheme]: theme,
        [STORAGE_KEYS.history]: themeHistory,
    });
};
