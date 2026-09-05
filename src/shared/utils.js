const getFriendlyError = (error) => {
    // A status code captured at the fetch site is authoritative. Substring
    // matching on the message is only a fallback for failures that never
    // produced a response, because matching on words like "key" or "limit"
    // misreports any unrelated error that happens to contain them.
    const status = error && error.status;

    if (status === 400) {
        return "Gemini rejected the request as malformed. Please try a different prompt.";
    }
    if (status === 401 || status === 403) {
        return "Invalid API Key. Please click the gear icon to reset it.";
    }
    if (status === 404) {
        return "The requested Gemini model is not available for this key or region.";
    }
    if (status === 429) {
        return "Quota exhausted. Please try again later or switch to a different API key.";
    }
    if (status >= 500) {
        return "Gemini is currently busy. Please try again in a few seconds.";
    }

    if (error && error.name === 'AbortError') {
        return "The request timed out or was cancelled.";
    }

    const msg = (error && error.message || '').toLowerCase();

    if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
        return "Connection failed. Please check your internet.";
    }

    if (error && error.message) {
        return error.message;
    }

    return "An unexpected error occurred. Please check the console for details.";
};

// Reads the body of a CSS rule by counting braces. The previous non-greedy
// regex stopped at the first "}", so a nested block or an @media wrapper in the
// model's output silently truncated the theme to a fragment while still
// reporting success.
const extractCssBlock = (css, selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const opening = new RegExp(escaped + '\\s*\\{');
    const match = opening.exec(css);
    if (!match) return null;

    const bodyStart = match.index + match[0].length;
    let depth = 1;

    for (let i = bodyStart; i < css.length; i++) {
        const char = css[i];
        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) return css.slice(bodyStart, i).trim();
        }
    }

    // Unbalanced: the stream was cut off mid-block.
    return null;
};

// Splits an accumulated alt=sse buffer into complete frame payloads. Frames are
// newline-delimited, so everything up to the last newline is complete and the
// remainder is carried into the next chunk.
const splitSseFrames = (buffer) => {
    const lines = buffer.split('\n');
    const remainder = lines.pop();
    const payloads = [];

    for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        payloads.push(payload);
    }

    return { payloads, remainder };
};

// Tailwind v4 consumes theme colours through @theme rather than a config file,
// so the variables are re-exposed as --color-* tokens pointing at the originals.
const toTailwindTheme = (lightCssBody) => {
    const lines = Object.keys(parseCssVariables(lightCssBody))
        .filter(name => name !== '--radius')
        .map(name => `  --color-${name.replace(/^--/, '')}: var(${name});`);

    return `@theme inline {\n${lines.join('\n')}\n}`;
};

const toThemeJson = (lightCssBody, darkCssBody) => JSON.stringify({
    light: parseCssVariables(lightCssBody),
    dark: parseCssVariables(darkCssBody),
}, null, 2);

const copyToClipboard = (text, element) => {
    // The label is cached on the element the first time round. Reading
    // innerHTML at click time meant a second click inside the timeout window
    // captured the "Copied" markup as the original and relabelled the button
    // permanently.
    if (element.dataset.label === undefined) {
        element.dataset.label = element.innerHTML;
    }
    if (element.dataset.copyPending === '1') return;

    navigator.clipboard.writeText(text).then(() => {
        element.dataset.copyPending = '1';
        element.innerHTML = '<span class="copy-feedback">Copied</span>';
        setTimeout(() => {
            element.innerHTML = element.dataset.label;
            delete element.dataset.copyPending;
        }, 1500);
    }).catch(() => showError(new Error("Copy failed")));
};

const extractColorsFunc = () => {
    const body = document.body;
    const root = document.documentElement;
    const btn = document.querySelector('button, a.btn, [role="button"], h1, h2');
    
    // Use a hidden canvas to normalize ALL CSS color formats (lab, oklab, named, etc.) to sRGB HEX
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');

    const hexCache = new Map();

    const computeHex = (color) => {
        // Fallback for cases where canvas might be blocked by CSP
        try {
            if (!ctx) throw new Error("Canvas blocked");
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join("").toUpperCase();
        } catch {
            // Secondary fallback: regex for rgb/rgba (limited accuracy for lab/oklch)
            const rgb = color.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                return "#" + rgb.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join("").toUpperCase();
            }
            return null;
        }
    };

    const toHex = (color) => {
        if (!color || color === 'transparent' || color === 'none' || color === 'rgba(0, 0, 0, 0)') return null;
        if (hexCache.has(color)) return hexCache.get(color);

        const hex = computeHex(color);
        hexCache.set(color, hex);
        return hex;
    };

    const getVar = (name) => {
        const val = window.getComputedStyle(root).getPropertyValue(name).trim();
        return val ? toHex(val) : null;
    };

    // Common Shadcn/Tailwind variable names to check for reference
    const vars = {};
    ['--background', '--foreground', '--primary', '--secondary', '--accent', '--muted', '--border'].forEach(v => {
        const val = getVar(v);
        if (val) vars[v] = val;
    });

    const MAX_COLORS = 60;
    const colorProperties = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
    const colorSet = new Set();

    // Walks the document the way Chrome's CSS Overview does, but stops as soon
    // as the cap is reached rather than visiting every element and slicing at
    // the end. getComputedStyle is the expensive part, so not calling it is the
    // only real saving available here.
    const allElements = document.querySelectorAll('*');

    for (let i = 0; i < allElements.length && colorSet.size < MAX_COLORS; i++) {
        const style = window.getComputedStyle(allElements[i]);

        for (let p = 0; p < colorProperties.length; p++) {
            const hex = toHex(style[colorProperties[p]]);
            if (hex) colorSet.add(hex);
        }
    }

    return {
        bg: toHex(window.getComputedStyle(body).backgroundColor) || '#ffffff',
        text: toHex(window.getComputedStyle(body).color) || '#000000',
        accent: getVar('--primary') || toHex(window.getComputedStyle(btn || body).backgroundColor) || '#000000',
        variables: vars,
        palette: Array.from(colorSet)
    };
};
