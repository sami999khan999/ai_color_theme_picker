const getFriendlyError = (error) => {
    const msg = (error.message || '').toLowerCase();
    
    // Network errors
    if (msg.includes('failed to fetch') || msg.includes('network')) {
        return "Connection failed. Please check your internet.";
    }

    // Quota / Rate Limit detection
    const isQuotaWarning = msg.includes('quota') || msg.includes('limit') || msg.includes('429') || msg.includes('exhausted') || msg.includes('exceeded');
    
    if (isQuotaWarning) {
        return "Quota is expired! Please try again tomorrow or use a different API key.";
    }

    // Auth / API Key
    if (msg.includes('key') || msg.includes('401') || msg.includes('403')) {
        return "Invalid API Key. Please click the ⚙️ icon to reset it.";
    }

    // Model issues
    if (msg.includes('model') && (msg.includes('not found') || msg.includes('404'))) {
        return "Model 'gemini-2.5-flash' not found (404). Please ensure this model is available in your region or try again later.";
    }

    // Server issues
    if (msg.includes('500') || msg.includes('503') || msg.includes('overloaded')) {
        return "Gemini is currently busy. Please try again in 10 seconds.";
    }

    // Safety / Content
    if (msg.includes('safety') || msg.includes('blocked')) {
        return "The request was blocked by AI safety filters. Try a different prompt.";
    }

    // Catch-all for other errors, ensuring we show the original message if possible
    if (error.message && error.message.length > 0) {
        return error.message;
    }

    return "An unexpected error occurred. Please check the console for details.";
};

const copyToClipboard = (text, element) => {
    navigator.clipboard.writeText(text).then(() => {
        const original = element.innerHTML;
        element.innerHTML = '<span style="color: var(--success); font-weight: 700;">Copied</span>';
        setTimeout(() => element.innerHTML = original, 1500);
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

    const toHex = (color) => {
        if (!color || color === 'transparent' || color === 'none' || color === 'rgba(0, 0, 0, 0)') return null;
        
        // Fallback for cases where canvas might be blocked by CSP
        try {
            if (!ctx) throw new Error("Canvas blocked");
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join("").toUpperCase();
        } catch (e) {
            // Secondary fallback: regex for rgb/rgba (limited accuracy for lab/oklch)
            const rgb = color.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                return "#" + rgb.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join("").toUpperCase();
            }
            return null;
        }
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

    const colorProperties = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
    const colorSet = new Set();
    
    // Get ALL elements on the page (mimics Chrome CSS Overview)
    const allElements = document.querySelectorAll('*');

    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        
        colorProperties.forEach(prop => {
            const value = style[prop];
            const hex = toHex(value);
            if (hex) colorSet.add(hex);
        });
    });

    return {
        bg: toHex(window.getComputedStyle(body).backgroundColor) || '#ffffff',
        text: toHex(window.getComputedStyle(body).color) || '#000000',
        accent: getVar('--primary') || toHex(window.getComputedStyle(btn || body).backgroundColor) || '#000000',
        variables: vars,
        palette: Array.from(colorSet).slice(0, 60) // Limit to 60 colors to avoid prompt bloat
    };
};
