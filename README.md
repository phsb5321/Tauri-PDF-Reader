# Lectrice

> Every page, read aloud.

**Lectrice** is a local-first desktop PDF reader that reads documents aloud — highlight a passage, press play, and let it turn the page for you. Built with Tauri 2.x (React/TypeScript + Rust), with text highlighting and native text-to-speech.

The name is French for _a person employed to read aloud to someone_ — the app is your lectrice. See [`docs/brand/`](docs/brand/) for the full brand system.

## Features

- Open and view local PDF files
- Navigate pages with keyboard shortcuts
- Zoom controls (fit width, fit page, percentage)
- Text selection and highlighting
- Persistent highlights stored locally
- Native text-to-speech for highlighted text
- Read entire pages aloud
- Document library with reading progress

## Prerequisites

### All Platforms

- **Node.js**: 18+ (LTS recommended)
- **pnpm**: 8+
- **Rust**: 1.75+

### Linux (Ubuntu/Debian)

```bash
# System dependencies for Tauri
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# TTS (Speech Dispatcher)
sudo apt install -y speech-dispatcher libspeechd-dev
```

### macOS

```bash
# Xcode Command Line Tools
xcode-select --install
```

### Windows

1. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++"
2. WebView2 is typically pre-installed on Windows 10+

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm tauri dev

# Build production
pnpm tauri build
```

## Project Structure

```
tauri-pdf-reader/
├── src/                      # Frontend (React + TypeScript)
│   ├── components/           # React components
│   ├── services/             # API services
│   ├── stores/               # Zustand stores
│   ├── lib/                  # Utilities
│   └── styles/               # CSS
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── commands/         # Tauri commands
│   │   ├── db/               # Database models
│   │   └── tts/              # TTS engine
│   └── capabilities/         # Permission capabilities
└── tests/                    # Test files
```

## License

Private - All rights reserved.
