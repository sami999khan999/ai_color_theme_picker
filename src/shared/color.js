// sRGB / WCAG maths. Deliberately DOM-free so it can be unit-tested directly;
// converting a CSS colour string to RGB needs a browser, so that converter is
// injected rather than imported.

const srgbChannelToLinear = (channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const relativeLuminance = (rgb) =>
    0.2126 * srgbChannelToLinear(rgb[0]) +
    0.7152 * srgbChannelToLinear(rgb[1]) +
    0.0722 * srgbChannelToLinear(rgb[2]);

const contrastRatio = (rgbA, rgbB) => {
    const a = relativeLuminance(rgbA);
    const b = relativeLuminance(rgbB);
    const lighter = Math.max(a, b);
    const darker = Math.min(a, b);
    return (lighter + 0.05) / (darker + 0.05);
};

// WCAG 2.1 thresholds for text on a background.
const wcagLevel = (ratio) => {
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    if (ratio >= 3) return 'AA Large';
    return 'Fail';
};

// The shadcn variables where one is explicitly the readable foreground for
// another. Variables outside this list carry no contrast requirement.
const CONTRAST_PAIRS = [
    ['--background', '--foreground'],
    ['--card', '--card-foreground'],
    ['--popover', '--popover-foreground'],
    ['--primary', '--primary-foreground'],
    ['--secondary', '--secondary-foreground'],
    ['--muted', '--muted-foreground'],
    ['--accent', '--accent-foreground'],
    ['--sidebar', '--sidebar-foreground'],
    ['--sidebar-primary', '--sidebar-primary-foreground'],
    ['--sidebar-accent', '--sidebar-accent-foreground'],
];

const parseCssVariables = (cssBody) => {
    const vars = {};
    const regex = /(--[\w-]+):\s*([^;]+);/g;
    let match;

    while ((match = regex.exec(cssBody)) !== null) {
        vars[match[1]] = match[2].trim();
    }

    return vars;
};

// `toRgb` takes a CSS colour string and returns [r, g, b] or null.
const auditContrast = (cssBody, toRgb) => {
    const vars = parseCssVariables(cssBody);
    const report = [];

    for (const [bgName, fgName] of CONTRAST_PAIRS) {
        const bgValue = vars[bgName];
        const fgValue = vars[fgName];
        if (!bgValue || !fgValue) continue;

        const bg = toRgb(bgValue);
        const fg = toRgb(fgValue);
        if (!bg || !fg) continue;

        const ratio = contrastRatio(bg, fg);

        report.push({
            label: bgName.replace(/^--/, ''),
            background: bgValue,
            foreground: fgValue,
            ratio: Math.round(ratio * 100) / 100,
            level: wcagLevel(ratio),
            passesAA: ratio >= 4.5,
        });
    }

    return report;
};
