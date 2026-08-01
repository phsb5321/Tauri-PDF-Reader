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

---

## Codebase Audit (2026-02-01)

**Purpose**: Architecture & Professionalization Audit for US2 (Persistent Highlights) readiness  
**Scope**: Full-stack analysis of Tauri PDF Reader codebase  
**Conducted by**: OpenCode swarm (7 parallel auditors)

---

### Executive Summary

The Tauri PDF Reader codebase demonstrates a **mature hexagonal architecture** with well-defined ports and adapters. The highlight infrastructure for US2 is **architecturally ready** with full type-safe IPC contracts via tauri-specta. However, several issues require attention before US2 implementation:

| Category | Status | Key Finding |
|----------|--------|-------------|
| **Architecture** | 🟢 Strong | 95% hexagonal compliance, 2 boundary violations |
| **Security** | 🟡 Needs Work | Overly permissive FS scope (`**/*`), `unsafe-eval` in CSP |
| **Data Layer** | 🟡 Needs Work | PRAGMA config not applied, missing transactions |
| **IPC Contracts** | 🟢 Strong | Highlight commands fully type-safe via tauri-specta |
| **Testing** | 🟡 Partial | 80% coverage enforced, but E2E tests non-functional |
| **UX/A11y** | 🟡 Partial | Good foundation, missing keyboard shortcuts & focus traps |

**US2 Readiness**: HIGH - The architecture supports persistent highlights; fix P0 blockers first.

---

### 1. Codebase Architecture Findings

#### Module Structure

**Frontend (`src/`)**:
```
src/
├── adapters/tauri/          # Type-safe IPC adapters ✓
├── domain/                  # Pure business logic ✓
│   ├── highlight/           # US2-ready: merge.ts with tests
│   └── errors.ts            # AppError types
├── ports/                   # Interface definitions ✓
│   └── highlight-repository.port.ts  # US2-ready
├── components/              # UI layer
│   └── pdf-viewer/          # HighlightOverlay, HighlightToolbar
├── stores/                  # Zustand (8 stores)
├── hooks/                   # 19 hooks
└── lib/
    ├── bindings.ts          # Generated tauri-specta
    └── api/                 # Legacy invoke wrappers (tech debt)
```

**Backend (`src-tauri/src/`)**:
```
src-tauri/src/
├── commands/highlights/     # CRUD commands (type-safe)
├── domain/highlight/        # Entities with tests
├── ports/                   # Repository traits (mockall)
├── adapters/sqlite/         # 3 of 5 adapters implemented
└── application/             # Services with comprehensive tests
```

#### Hotspots (Complexity Concerns)

| File | Lines | Issue | Severity |
|------|-------|-------|----------|
| `src/components/PdfViewer.tsx` | 620 | Too many responsibilities | HIGH |
| `src/hooks/useTtsWordHighlight.ts` | 334 | Complex coordinate logic | MEDIUM |
| `src/stores/session-store.ts` | 300 | Async complexity | MEDIUM |

**Recommendation**: Split `PdfViewer.tsx` before US2 to reduce complexity in highlight integration.

#### Boundary Violations (MUST FIX)

| File | Line | Violation |
|------|------|-----------|
| `src/hooks/useHwAccelStatus.ts` | 9, 45, 61 | Direct `invoke()` in hooks layer |
| `src/components/settings/DebugLogs.tsx` | 54 | Direct `invoke()` in components |

**Fix**: Create `TauriHwAccelAdapter` implementing `HwAccelPort` interface.

---

### 2. Security Assessment

#### Critical Issues (P0)

| Issue | Risk | Fix |
|-------|------|-----|
| **FS scope `**/*`** | Full filesystem read access | Restrict to `$DOCUMENT/**/*.pdf`, `$HOME/**/*.pdf` |
| **Asset protocol `**/*`** | Can load any file including secrets | Mirror FS scope restrictions |
| **No deny rules** | Sensitive paths exposed | Add denies for `.ssh`, `.gnupg`, `/etc` |

#### High Priority (P1)

| Issue | Risk | Fix |
|-------|------|-----|
| **`unsafe-eval` in CSP** | XSS escalation | Replace with `'wasm-unsafe-eval'` |
| **External CDN in CSP** | Supply chain risk | Remove `cdn.jsdelivr.net` or self-host |
| **Unused `shell:allow-open`** | Process launch risk | Remove if not needed |

#### Recommended Secure Configuration

```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$DOCUMENT/**/*.pdf" },
        { "path": "$HOME/**/*.pdf" },
        { "path": "$DOWNLOAD/**/*.pdf" }
      ],
      "deny": [
        { "path": "$HOME/.ssh/**" },
        { "path": "$HOME/.gnupg/**" },
        { "path": "/etc/**" }
      ]
    }
  ]
}
```

**Source**: [Tauri Security Scopes](https://tauri.app/security/scope/)

---

### 3. PDF.js + Highlights Analysis

#### Current Implementation (US2-Ready)

| Component | Status | Notes |
|-----------|--------|-------|
| Text Layer | ✅ | Proper PDF.js TextLayer with viewport scaling |
| Selection Extraction | ⚠️ | Works but duplicates coordinate logic |
| Coordinate Transforms | ✅ | `src/lib/coordinate-transform.ts` exists |
| Highlight Rendering | ✅ | DOM-based with CSS `mix-blend-mode: multiply` |
| Persistence Port | ✅ | `HighlightRepositoryPort` fully defined |

#### Coordinate Storage Strategy

Highlights are correctly stored in **PDF coordinates (scale=1.0)**:

```
User Selection (screen pixels)
        ↓ ÷ scale
PDF Coordinates → STORED IN DB
        ↓ × scale (at render)
Display Coordinates
```

**Why this matters**: Highlights survive zoom changes without recalculation.

#### Recommendations for US2

1. **Consolidate `Rect` type** - Currently defined in 3+ places
2. **Use `coordinate-transform.ts`** consistently in selection extraction
3. **Add selection preview** - Show temporary highlight during selection

**Source**: [PDF.js Getting Started](https://mozilla.github.io/pdf.js/getting_started/)

---

### 4. SQLite/Data Layer Analysis

#### Critical Issues (P0)

| Issue | Impact | Fix |
|-------|--------|-----|
| **PRAGMA config not applied** | FK cascades broken, no WAL mode | Apply at connection time |
| **No transaction in `highlights_batch_create`** | Partial data on failure | Wrap in `BEGIN`/`COMMIT` |

```rust
// Current: NO TRANSACTION (dangerous)
pub async fn highlights_batch_create(...) {
    for input in highlights {
        sqlx::query("INSERT...").execute(&pool).await?; // Partial failure risk
    }
}

// Fixed: With transaction
let mut tx = pool.begin().await?;
for input in highlights {
    sqlx::query("INSERT...").execute(&mut *tx).await?;
}
tx.commit().await?;
```

#### Repository Architecture Gap

| Repository | Port | Adapter | Status |
|------------|------|---------|--------|
| DocumentRepository | ✅ | ❌ | Commands use direct SQL |
| HighlightRepository | ✅ | ❌ | Commands use direct SQL |
| SettingsRepository | ✅ | ✅ | `SqliteSettingsRepo` |
| SessionRepository | ✅ | ✅ | `SqliteSessionRepo` |

**Recommendation**: Create `SqliteHighlightRepo` adapter for hexagonal compliance.

#### Schema Assessment

The `highlights` table is well-designed:
```sql
CREATE TABLE highlights (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    rects TEXT NOT NULL,           -- JSON array
    color TEXT NOT NULL,
    text_content TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
CREATE INDEX idx_highlights_document_page ON highlights(document_id, page_number);
```

**Source**: [tauri-plugin-sql](https://v2.tauri.app/plugin/sql/)

---

### 5. IPC Contracts Assessment

#### Type Safety Status

**Highlight commands are fully type-safe** via tauri-specta:

| Command | TypeScript Binding | Status |
|---------|-------------------|--------|
| `highlights_create` | `highlightsCreate()` | ✅ Type-safe |
| `highlights_batch_create` | `highlightsBatchCreate()` | ✅ Type-safe |
| `highlights_list_for_page` | `highlightsListForPage()` | ✅ Type-safe |
| `highlights_update` | `highlightsUpdate()` | ✅ Type-safe |
| `highlights_delete` | `highlightsDelete()` | ✅ Type-safe |
| `highlights_export` | `highlightsExport()` | ✅ Type-safe |

**Generated bindings**: `src/lib/bindings.ts` (auto-generated during `tauri dev`)

#### Legacy Technical Debt

| Area | Issue | Priority |
|------|-------|----------|
| `src/lib/api/*.ts` | 73 direct `invoke()` calls | P2 |
| `src/services/library-service.ts` | Legacy service, 32 `invoke()` calls | P1 |
| TTS/AI-TTS commands | Not registered with specta | P2 |

#### Error Convention

Commands use structured error codes:
```rust
"EMPTY_RECTS: Rects array cannot be empty"
"DOCUMENT_NOT_FOUND: Document does not exist"
"DATABASE_ERROR: {details}"
```

**Recommendation**: Parse error codes in frontend to map to `AppError` types.

**Source**: [tauri-specta](https://github.com/specta-rs/tauri-specta)

---

### 6. Testing & Quality Gates

#### Current Coverage

| Layer | Tests | Threshold | Status |
|-------|-------|-----------|--------|
| Frontend (Vitest) | ~210 | 80% | ✅ Enforced |
| Backend (Cargo) | ~146 | None | ⚠️ No threshold |
| E2E | 0 (all skipped) | None | ❌ Not functional |

#### CI Pipeline (`.github/workflows/ci.yml`)

| Check | Command | Status |
|-------|---------|--------|
| TypeScript | `pnpm typecheck` | ✅ |
| ESLint + Boundaries | `pnpm lint` | ✅ |
| Frontend Tests | `pnpm test:run` | ✅ |
| Coverage Gate | `pnpm test:coverage` | ✅ 80% |
| Rust Clippy | `cargo clippy -- -D warnings` | ✅ |
| Rust Tests | `cargo test --features test-mocks` | ✅ |

#### Testing Gaps for US2

| Missing | Priority | Effort |
|---------|----------|--------|
| `HighlightLayer.test.tsx` | HIGH | Medium |
| `useTextSelection.test.ts` | HIGH | Medium |
| Highlight CRUD integration test | HIGH | Medium |
| E2E: Create/delete highlight | HIGH | High |

**Source**: [Tauri WebDriver Testing](https://v2.tauri.app/develop/tests/webdriver/)

---

### 7. UX/Accessibility Findings

#### Highlight UX (Good Foundation)

| Component | Status |
|-----------|--------|
| `HighlightToolbar` | ✅ Complete with color swatches |
| `HighlightOverlay` | ✅ DOM-based, CSS blend mode |
| `HighlightContextMenu` | ✅ Delete, change color, add note |
| `HighlightsPanel` | ✅ Grouped by page, export |

#### Accessibility Gaps

| Issue | WCAG | Fix |
|-------|------|-----|
| Missing focus trap in modals | 2.1.2 | Add focus trap to `NoteEditor` |
| Toolbar not roving tabindex | 2.1.1 | Arrow key navigation between colors |
| `--shadow-focus` token missing | 2.4.7 | Define in `tokens/shadows.css` |
| No `aria-live` for announcements | 4.1.3 | Add live region for highlight CRUD |

#### Missing Keyboard Shortcuts

| Shortcut | Action | Priority |
|----------|--------|----------|
| `Ctrl+H` | Highlight with default color | HIGH |
| `Ctrl+O` | Open file | HIGH |
| `Ctrl+Z` | Undo | MEDIUM |

**Source**: [WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)

---

### Decision Log (Tradeoffs)

| Decision | Chosen | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Highlight storage | PDF coordinates (scale=1.0) | Screen coordinates | Zoom-invariant, industry standard |
| Highlight rendering | DOM-based | Canvas overlay | Preserves text selection, easier click handling |
| Type generation | tauri-specta | Manual types | End-to-end type safety, auto-sync |
| State management | Zustand | Redux/Jotai | Simple, performant, already in use |
| Text selection | `getClientRects()` | PDF.js quads | Simpler, sufficient for rects |

---

### Prioritized Fix List (US2 Mapping)

#### P0 - Critical (Must fix before US2)

| ID | Issue | Impact on US2 | Effort | Task |
|----|-------|---------------|--------|------|
| P0-1 | Apply PRAGMA config (WAL, FK) | Cascade deletes may fail | Low | Before T038 |
| P0-2 | Add transaction to batch_create | Partial highlight save | Low | Before T038 |
| P0-3 | Fix `useHwAccelStatus` boundary violation | Lint failure | Low | Standalone |
| P0-4 | Restrict FS scope to PDFs | Security risk | Low | Standalone |

#### P1 - High (Should fix for US2)

| ID | Issue | Impact | Effort | Task |
|----|-------|--------|--------|------|
| P1-1 | Add toast on highlight CRUD | No feedback to user | Low | T052 |
| P1-2 | Add `Ctrl+H` shortcut | Slow workflow | Low | T051 |
| P1-3 | Add focus trap to NoteEditor | A11y violation | Medium | T049 |
| P1-4 | Create `HighlightLayer.test.tsx` | Coverage gap | Medium | T050 |
| P1-5 | Remove `unsafe-eval` from CSP | Security | Medium | Standalone |

#### P2 - Medium (Nice to have)

| ID | Issue | Impact | Effort |
|----|-------|--------|--------|
| P2-1 | Split `PdfViewer.tsx` | Maintainability | High |
| P2-2 | Consolidate `Rect` type definitions | Developer experience | Low |
| P2-3 | Create `SqliteHighlightRepo` adapter | Architecture purity | Medium |
| P2-4 | Add E2E test infrastructure | Regression safety | High |
| P2-5 | Define `--shadow-focus` token | A11y completeness | Low |

---

### Source Links

#### Official Documentation
- [Tauri Security](https://tauri.app/security/) - Capabilities, CSP, scopes
- [Tauri Permissions](https://tauri.app/security/permissions/) - Permission system
- [tauri-plugin-sql](https://v2.tauri.app/plugin/sql/) - SQLite integration
- [tauri-specta](https://github.com/specta-rs/tauri-specta) - Type-safe IPC
- [Tauri WebDriver](https://v2.tauri.app/develop/tests/webdriver/) - E2E testing

#### PDF.js
- [Getting Started](https://mozilla.github.io/pdf.js/getting_started/)
- [Examples](https://mozilla.github.io/pdf.js/examples/)

#### Accessibility
- [WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [WAI-ARIA Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)

#### SQLite Best Practices
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)
- [sqlx documentation](https://docs.rs/sqlx/latest/sqlx/)

---

### Actionable Next Steps for `/speckit.plan` and `/speckit.tasks`

#### Updates to `plan.md`

1. **Add Security Hardening Phase** (before US2):
   - Restrict FS/asset protocol scopes
   - Remove `unsafe-eval` from CSP
   - Remove unused `shell:allow-open`

2. **Add Data Layer Fixes Phase** (before US2):
   - Apply PRAGMA configuration at startup
   - Wrap batch operations in transactions
   - Create `SqliteHighlightRepo` adapter (optional)

3. **Update Testing Strategy**:
   - Add highlight component tests as prerequisite for T047-T054
   - Document E2E infrastructure gap (defer to post-US2)

#### Updates to `tasks.md`

**Add new tasks before Phase 4 (US2 Highlights)**:

```
## Phase 3.5: US2 Prerequisites (Architecture Fixes)

- [ ] T037.1 [P0] Apply PRAGMA config (WAL, FK) in src-tauri/src/db/mod.rs or tauri-plugin-sql config
- [ ] T037.2 [P0] Wrap highlights_batch_create in transaction in src-tauri/src/commands/highlights/mod.rs
- [ ] T037.3 [P0] Fix boundary violation: Create src/adapters/tauri/hw-accel.adapter.ts
- [ ] T037.4 [P0] Restrict FS scope in src-tauri/capabilities/default.json to PDF directories only
- [ ] T037.5 [P1] Remove unsafe-eval from CSP in src-tauri/tauri.conf.json

**Checkpoint**: `pnpm verify` passes, security scan clean
```

**Modify existing US2 tasks**:

```
- [ ] T051 [US2] Add text selection handling + Ctrl+H shortcut in PdfViewer.tsx
- [ ] T052 [US2] Implement highlight creation flow with toast feedback
```

**Add test tasks**:

```
- [ ] T054.1 [US2] Create src/__tests__/ui/HighlightLayer.test.tsx
- [ ] T054.2 [US2] Create src/__tests__/hooks/useTextSelection.test.ts
- [ ] T054.3 [US2] Add a11y: focus trap in NoteEditor, roving tabindex in HighlightToolbar
```

#### Recommended Task Order for US2

1. **P0 Fixes** (T037.1-T037.5) - ~4 hours
2. **Backend Highlights** (T038-T044) - Already in tasks.md
3. **Frontend Services** (T045-T046) - Already in tasks.md
4. **Component Tests** (T054.1-T054.2) - New
5. **UI Components** (T047-T050) - Already in tasks.md
6. **Integration + A11y** (T051-T053, T054.3) - Enhanced with shortcuts/toasts/a11y
