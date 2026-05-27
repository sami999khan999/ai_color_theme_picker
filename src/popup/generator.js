const performInitialScan = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || tab.url.startsWith('chrome://')) return;

    try {
        const [{ result: pageColors }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractColorsFunc
        });
    } catch (e) {
        // Silently fail initial scan
    }
};

const handleGenerate = async () => {
    if (!geminiApiKey) {
        showWarning("Missing API Key. Please click the gear icon to set it.");
        return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // Restricted pages check (Chrome doesn't allow scripting on these)
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        showError(new Error("This extension cannot run on browser system pages or restricted tabs. Please try on a regular website."));
        return;
    }

    // Tab loading check
    if (tab.status !== 'complete') {
        showWarning("The page is still loading. Please wait a moment before generating.");
        return;
    }

    isGenerating = true;
    controls.generateBtn.disabled = true;
    controls.btnContent.textContent = 'Crafting...';
    controls.arrowIcon.classList.add('hidden');
    controls.spinner.classList.remove('hidden');
    views.error.classList.add('hidden');
    
    updateStatus('Analyzing site colors...');

    try {
        // Extract dominant colors, CSS variables, and full color palette from the page
        let pageColors;
        try {
            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractColorsFunc
            });
            pageColors = result;
        } catch (e) {
            console.warn('AI Theme Picker: Extraction failed, using defaults', e);
            pageColors = { bg: '#ffffff', text: '#000000', accent: '#000000', variables: {}, palette: [] };
        }

        updateStatus('AI is crafting your theme...');
        const stylePrompt = controls.userPrompt.value.trim() || 'modern professional';
        const selectedFormat = selectedFormatValue.toUpperCase();

        // Update result badges immediately
        document.querySelectorAll('.format-badge').forEach(b => b.textContent = selectedFormat);
        
        // Format site variables for the prompt if any were found
        const varReference = Object.keys(pageColors.variables).length > 0 
            ? `\nReference Site Variables: ${JSON.stringify(pageColors.variables)}`
            : '';

        // Format extracted color palette
        const paletteReference = pageColors.palette && pageColors.palette.length > 0
            ? `\nPage Color Palette (all unique colors found on site): ${pageColors.palette.join(', ')}`
            : '';

        const systemPrompt = `You are a professional UI color expert.

### CRITICAL: USER STYLE PREFERENCE (PRIORITY)
The following styling prompt from the user MUST be prioritized above all else. Study it carefully and ensure the theme reflects this specific request:
"${stylePrompt}"

### CONTEXT
Site: ${tab.url} (${tab.title})
Analyzed Site Data: Please also analyze the site at ${tab.url} to understand its branding better. Use the extracted data follow: ${varReference}${paletteReference}

### TASK
Generate a set of Tailwind CSS variables in ${selectedFormat} format for both :root (Light) and .dark (Dark) modes.
The colors must be harmonious and modern, reflecting the source site's branding while strictly adhering to the USER STYLE PREFERENCE provided above.

Format Example (ONLY for structure, DO NOT use these specific values. Use correctly formatted ${selectedFormat} values):
:root {
  --radius: 0.65rem;
  --background: <color>;
  --foreground: <color>;
  --card: <color>;
  --card-foreground: <color>;
  --popover: <color>;
  --popover-foreground: <color>;
  --primary: <color>;
  --primary-foreground: <color>;
  --secondary: <color>;
  --secondary-foreground: <color>;
  --muted: <color>;
  --muted-foreground: <color>;
  --accent: <color>;
  --accent-foreground: <color>;
  --destructive: <color>;
  --border: <color> / <opacity>;
  --input: <color> / <opacity>;
  --ring: <color>;
  --chart-1: <color>;
  --chart-2: <color>;
  --chart-3: <color>;
  --chart-4: <color>;
  --chart-5: <color>;
  --sidebar: <color>;
  --sidebar-foreground: <color>;
  --sidebar-primary: <color>;
  --sidebar-primary-foreground: <color>;
  --sidebar-accent: <color>;
  --sidebar-accent-foreground: <color>;
  --sidebar-border: <color> / <opacity>;
  --sidebar-ring: <color>;
}

.dark {
  --background: <color>;
  --foreground: <color>;
  --card: <color>;
  --card-foreground: <color>;
  --popover: <color>;
  --popover-foreground: <color>;
  --primary: <color>;
  --primary-foreground: <color>;
  --secondary: <color>;
  --secondary-foreground: <color>;
  --muted: <color>;
  --muted-foreground: <color>;
  --accent: <color>;
  --accent-foreground: <color>;
  --destructive: <color>;
  --border: <color> / <opacity>;
  --input: <color> / <opacity>;
  --ring: <color>;
  --chart-1: <color>;
  --chart-2: <color>;
  --chart-3: <color>;
  --chart-4: <color>;
  --chart-5: <color>;
  --sidebar: <color>;
  --sidebar-foreground: <color>;
  --sidebar-primary: <color>;
  --sidebar-primary-foreground: <color>;
  --sidebar-accent: <color>;
  --sidebar-accent-foreground: <color>;
  --sidebar-border: <color> / <opacity>;
  --sidebar-ring: <color>;
}

Rules:
1. CRITICAL: Prioritize the "USER STYLE PREFERENCE" at the top.
2. Output ALL variables as FULLY WRAPPED, VALID CSS color values (e.g., oklch(L C H), rgb(R G B), hsl(H S L), etc.).
3. DO NOT output raw numbers without the color function (e.g., DO NOT use --primary: 44 132 219; instead use --primary: rgb(44, 132, 219);).
4. Output ONLY the raw CSS. No code blocks, no explanations.`;

        const requestBody = { contents: [{ parts: [{ text: systemPrompt }] }] };
        
        controls.generatingPreview.classList.remove('hidden');
        controls.liveCodeStream.textContent = '';
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:streamGenerateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errMsg = errorData.error?.message || response.statusText || `HTTP Error ${response.status}`;
            throw new Error(errMsg);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                
                let i = 0;
                while (i < buffer.length) {
                    if (buffer[i] === '{') {
                        let braceCount = 0;
                        let j = i;
                        let inString = false;
                        let escaped = false;

                        while (j < buffer.length) {
                            const char = buffer[j];
                            if (escaped) {
                                escaped = false;
                            } else if (char === '\\') {
                                escaped = true;
                            } else if (char === '"') {
                                inString = !inString;
                            } else if (!inString) {
                                if (char === '{') braceCount++;
                                else if (char === '}') braceCount--;
                            }
                            j++;
                            if (braceCount === 0) break;
                        }

                        if (braceCount === 0) {
                            const potentialJson = buffer.substring(i, j);
                            try {
                                const json = JSON.parse(potentialJson);
                                if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
                                    const chunkText = json.candidates[0].content.parts[0].text;
                                    fullText += chunkText;
                                    controls.liveCodeStream.textContent = fullText;
                                    controls.liveCodeStream.parentElement.scrollTop = controls.liveCodeStream.parentElement.scrollHeight;
                                }
                            } catch (e) {}
                            buffer = buffer.substring(j);
                            i = 0;
                        } else {
                            break; 
                        }
                    } else {
                        i++;
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        const aiText = fullText.replace(/```css|```/g, '').trim();

        const lightMatch = aiText.match(/:root\s*{([\s\S]+?)}/);
        const darkMatch = aiText.match(/\.dark\s*{([\s\S]+?)}/);

        if (lightMatch && darkMatch) {
            themes.light = lightMatch[1].trim();
            themes.dark = darkMatch[1].trim();
            
            renderPalette(themes.light, results.lightPalette);
            renderPalette(themes.dark, results.darkPalette);
            
            showView('result');
            updateStatus('Theme generated');
        } else {
            throw new Error("I received the theme data but couldn't parse the CSS colors. Please try a different prompt or check the console.");
        }
    } catch (err) {
        showError(err);
    } finally {
        isGenerating = false;
        controls.generateBtn.disabled = false;
        controls.btnContent.textContent = 'Generate Theme';
        controls.arrowIcon.classList.remove('hidden');
        controls.spinner.classList.add('hidden');
        controls.generatingPreview.classList.add('hidden');
    }
};

const initGeneratorListeners = () => {
    controls.startOver.onclick = () => {
        showView('main');
        controls.userPrompt.value = '';
    };

    controls.generateBtn.onclick = handleGenerate;

    controls.userPrompt.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey || e.shiftKey) && e.key === 'Enter') {
            e.preventDefault();
            handleGenerate();
        }
    });
};
