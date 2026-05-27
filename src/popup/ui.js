const updateStatus = (text) => {
    controls.statusText.textContent = text;
};

const showView = (viewName) => {
    currentView = viewName;
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    views.error.classList.add('hidden');
    updateStatus(viewName === 'setup' ? 'Authentication Required' : 'Ready');

    if (viewName === 'setup') {
        renderKeyList();
    }
    
    // Toggle the header button icon and function
    if (viewName === 'setup') {
        controls.resetApi.innerHTML = ICONS.back;
        controls.resetApi.title = "Back to Generator";
        if (!geminiApiKey) {
            controls.resetApi.classList.add('hidden');
        } else {
            controls.resetApi.classList.remove('hidden');
        }
    } else {
        controls.resetApi.innerHTML = ICONS.settings;
        controls.resetApi.title = "API Settings";
        controls.resetApi.classList.remove('hidden');
    }
};

const showWarning = (message) => {
    if (!views.error) return;
    views.error.textContent = message;
    views.error.classList.add('warning');
    views.error.classList.remove('hidden');
    updateStatus('Notice');
    
    views.error.classList.add('shake');
    setTimeout(() => {
        if (views.error) views.error.classList.remove('shake');
    }, 400);
    
    setTimeout(() => {
        if (views.error) {
            views.error.classList.add('hidden');
            views.error.classList.remove('warning');
        }
        if (controls.statusText && controls.statusText.textContent === 'Notice') {
            updateStatus('Ready');
        }
    }, 4000);
};

const showError = (error) => {
    const msg = (error?.message || String(error)).toLowerCase();
    const isValidationOrQuota = msg.includes('api key') || 
                                msg.includes('missing') || 
                                msg.includes('429') || 
                                msg.includes('quota') || 
                                msg.includes('limit') ||
                                msg.includes('exhausted');

    if (!views.error) return;

    const friendlyMsg = getFriendlyError(error);
    views.error.textContent = friendlyMsg;
    
    if (isValidationOrQuota) {
        views.error.classList.add('warning');
        updateStatus('Notice');
    } else {
        views.error.classList.remove('warning');
        updateStatus('Error occurred');
    }

    views.error.classList.remove('hidden');
    
    views.error.classList.add('shake');
    setTimeout(() => {
        if (views.error) views.error.classList.remove('shake');
    }, 400);
    
    setTimeout(() => {
        if (views.error) {
            views.error.classList.add('hidden');
            views.error.classList.remove('warning');
        }
        if (controls.statusText && (controls.statusText.textContent === 'Error occurred' || controls.statusText.textContent === 'Notice')) {
            updateStatus('Ready');
        }
    }, 6000);
};

const renderPalette = (cssString, container) => {
    container.innerHTML = '';
    const regex = /(--[\w-]+):\s*([^;]+);/g;
    let match;
    while ((match = regex.exec(cssString)) !== null) {
        const [_, name, value] = match;
        if (name === '--radius') continue;

        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        
        const box = document.createElement('div');
        box.className = 'swatch-box';
        
        let finalValue = value.trim();
        // Safety: If the AI outputs raw numbers (e.g., "73 73 70"), wrap it in the current format
        if (/^[\d.\s,%/]+$/.test(finalValue) && !finalValue.includes('(')) {
            finalValue = `${selectedFormatValue.toLowerCase()}(${finalValue})`;
        }
        
        box.style.backgroundColor = finalValue;
        
        const label = document.createElement('span');
        label.className = 'swatch-name';
        label.textContent = name.replace('--', '');
        
        swatch.appendChild(box);
        swatch.appendChild(label);
        swatch.title = `${name}: ${value}`;
        container.appendChild(swatch);
    }
};

// Custom Dropdown Initialization
const initDropdown = () => {
    if (customDropdown.header) {
        customDropdown.header.onclick = (e) => {
            e.stopPropagation();
            const isOpen = customDropdown.container.classList.toggle('open');
            customDropdown.options.classList.toggle('hidden', !isOpen);
        };

        customDropdown.items.forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                const val = item.getAttribute('data-value');
                selectedFormatValue = val;
                customDropdown.label.textContent = item.textContent;
                
                customDropdown.items.forEach(opt => opt.classList.remove('active'));
                item.classList.add('active');
                
                customDropdown.container.classList.remove('open');
                customDropdown.options.classList.add('hidden');
            };
        });
    }

    // Global click listener to close dropdowns
    window.addEventListener('click', () => {
        if (customDropdown.container) {
            customDropdown.container.classList.remove('open');
            customDropdown.options.classList.add('hidden');
        }
    });
};
