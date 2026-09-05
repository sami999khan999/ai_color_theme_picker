const GEMINI_MODEL = 'gemini-2.5-flash';
// Abort if the stream goes quiet for this long. Measured between chunks rather
// than over the whole request, so a slow-but-alive generation is not cut off.
const STREAM_IDLE_TIMEOUT_MS = 30000;
const RETRY_STATUSES = [429, 503];
const MAX_ATTEMPTS = 3;

let activeController = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retries only the request itself, before the body is consumed: once chunks
// have been rendered a retry would duplicate them.
const requestThemeStream = async (requestBody, signal) => {
    let lastError;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Sent as a header rather than a ?key= query parameter so the
                // key stays out of anything that records request URLs.
                'x-goog-api-key': geminiApiKey
            },
            body: JSON.stringify(requestBody),
            signal
        });

        if (response.ok) return response;

        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || response.statusText || `HTTP Error ${response.status}`;
        lastError = new Error(message);
        lastError.status = response.status;

        const isLastAttempt = attempt === MAX_ATTEMPTS - 1;
        if (!RETRY_STATUSES.includes(response.status) || isLastAttempt) throw lastError;

        const backoffMs = 1000 * Math.pow(2, attempt);
        updateStatus(`Gemini is busy, retrying in ${backoffMs / 1000}s...`);
        await sleep(backoffMs);
    }

    throw lastError;
};

const handleGenerate = async () => {
    if (isGenerating) return;

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
  --border: <color>;
  --input: <color>;
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
  --sidebar-border: <color>;
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
  --border: <color>;
  --input: <color>;
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
  --sidebar-border: <color>;
  --sidebar-ring: <color>;
}

Rules:
1. CRITICAL: Prioritize the "USER STYLE PREFERENCE" at the top.
2. Output ALL variables as FULLY WRAPPED, VALID CSS color values (e.g., oklch(L C H), rgb(R G B), hsl(H S L), etc.).
3. DO NOT output raw numbers without the color function (e.g., DO NOT use --primary: 44 132 219; instead use --primary: rgb(44, 132, 219);).
4. For translucent values (--border, --input, --sidebar-border), put the alpha INSIDE the color function, e.g. oklch(1 0 0 / 10%) or rgb(255 255 255 / 10%). Never write a color followed by a bare slash.
5. Output ONLY the raw CSS. No code blocks, no explanations.`;

        const requestBody = { contents: [{ parts: [{ text: systemPrompt }] }] };
        
        controls.generatingPreview.classList.remove('hidden');
        controls.liveCodeStream.textContent = '';
        
        const controller = new AbortController();
        activeController = controller;
        let idleTimer = null;
        const resetIdleTimer = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS);
        };

        let fullText = '';
        let buffer = '';
        let blockReason = '';
        let finishReason = '';

        try {
            resetIdleTimer();
            const response = await requestThemeStream(requestBody, controller.signal);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    resetIdleTimer();

                    buffer += decoder.decode(value, { stream: true });

                    const { payloads, remainder } = splitSseFrames(buffer);
                    buffer = remainder;

                    for (const payload of payloads) {
                        let json;
                        try {
                            json = JSON.parse(payload);
                        } catch (e) {
                            console.warn('AI Theme Picker: skipping unparsable stream frame', e);
                            continue;
                        }

                        blockReason = json.promptFeedback?.blockReason || blockReason;
                        finishReason = json.candidates?.[0]?.finishReason || finishReason;

                        const chunkText = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (chunkText) {
                            fullText += chunkText;
                            controls.liveCodeStream.textContent = fullText;
                            controls.liveCodeStream.parentElement.scrollTop = controls.liveCodeStream.parentElement.scrollHeight;
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } finally {
            clearTimeout(idleTimer);
            activeController = null;
        }

        if (blockReason) {
            throw new Error(`Gemini blocked this request (${blockReason}). Try rephrasing your prompt.`);
        }
        if (!fullText.trim()) {
            throw new Error(finishReason
                ? `Gemini returned no content (${finishReason}). Try a different prompt.`
                : "Gemini returned an empty response. Please try again.");
        }

        const aiText = fullText.replace(/```css|```/g, '').trim();

        const light = extractCssBlock(aiText, ':root');
        const dark = extractCssBlock(aiText, '.dark');

        if (light && dark) {
            themes.light = light;
            themes.dark = dark;
            
            renderPalette(themes.light, results.lightPalette);
            renderPalette(themes.dark, results.darkPalette);
            
            showView('result');
            updateStatus('Theme generated');
        } else {
            throw new Error("I received the theme data but couldn't parse the CSS colors. Please try a different prompt or check the console.");
        }
    } catch (err) {
        // A cancel or idle-timeout is a user-facing notice, not a failure.
        if (err && err.name === 'AbortError') {
            showWarning("Generation cancelled.");
        } else {
            showError(err);
        }
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

    if (controls.cancelGenerate) {
        controls.cancelGenerate.onclick = () => {
            if (activeController) activeController.abort();
        };
    }

    controls.userPrompt.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleGenerate();
        }
    });
};
