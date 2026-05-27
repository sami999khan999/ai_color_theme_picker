// UI Elements
const views = {
    setup: document.getElementById('setup-view'),
    main: document.getElementById('main-view'),
    result: document.getElementById('result-view'),
    error: document.getElementById('error-display')
};

const keyListEls = {
    section: document.getElementById('key-list-section'),
    list: document.getElementById('key-list')
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
    lightPalette: document.getElementById('light-palette'),
    darkPalette: document.getElementById('dark-palette')
};

let selectedFormatValue = 'oklch';
let geminiApiKey = '';
let apiKeys = [];
let themes = { light: '', dark: '' };
let currentView = '';
let isGenerating = false;
