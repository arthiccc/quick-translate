# Quick Translate

Lightning-fast translation Chrome/Brave extension using Chrome's built-in AI.

## Features

- **Selection Translation**: Select text → Right-click → "Translate selection"
- **Full Page Translation**: Right-click anywhere → "Translate entire page" (bilingual mode shows original + translated)
- **Hover Translation**: Hover over paragraphs to see instant translations

## Requirements

- **Chrome 138+** or **Brave** (141+ recommended)
- Enable Chrome AI flags (see below)

## Installation

### 1. Enable Chrome AI (Required)

1. Open `chrome://flags` (or `brave://flags`)
2. Search for and enable: `#optimization-guide-on-device-model`
3. Relaunch browser
4. First use will download ~3GB AI model (one-time, automatic)

### 2. Load Extension

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `quick-translate` folder

## Usage

### Quick Selection Translation
1. Select any text on a webpage
2. Right-click → "Translate selection"
3. Translation appears in a popup

### Full Page Translation
1. Right-click anywhere on page
2. Click "Translate entire page"
3. Bilingual view shows original + translated text
4. Click "Restore Original" button to undo

### Hover Translation
1. Hover over a paragraph for 300ms (configurable)
2. Translation tooltip appears near cursor
3. Toggle on/off via right-click menu

## Settings

Click the extension icon to access:
- **Target Language**: Default language to translate to
- **Hover to translate**: Enable/disable hover feature
- **Bilingual mode**: Show both languages on page translation
- **Hover delay**: Time before translation appears (100-2000ms)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Chrome Extension                    │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Background.js│  │ Content.js   │                 │
│  │ (Service     │  │ (DOM access, │                 │
│  │  Worker)     │  │  UI overlay) │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│            Chrome Built-in AI APIs                   │
│  ┌────────────────┐  ┌────────────────────┐         │
│  │ Translator API │  │ LanguageDetector   │         │
│  │ (Gemini Nano)  │  │ API                │         │
│  └────────────────┘  └────────────────────┘         │
│                                                      │
│  ✓ Zero latency (local processing)                   │
│  ✓ Completely private (data never leaves device)     │
│  ✓ Works offline after model download                │
│  ✓ No API costs                                      │
└─────────────────────────────────────────────────────┘
```

## Performance

| Operation | Expected Latency |
|-----------|-----------------|
| Hover translate | 50-150ms |
| Selection translate | 100-300ms |
| Full page (1000 words) | 2-5 seconds |

## Supported Languages

English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese (Simplified/Traditional), Arabic, Hindi, Dutch, Polish, Turkish, Vietnamese, Thai, Indonesian, Ukrainian, Czech, Greek, Hebrew, Swedish, Danish, Finnish, Norwegian, and more.

## Troubleshooting

### "Chrome AI not available" error
1. Make sure Chrome 138+ is installed
2. Enable `chrome://flags/#optimization-guide-on-device-model`
3. Relaunch browser
4. Check `chrome://components` → "Optimization Guide On Device Model" should show a version

### Translations are slow
- First translation per language pair downloads a small model (~100MB)
- Subsequent translations are instant
- Check internet connection for initial model download

### Extension not working on certain pages
- Chrome internal pages (chrome://) are restricted
- Some sites may block content scripts

## Files

```
quick-translate/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (context menu)
├── lib/
│   ├── translator.js      # Chrome AI Translator wrapper
│   └── language-detector.js
├── content/
│   └── content.js         # Main content script
├── popup/
│   ├── popup.html         # Extension popup
│   ├── popup.js
│   └── options.html       # Settings page
├── styles/
│   └── overlay.css        # Translation overlay styles
└── icons/
    └── icon*.png          # Extension icons
```

## License

MIT
