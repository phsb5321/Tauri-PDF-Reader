# Quickstart: Tauri PDF Reader

**Feature**: 044-tauri-pdf-reader | **Date**: 2026-01-11 | **Phase**: 1

## Overview

This guide covers setting up the development environment for the Tauri PDF Reader application.

---

## Prerequisites

### All Platforms

- **Node.js**: 18+ (LTS recommended)
- **pnpm**: 8+ (`npm install -g pnpm`)
- **Rust**: 1.75+ (via rustup)

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Verify
rustc --version
cargo --version
```

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

# E2E testing
sudo apt install -y webkit2gtk-driver
```

### macOS

```bash
# Xcode Command Line Tools (if not installed)
xcode-select --install

# TTS: Built-in (AVFoundation), no extra install needed
```

### Windows

1. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Select "Desktop development with C++"
2. Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 10+)
3. TTS: Built-in (WinRT/SAPI), no extra install needed

---

## Project Setup

### 1. Create Tauri Project

```bash
# Create new project with React + TypeScript
pnpm create tauri-app tauri-pdf-reader --template react-ts

cd tauri-pdf-reader

# Install dependencies
pnpm install
```

### 2. Install Additional Dependencies

```bash
# Frontend: PDF.js
pnpm add pdfjs-dist

# Frontend: State management (optional, can use React context)
pnpm add zustand

# Frontend: Validation
pnpm add zod

# Development
pnpm add -D @types/node vitest @testing-library/react
```

### 3. Configure Rust Dependencies

Edit `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tts = "0.26"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
```

### 4. Configure Tauri Plugins

Edit `src-tauri/src/main.rs`:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 5. Configure Capabilities

Create `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for PDF Reader",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read",
    "dialog:default",
    "dialog:allow-open",
    "sql:default"
  ]
}
```

### 6. Configure PDF.js Worker

Create `src/lib/pdf.ts`:

```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export { pdfjsLib };
```

---

## Development Workflow

### Run Development Server

```bash
# Start Tauri dev (hot reload for frontend and Rust)
pnpm tauri dev
```

### Build Production

```bash
# Build optimized app
pnpm tauri build
```

### Run Tests

```bash
# Frontend unit tests
pnpm test

# Rust tests
cd src-tauri && cargo test

# E2E tests (after building)
pnpm test:e2e
```

---

## Project Structure (After Setup)

```
tauri-pdf-reader/
├── src/                      # Frontend (React + TypeScript)
│   ├── components/
│   ├── services/
│   ├── stores/
│   ├── lib/
│   │   └── pdf.ts            # PDF.js config
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   └── commands/
│   │       ├── mod.rs
│   │       ├── tts.rs
│   │       ├── library.rs
│   │       └── highlights.rs
│   ├── capabilities/
│   │   └── default.json
│   ├── Cargo.toml
│   └── tauri.conf.json
├── tests/
│   ├── unit/
│   ├── e2e/
│   └── fixtures/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Common Issues

### Linux: WebKit Not Found

```
Error: webkit2gtk-4.1 was not found
```

**Fix**: Install WebKit development package:
```bash
sudo apt install libwebkit2gtk-4.1-dev
```

### Linux: TTS Not Working

```
Error: SpeechDispatcher is not running
```

**Fix**: Start or install Speech Dispatcher:
```bash
sudo apt install speech-dispatcher
speech-dispatcher --spawn

# Test
spd-say "Hello world"
```

### Windows: Build Tools Missing

```
Error: failed to run custom build command for `ring`
```

**Fix**: Install Visual Studio Build Tools with C++ workload.

### PDF.js Worker Error

```
Error: Setting up fake worker failed
```

**Fix**: Ensure worker is configured correctly. Check Vite config for worker handling:

```typescript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
});
```

### Asset Protocol CSP Error

```
Refused to load the image 'asset://...' because it violates Content Security Policy
```

**Fix**: Add `asset:` to CSP in `tauri.conf.json`:

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; img-src 'self' asset: blob: data:; ..."
    }
  }
}
```

---

## Verification Checklist

After setup, verify:

- [ ] `pnpm tauri dev` launches the app window
- [ ] Rust commands can be invoked from frontend (`invoke()`)
- [ ] File dialog opens and returns path
- [ ] PDF.js can load a local PDF via asset protocol
- [ ] TTS speaks text (test with `tts_speak` command)
- [ ] SQLite database is created in app data directory

---

## Next Steps

1. Complete **Spike A** (PDF Opening) to validate PDF.js + Tauri integration
2. Complete **Spike C** (TTS) to validate cross-platform speech
3. Implement core components following the contracts in `contracts/`
4. Add E2E tests using tauri-driver

See `research.md` for implementation details and `data-model.md` for database schema.
