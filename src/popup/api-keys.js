const renderKeyList = () => {
    if (apiKeys.length === 0) {
        keyListEls.section.classList.add('hidden');
        return;
    }

    keyListEls.section.classList.remove('hidden');
    keyListEls.list.innerHTML = '';

    apiKeys.forEach((item) => {
        const isActive = item.key === geminiApiKey;
        const maskedKey = item.key.slice(0, 6) + '...' + item.key.slice(-4);
        
        const element = document.createElement('div');
        element.className = `key-item ${isActive ? 'active' : ''}`;
        element.innerHTML = `
            <div class="key-info">
                <div class="key-name-row">
                    <span class="key-icon">${ICONS.key}</span>
                    <span class="key-name">${item.name || 'Unnamed Key'}</span>
                </div>
                <span class="key-mask">${maskedKey}</span>
            </div>
            <div class="key-actions">
                ${isActive ? `<span class="key-status-badge">${ICONS.check} Active</span>` : `<button class="key-action-btn activate" title="Activate Key">Use</button>`}
                <button class="key-action-btn delete" title="Delete Key">${ICONS.trash}</button>
            </div>
        `;

        if (!isActive) {
            element.querySelector('.activate').onclick = () => activateKey(item.key);
        }
        element.querySelector('.delete').onclick = () => deleteKey(item.key);

        keyListEls.list.appendChild(element);
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
            if (!apiKeys.some(k => k.key === key)) {
                apiKeys.push({ key, name });
            }
            geminiApiKey = key;
            chrome.storage.local.set({ 
                geminiApiKey: key,
                apiKeys: apiKeys 
            }, () => {
                showView('main');
                performInitialScan();
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
