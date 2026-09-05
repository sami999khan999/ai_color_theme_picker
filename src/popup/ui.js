const updateStatus = (text) => {
    controls.statusText.textContent = text;
};

// Focus followed nothing when views were swapped, leaving keyboard focus on an
// element inside a now-hidden section.
const VIEW_FOCUS_TARGET = {
    setup: () => controls.apiKey,
    main: () => controls.userPrompt,
    result: () => results.copyLight
};

const showView = (viewName) => {
    currentView = viewName;
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    hideMessage();
    updateStatus(viewName === 'setup' ? 'Authentication Required' : 'Ready');

    const focusTarget = VIEW_FOCUS_TARGET[viewName] && VIEW_FOCUS_TARGET[viewName]();
    if (focusTarget) focusTarget.focus();

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

const hideMessage = () => {
    if (!views.error) return;
    views.error.classList.add('hidden');
    views.error.classList.remove('warning');
};

// Messages stay until dismissed. They used to auto-hide after 4s (warnings) or
// 6s (errors), which removed them mid-read, and the strip carried no role so a
// screen reader never announced it at all.
const showMessage = (message, { isWarning }) => {
    if (!views.error || !errorEls.text) return;

    errorEls.text.textContent = message;
    views.error.classList.toggle('warning', isWarning);
    views.error.classList.remove('hidden');
    updateStatus(isWarning ? 'Notice' : 'Error occurred');

    views.error.classList.add('shake');
    setTimeout(() => {
        if (views.error) views.error.classList.remove('shake');
    }, 400);
};

const showWarning = (message) => showMessage(message, { isWarning: true });

const showError = (error) => {
    const status = error && error.status;
    const isNotice = status === 429 || (error && error.name === 'AbortError')
        || /api key|missing/i.test((error && error.message) || '');

    showMessage(getFriendlyError(error), { isWarning: isNotice });
};

const initMessageDismiss = () => {
    if (errorEls.dismiss) {
        errorEls.dismiss.onclick = () => {
            hideMessage();
            updateStatus('Ready');
        };
    }
};

const renderPalette = (cssString, container) => {
    container.innerHTML = '';
    const regex = /(--[\w-]+):\s*([^;]+);/g;
    let match;
    while ((match = regex.exec(cssString)) !== null) {
        const [, name, value] = match;
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

        // An invalid value is dropped silently by the browser, leaving a blank
        // box with nothing to say the model produced uncompilable CSS.
        const isRenderable = typeof CSS !== 'undefined' && CSS.supports
            ? CSS.supports('color', finalValue)
            : true;

        if (isRenderable) {
            box.style.backgroundColor = finalValue;
        } else {
            box.classList.add('swatch-invalid');
            box.textContent = '!';
        }
        
        const label = document.createElement('span');
        label.className = 'swatch-name';
        label.textContent = name.replace('--', '');
        
        swatch.appendChild(box);
        swatch.appendChild(label);
        swatch.title = isRenderable ? `${name}: ${value}` : `${name}: ${value} — not a valid CSS color`;
        container.appendChild(swatch);
    }
};

// The dropdown is a listbox: it owns roving focus across its options and
// responds to the arrow/Home/End/Enter/Escape keys a native select would.
const initDropdown = () => {
    const { container, header, label, options, items } = customDropdown;
    if (!header) return;

    const setOpen = (open) => {
        container.classList.toggle('open', open);
        options.classList.toggle('hidden', !open);
        header.setAttribute('aria-expanded', String(open));
    };

    const focusItem = (index) => {
        items[(index + items.length) % items.length].focus();
    };

    const selectItem = (item) => {
        selectedFormatValue = item.getAttribute('data-value');
        label.textContent = item.textContent;

        items.forEach((opt) => {
            const isSelected = opt === item;
            opt.classList.toggle('active', isSelected);
            opt.setAttribute('aria-selected', String(isSelected));
        });

        setOpen(false);
        header.focus();
    };

    const openAtSelection = () => {
        setOpen(true);
        const current = items.findIndex(i => i.getAttribute('data-value') === selectedFormatValue);
        focusItem(current === -1 ? 0 : current);
    };

    setOpen(false);

    header.onclick = (e) => {
        e.stopPropagation();
        if (container.classList.contains('open')) {
            setOpen(false);
        } else {
            openAtSelection();
        }
    };

    // Enter and Space already fire click on a <button>; only the arrow keys
    // need handling here.
    header.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            openAtSelection();
        }
    });

    items.forEach((item, index) => {
        item.onclick = (e) => {
            e.stopPropagation();
            selectItem(item);
        };

        item.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowDown': e.preventDefault(); focusItem(index + 1); break;
                case 'ArrowUp': e.preventDefault(); focusItem(index - 1); break;
                case 'Home': e.preventDefault(); focusItem(0); break;
                case 'End': e.preventDefault(); focusItem(items.length - 1); break;
                case 'Enter':
                case ' ': e.preventDefault(); selectItem(item); break;
                case 'Escape':
                case 'Tab': setOpen(false); header.focus(); break;
                default: break;
            }
            e.stopPropagation();
        });
    });

    // Close on an outside click.
    window.addEventListener('click', () => setOpen(false));
};
