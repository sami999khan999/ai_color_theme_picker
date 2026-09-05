// Key names are free-form user input. They are rendered with textContent, never
// innerHTML: this list lives in the popup's privileged context, which can read
// every saved key out of chrome.storage.local. innerHTML is reserved for the
// trusted SVG constants in ICONS.
const maskKey = (key) => {
    if (typeof key !== 'string' || key.length === 0) return '';
    // Short keys have no safe window to reveal, so mask them entirely rather
    // than letting slice(0, 6) and slice(-4) overlap and duplicate characters.
    if (key.length <= 10) return '•'.repeat(key.length);
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
};

const buildKeyRow = (item, isActive) => {
    const row = document.createElement('div');
    row.className = isActive ? 'key-item active' : 'key-item';

    const icon = document.createElement('span');
    icon.className = 'key-icon';
    icon.innerHTML = ICONS.key;

    const name = document.createElement('span');
    name.className = 'key-name';
    name.textContent = item.name || 'Unnamed Key';

    const nameRow = document.createElement('div');
    nameRow.className = 'key-name-row';
    nameRow.append(icon, name);

    const mask = document.createElement('span');
    mask.className = 'key-mask';
    mask.textContent = maskKey(item.key);

    const info = document.createElement('div');
    info.className = 'key-info';
    info.append(nameRow, mask);

    const actions = document.createElement('div');
    actions.className = 'key-actions';

    if (isActive) {
        const badge = document.createElement('span');
        badge.className = 'key-status-badge';
        badge.innerHTML = ICONS.check;
        badge.append(' Active');
        actions.appendChild(badge);
    } else {
        const activate = document.createElement('button');
        activate.className = 'key-action-btn activate';
        activate.title = 'Activate Key';
        activate.textContent = 'Use';
        activate.onclick = () => activateKey(item.key);
        actions.appendChild(activate);
    }

    // Deleting used to be one unconfirmed click, and a stored key cannot be
    // read back out of the UI to recover it. The button arms itself first and
    // disarms again after a few seconds.
    const remove = document.createElement('button');
    remove.className = 'key-action-btn delete';
    remove.title = 'Delete Key';
    remove.setAttribute('aria-label', `Delete key ${item.name || 'Unnamed Key'}`);
    remove.innerHTML = ICONS.trash;

    let disarmTimer = null;
    const disarm = () => {
        clearTimeout(disarmTimer);
        remove.classList.remove('armed');
        delete remove.dataset.armed;
        remove.innerHTML = ICONS.trash;
        remove.title = 'Delete Key';
    };

    remove.onclick = () => {
        if (remove.dataset.armed === '1') {
            disarm();
            deleteKey(item.key);
            return;
        }

        remove.dataset.armed = '1';
        remove.classList.add('armed');
        remove.textContent = 'Confirm';
        remove.title = 'Click again to delete this key';
        disarmTimer = setTimeout(disarm, 4000);
    };

    actions.appendChild(remove);

    row.append(info, actions);
    return row;
};

const renderKeyList = () => {
    if (apiKeys.length === 0) {
        keyListEls.section.classList.add('hidden');
        return;
    }

    keyListEls.section.classList.remove('hidden');
    keyListEls.list.replaceChildren();

    apiKeys.forEach((item) => {
        keyListEls.list.appendChild(buildKeyRow(item, item.key === geminiApiKey));
    });
};

const activateKey = (key) => {
    geminiApiKey = key;
    chrome.storage.local.set({ geminiApiKey: key }, () => {
        renderKeyList();
        showView('main');
        updateStatus('Key Activated');
    });
};

const deleteKey = (key) => {
    apiKeys = apiKeys.filter(k => k.key !== key);
    const updates = { apiKeys: apiKeys };

    if (geminiApiKey === key) {
        geminiApiKey = apiKeys.length > 0 ? apiKeys[0].key : '';
        updates.geminiApiKey = geminiApiKey;
    }

    chrome.storage.local.set(updates, () => {
        renderKeyList();
        if (!geminiApiKey) {
            showView('setup');
        }
    });
};

const initApiKeyListeners = () => {
    controls.saveKey.onclick = () => {
        const name = controls.apiKeyName.value.trim() || 'My Key';
        const key = controls.apiKey.value.trim();

        if (key) {
            const existing = apiKeys.find(k => k.key === key);
            if (existing) {
                // Re-saving a known key is how the UI renames it, so take the
                // new name instead of silently discarding it.
                existing.name = name;
            } else {
                apiKeys.push({ key, name });
            }
            geminiApiKey = key;
            chrome.storage.local.set({
                geminiApiKey: key,
                apiKeys: apiKeys
            }, () => {
                showView('main');
                controls.apiKey.value = '';
                controls.apiKeyName.value = '';
                renderKeyList();
            });
        } else {
            showWarning("API Key cannot be empty");
            controls.apiKey.classList.add('error-input');
            setTimeout(() => controls.apiKey.classList.remove('error-input'), 2000);
        }
    };

    controls.resetApi.onclick = () => {
        if (currentView === 'setup') {
            if (geminiApiKey) showView('main');
        } else {
            showView('setup');
        }
    };
};
