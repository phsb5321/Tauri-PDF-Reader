# Research: Tauri PDF Reader

**Feature**: 044-tauri-pdf-reader | **Date**: 2026-01-11 | **Phase**: 0

## Overview

This document captures research findings and best practices for building a Tauri 2.x desktop PDF reader with highlights and native TTS. All decisions were validated against official documentation and community resources.

---

## 1. Tauri 2.x Project Setup

### Creating the Project

```bash
# Using create-tauri-app (recommended)
pnpm create tauri-app tauri-pdf-reader --template react-ts

# Or with npm
npm create tauri-app@latest tauri-pdf-reader -- --template react-ts
```

### Key Configuration Files

**`src-tauri/tauri.conf.json`** - Core configuration:
```json
{
  "productName": "Tauri PDF Reader",
  "version": "0.1.0",
  "identifier": "com.voxpage.pdf-reader",
  "build": {
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{
      "title": "PDF Reader",
      "width": 1200,
      "height": 800,
      "resizable": true
    }],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: blob: data:; connect-src 'self' asset:"
    }
  }
}
```

### Capabilities (Tauri 2.x Permissions)

**`src-tauri/capabilities/default.json`**:
```json
{
  "identifier": "default",
  "description": "Default capabilities for PDF Reader",
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

---

## 2. PDF.js Integration

### Installation

```bash
pnpm add pdfjs-dist
```

### Worker Setup

PDF.js requires a web worker for PDF parsing. In Vite:

```typescript
// src/lib/pdf-worker.ts
import * as pdfjsLib from 'pdfjs-dist';

// For Vite, use URL import
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export { pdfjsLib };
```

### Loading PDFs from Tauri Asset Protocol

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';

async function loadPdf(filePath: string) {
  // Convert file system path to asset:// URL
  const assetUrl = convertFileSrc(filePath);
  
  const loadingTask = pdfjsLib.getDocument({
    url: assetUrl,
    // Disable range requests for local files
    disableRange: true,
    disableStream: true,
  });
  
  return await loadingTask.promise;
}
```

### Text Layer for Selection

```typescript
import { TextLayer } from 'pdfjs-dist';

async function renderPage(page: PDFPageProxy, container: HTMLElement) {
  const scale = 1.5;
  const viewport = page.getViewport({ scale });
  
  // Canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  container.appendChild(canvas);
  
  await page.render({
    canvasContext: canvas.getContext('2d')!,
    viewport,
  }).promise;
  
  // Text layer for selection
  const textContent = await page.getTextContent();
  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'textLayer';
  container.appendChild(textLayerDiv);
  
  const textLayer = new TextLayer({
    textContentSource: textContent,
    container: textLayerDiv,
    viewport,
  });
  
  await textLayer.render();
}
```

### CSP Considerations

PDF.js requires these CSP adjustments:
- `blob:` for internal blob URLs
- `asset:` for Tauri file loading
- `'unsafe-inline'` for text layer styles (or use CSS custom properties)

---

## 3. Text Selection and Highlight Extraction

### Getting Selection Coordinates

```typescript
interface HighlightRect {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function getSelectionRects(pageNumber: number): HighlightRect[] {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return [];
  
  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();
  const textLayer = document.querySelector(`[data-page="${pageNumber}"] .textLayer`);
  
  if (!textLayer) return [];
  
  const layerRect = textLayer.getBoundingClientRect();
  
  return Array.from(rects).map(rect => ({
    page: pageNumber,
    x: rect.left - layerRect.left,
    y: rect.top - layerRect.top,
    width: rect.width,
    height: rect.height,
  }));
}

function getSelectionText(): string {
  return window.getSelection()?.toString() || '';
}
```

### Rendering Highlight Overlays

```typescript
function renderHighlights(highlights: Highlight[], container: HTMLElement) {
  const overlay = document.createElement('div');
  overlay.className = 'highlight-overlay';
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  
  for (const highlight of highlights) {
    for (const rect of highlight.rects) {
      const el = document.createElement('div');
      el.className = 'highlight';
      el.style.position = 'absolute';
      el.style.left = `${rect.x}px`;
      el.style.top = `${rect.y}px`;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
      el.style.backgroundColor = highlight.color;
      el.style.opacity = '0.3';
      el.style.mixBlendMode = 'multiply';
      el.dataset.highlightId = highlight.id;
      overlay.appendChild(el);
    }
  }
  
  container.appendChild(overlay);
}
```

---

## 4. Native TTS with Rust `tts` Crate

### Cargo.toml Dependencies

```toml
[dependencies]
tts = "0.26"
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### Platform-Specific Notes

| Platform | Backend | Notes |
|----------|---------|-------|
| Windows | WinRT (default), SAPI | WinRT preferred, requires Windows 10+ |
| macOS | AVFoundation | Works on macOS 10.14+ |
| Linux | Speech Dispatcher | Requires `speech-dispatcher` package |

**Linux Installation**:
```bash
# Ubuntu/Debian
sudo apt install speech-dispatcher libspeechd-dev

# Fedora
sudo dnf install speech-dispatcher speech-dispatcher-devel
```

### TTS Command Implementation

```rust
use tts::Tts;
use std::sync::Mutex;
use tauri::State;

pub struct TtsState(pub Mutex<Option<Tts>>);

#[tauri::command]
pub fn tts_init(state: State<TtsState>) -> Result<(), String> {
    let mut tts = state.0.lock().map_err(|e| e.to_string())?;
    *tts = Some(Tts::default().map_err(|e| e.to_string())?);
    Ok(())
}

#[tauri::command]
pub fn tts_speak(state: State<TtsState>, text: String) -> Result<(), String> {
    let mut tts = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut engine) = *tts {
        engine.speak(text, false).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn tts_stop(state: State<TtsState>) -> Result<(), String> {
    let mut tts = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut engine) = *tts {
        engine.stop().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn tts_set_rate(state: State<TtsState>, rate: f32) -> Result<(), String> {
    let mut tts = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut engine) = *tts {
        engine.set_rate(rate).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(serde::Serialize)]
pub struct VoiceInfo {
    id: String,
    name: String,
}

#[tauri::command]
pub fn tts_list_voices(state: State<TtsState>) -> Result<Vec<VoiceInfo>, String> {
    let tts = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(ref engine) = *tts {
        let voices = engine.voices().map_err(|e| e.to_string())?;
        Ok(voices.into_iter().map(|v| VoiceInfo {
            id: v.id().to_string(),
            name: v.name().to_string(),
        }).collect())
    } else {
        Ok(vec![])
    }
}
```

### Registering TTS Commands

```rust
// main.rs
mod commands;

fn main() {
    tauri::Builder::default()
        .manage(commands::tts::TtsState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            commands::tts::tts_init,
            commands::tts::tts_speak,
            commands::tts::tts_stop,
            commands::tts::tts_set_rate,
            commands::tts::tts_list_voices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 5. SQLite Persistence

### Setup with tauri-plugin-sql

**Cargo.toml**:
```toml
[dependencies]
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

**main.rs**:
```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        // ... rest of builder
}
```

**Frontend usage**:
```typescript
import Database from '@tauri-apps/plugin-sql';

const db = await Database.load('sqlite:pdf-reader.db');

// Run migrations
await db.execute(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,
    title TEXT,
    page_count INTEGER,
    current_page INTEGER DEFAULT 1,
    last_opened_at TEXT,
    file_hash TEXT
  )
`);

await db.execute(`
  CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    rects TEXT NOT NULL,  -- JSON array of {x, y, width, height}
    color TEXT NOT NULL,
    text_content TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  )
`);
```

---

## 6. E2E Testing with tauri-driver

### Installation

```bash
# Install tauri-driver
cargo install tauri-driver

# Linux: Install WebKitWebDriver
sudo apt install webkit2gtk-driver

# Windows: Download and install Microsoft Edge WebDriver
# macOS: Limited support (Safari Technology Preview)
```

### Test Configuration

**`tests/e2e/tauri.test.ts`** (using WebDriverIO):
```typescript
import { remote } from 'webdriverio';

describe('PDF Reader', () => {
  let driver: WebdriverIO.Browser;

  beforeAll(async () => {
    driver = await remote({
      hostname: '127.0.0.1',
      port: 4444,
      capabilities: {
        'tauri:options': {
          application: '../src-tauri/target/release/tauri-pdf-reader',
        },
      },
    });
  });

  afterAll(async () => {
    await driver.deleteSession();
  });

  it('should open a PDF', async () => {
    // Test implementation
  });
});
```

### CI Configuration (Linux)

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y webkit2gtk-4.1-dev speech-dispatcher
          
      - name: Install tauri-driver
        run: cargo install tauri-driver
        
      - name: Build app
        run: pnpm tauri build
        
      - name: Run E2E tests
        run: |
          tauri-driver &
          sleep 2
          pnpm test:e2e
```

---

## 7. Risk Mitigations

### Risk: PDF.js bundle size
**Mitigation**: Use tree-shaking with Vite. PDF.js core is ~300KB gzipped. Acceptable for desktop app.

### Risk: Linux TTS availability
**Mitigation**: Detect Speech Dispatcher at startup, show installation instructions if missing.

```rust
#[tauri::command]
pub fn tts_check_available() -> Result<bool, String> {
    match Tts::default() {
        Ok(_) => Ok(true),
        Err(e) => {
            eprintln!("TTS not available: {}", e);
            Ok(false)
        }
    }
}
```

### Risk: Large PDF performance
**Mitigation**: Render pages on-demand (virtualized scrolling), cache rendered pages.

### Risk: Asset protocol path encoding
**Mitigation**: Use `convertFileSrc()` consistently, test with paths containing spaces and Unicode.

---

## 8. Spike Validation Checklist

From spec.md, the following spikes should be completed before full implementation:

- [ ] **Spike A**: PDF Opening (2 hours) - Open local PDF, render with text layer
- [ ] **Spike B**: Text Selection (2 hours) - Select, highlight, persist to SQLite
- [ ] **Spike C**: Native TTS (2 hours) - Speak text on all platforms
- [ ] **Spike D**: E2E Test (2 hours) - tauri-driver test passing in CI

---

## References

- [Tauri 2.x Docs](https://tauri.app/)
- [PDF.js Getting Started](https://mozilla.github.io/pdf.js/getting_started/)
- [Rust TTS Crate](https://docs.rs/tts/latest/tts/)
- [tauri-plugin-sql](https://tauri.app/plugin/sql/)
- [Tauri WebDriver Testing](https://tauri.app/develop/tests/webdriver/)
