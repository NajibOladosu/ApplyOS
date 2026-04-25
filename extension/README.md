# ApplyOS Browser Extension

Production-ready browser extension for ApplyOS - Streamline your job applications with AI-powered extraction and management.

## Features

- 🚀 **Quick Add**: One-click add applications from job posting pages
- 🎯 **Smart Detection**: Automatically detects job pages on 6 major platforms
- 🤖 **AI-Powered Extraction**: Extracts job details using platform-specific and AI extractors
- 📝 **Suggested Fill**: Fill application forms with your data (with confirmation)
- 💡 **Question Assistant**: Get AI-generated answers for application questions
- 📊 **Analytics Dashboard**: View your application stats in the popup
- 📱 **Cross-Browser**: Works on Chrome, Edge, and Firefox

## Supported Platforms

- LinkedIn
- Indeed
- Workday
- Greenhouse
- Lever
- Glassdoor

## Development Setup

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
cd extension
npm install
```

### Build Commands

```bash
# Development build with watch mode
npm run dev

# Production build for all browsers
npm run build

# Build for specific browser
npm run build:chrome
npm run build:firefox
npm run build:edge
```

### Loading the Extension

### 2. Build the Extension

Run the build command for your target browser:

```bash
# For Chrome (default)
npm run build

# For Firefox
npm run build:firefox

# For Edge
npm run build:edge
```

This will create a `dist/` directory containing the compiled extension.

### 3. Load in Browser

#### Chrome / Edge
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the **`extension/dist/chrome`** directory (NOT the `extension` root folder!)

#### Firefox

4. Select any file in the `dist/firefox` directory

## Project Structure

```
extension/
├── src/
│   ├── background/         # Background service worker
│   ├── content/            # Content scripts (injected into pages)
│   ├── popup/              # Extension popup UI
│   ├── options/            # Settings page
│   ├── extractors/         # Platform-specific data extractors
│   ├── lib/                # Shared libraries
│   │   ├── auth/           # Authentication
│   │   ├── api/            # API clients
│   │   └── utils/          # Utilities
│   └── styles/             # Global styles
├── public/                 # Static assets
├── dist/                   # Build output (generated)
├── manifest.json           # Extension manifest
├── webpack.config.js       # Build configuration
└── package.json
```

## Development Workflow

1. Make changes to source files in `src/`
2. The extension will auto-rebuild (if running `npm run dev`)
3. Reload the extension in your browser to see changes
4. Test on actual job posting pages

## Testing

- Test on all 6 supported platforms
- Verify Quick Add works correctly
- Check authentication flow
- Test data extraction accuracy
- Cross-browser testing

## Deployment

See the [Implementation Plan](../../../.gemini/antigravity/brain/6995affd-b048-412d-813e-044ed3c8e329/implementation_plan_refined.md) for detailed publishing instructions.

## License

MIT
