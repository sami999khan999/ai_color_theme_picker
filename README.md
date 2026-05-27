# Color Theme Picker (Theme AI)

A premium, AI-powered Chrome extension designed to help developers and designers craft perfect color palettes. It analyzes your current website's brand identity and uses Gemini AI to generate harmonious Tailwind CSS variables for both light and dark modes.

## 🚀 Key Features

### 1. Intelligent Context Awareness
- **Site Analysis**: Automatically extracts dominant colors, active CSS variables, and the full color palette from any open tab.
- **Brand Synergy**: Uses the extracted data as a foundation to ensure generated themes remain consistent with your existing brand identity.
- **Modern Color Formats**: Seamlessly converts and generates colors in **OKLCH (Modern)**, HEX, RGB, HSL, and LCH.

### 2. AI-Powered Theme Crafting
- **Gemini Integration**: Leverages the high-performance Gemini 1.5 Flash model to interpret complex styling prompts.
- **Priority Prompts**: Fine-tune your results with custom prompts (e.g., "Sleek SaaS dashboard with slate tones" or "Vibrant cyberpunk neon").
- **Live Stream Preview**: Watch in real-time as the AI "crafts" your CSS variables with a dynamic code-streaming interface.

### 3. Tailwind CSS & shadcn/ui Ready
- **Full Variable Set**: Generates a comprehensive list of variables including `--background`, `--primary`, `--accent`, `--muted`, and more.
- **Dual Mode Support**: Instantly provides optimized configurations for both `:root` (Light) and `.dark` (Dark) modes.
- **One-Click Export**: Copy individual light/dark blocks or the entire CSS configuration with a single click.

### 4. Advanced Key Management
- **Secure Profiles**: Store and manage multiple Gemini API keys with descriptive names (e.g., "Personal", "Work").
- **Easy Setup**: Direct links to Google AI Studio to help you get started with a free key in seconds.
- **Quick Reset**: Easily switch or clear your keys through the integrated settings menu.

### 5. Premium UI/UX
- **Modern Aesthetic**: A sleek, dark-themed interface built with Inter and Plus Jakarta Sans typography.
- **Interactive Previews**: Instantly visualize your generated colors with live swatch grids for both light and dark modes.
- **Keyboard Optimized**: Use `⌘G` (macOS) or `Ctrl+G` (Windows/Linux) to trigger generation instantly.

---

## 🛠 Technical Architecture

The project follows a modular, dependency-free architecture to ensure maximum performance and maintainability.

- **`src/shared/`**: Contains core utilities for color normalization (Canvas-based rendering) and the centralized `icons.js` library.
- **`src/popup/`**: The main application layer, handling `state.js` management, `generator.js` AI logic, and `ui.js` view transitions.
- **`src/content/`**: High-performance scripts for non-invasive DOM scanning and color extraction.
- **`src/init/`**: Bootstrapping logic and application initialization.

### Optimization & Build
To maintain a small footprint without external dependencies, the project uses a custom **`build.js`** environment:
- **Concatenation**: Merges 7 modular source files into a single, optimized `dist/popup.js`.
- **Dependency Flow**: Enforces a strict order of operations (Shared Utils → State → UI → Generator).
- **Native APIs**: Built entirely on standard Web APIs and Chrome Extension Manifest V3.

---

## 📦 Installation (Development)

1. Clone this repository or download the source code.
2. Ensure you have [Node.js](https://nodejs.org/) installed.
3. Run the optimized build script to generate the production bundle:
   ```bash
   node build.js
   ```
4. Open Chrome and navigate to `chrome://extensions`.
5. Enable **Developer mode** in the top-right corner.
6. Click **Load unpacked** and select the project root folder.

---

## ⚙️ Customization

Open the extension popup and click the **Gear Icon** to:
- Add, select, or delete your **Gemini API Keys**.
- Change the **Color Format** (OKLCH, HEX, RGB, etc.) for the next generation.
- Clear your custom prompt and start a fresh session.

---

## 🔒 Privacy & Local-First

- **Direct Communication**: The extension communicates directly with Google's Gemini API. No middle-man servers or telemetry.
- **Local Storage**: Your API keys and settings are stored locally on your device using `chrome.storage.local`.
- **No Tracking**: We do not track your prompts, the sites you visit, or the themes you generate.
