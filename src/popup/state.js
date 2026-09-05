// UI Elements
const views = {
    setup: document.getElementById('setup-view'),
    main: document.getElementById('main-view'),
    result: document.getElementById('result-view'),
    error: document.getElementById('error-display')
};

const errorEls = {
    text: document.getElementById('error-text'),
    dismiss: document.getElementById('error-dismiss')
};

const keyListEls = {
    section: document.getElementById('key-list-section'),
    list: document.getElementById('key-list')
};

const historyEls = {
    section: document.getElementById('history-section'),
    list: document.getElementById('history-list')
};

const controls = {
    apiKeyName: document.getElementById('api-key-name'),
    apiKey: document.getElementById('api-key'),
    saveKey: document.getElementById('save-key'),
    resetApi: document.getElementById('reset-api'),
    userPrompt: document.getElementById('user-prompt'),
    generateBtn: document.getElementById('generate-btn'),
    btnContent: document.getElementById('btn-content'),
    spinner: document.getElementById('spinner'),
    arrowIcon: document.getElementById('arrow-icon'),
    startOver: document.getElementById('start-over'),
    statusText: document.getElementById('system-status'),
    generatingPreview: document.getElementById('generating-preview'),
    liveCodeStream: document.getElementById('live-code-stream'),
    cancelGenerate: document.getElementById('cancel-generate'),
    modelSelect: document.getElementById('model-select'),
    previewToggle: document.getElementById('preview-toggle'),
    previewToggleLabel: document.getElementById('preview-toggle-label'),
    shortcutHint: document.getElementById('shortcut-hint'),
    shortcutKbd: document.getElementById('shortcut-kbd'),
};

const customDropdown = {
    container: document.getElementById('custom-dropdown'),
    header: document.getElementById('dropdown-header'),
    label: document.getElementById('selected-format-label'),
    options: document.getElementById('dropdown-options'),
    items: Array.from(document.querySelectorAll('.option'))
};

const results = {
    copyLight: document.getElementById('copy-light'),
    copyDark: document.getElementById('copy-dark'),
    copyFull: document.getElementById('copy-full'),
    copyTailwind: document.getElementById('copy-tailwind'),
    copyJson: document.getElementById('copy-json'),
    contrastSummary: document.getElementById('contrast-summary'),
    contrastList: document.getElementById('contrast-list'),
    lightPalette: document.getElementById('light-palette'),
    darkPalette: document.getElementById('dark-palette')
};

let selectedFormatValue = 'oklch';
let selectedModel = 'gemini-2.5-flash';
let themeHistory = [];
let previewTabId = null;
let geminiApiKey = '';
let apiKeys = [];
const themes = { light: '', dark: '' };
let currentView = '';
let isGenerating = false;
