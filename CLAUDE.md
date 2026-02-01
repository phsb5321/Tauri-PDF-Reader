# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tauri 2.x desktop PDF reader with text highlighting and native text-to-speech. Uses React/TypeScript frontend with Rust backend.

## Common Commands

```bash
# Install dependencies
pnpm install

# Development (starts both Vite dev server and Tauri)
pnpm tauri dev

# Build production
pnpm tauri build

# Type check frontend
pnpm typecheck

# Lint (includes architecture boundaries check)
pnpm lint
pnpm lint:boundaries    # Hexagonal architecture boundaries only

# Run full verification (all CI checks)
pnpm verify
```

### Testing

```bash
# Frontend tests
pnpm test:run                    # Run all frontend tests (201+)
pnpm test                        # Watch mode
pnpm test:arch                   # Architecture boundary tests only
pnpm test -- src/path/to/file.test.ts  # Run specific test file

# Backend tests
cd src-tauri && cargo test --features test-mocks   # All backend tests (177+)
cd src-tauri && cargo test test_name              # Run specific test

# Coverage (80% threshold required)
pnpm test:coverage
cd src-tauri && cargo llvm-cov --features test-mocks
```

### Rust-specific Commands

```bash
cd src-tauri && cargo check
cd src-tauri && cargo clippy -- -D warnings
cd src-tauri && cargo fmt --check
cd src-tauri && cargo build --features native-tts  # With native TTS
```

## Architecture

This codebase follows **Hexagonal Architecture** (Ports & Adapters pattern) enforced via ESLint boundaries plugin.

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
│  React components, hooks (src/components/, src/hooks/)      │
├─────────────────────────────────────────────────────────────┤
│                   Application Layer                         │
│  Use cases, orchestration (src/application/, src-tauri/     │
│  src/application/)                                          │
├─────────────────────────────────────────────────────────────┤
│                     Domain Layer                            │
│  Business logic, entities (src/domain/, src-tauri/src/      │
│  domain/)                                                   │
├─────────────────────────────────────────────────────────────┤
│                    Ports (Interfaces)                       │
│  Repository interfaces (src/ports/, src-tauri/src/ports/)   │
├─────────────────────────────────────────────────────────────┤
│                   Adapters (Infrastructure)                 │
│  Tauri IPC, SQLite repos (src/adapters/, src-tauri/src/     │
│  adapters/)                                                 │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Rules

- **Domain** depends on nothing (pure business logic)
- **Ports** define interfaces the domain needs
- **Adapters** implement ports, depend on external systems
- **Application** orchestrates domain + ports
- **UI** consumes application services only

### Tauri IPC Restriction

**Direct `invoke()` calls are not allowed.** All Tauri IPC must go through:

- Type-safe adapters in `src/adapters/`
- Generated bindings in `src/lib/bindings.ts`
- API wrappers in `src/lib/api/`

This is enforced by ESLint's `no-restricted-imports` rule.

### Frontend (src/)

- **React + TypeScript + Vite** on port 1420
- **Domain**: `src/domain/` - Pure business logic (highlight merging, text chunking)
- **Ports**: `src/ports/` - Repository interfaces
- **Adapters**: `src/adapters/` - Tauri IPC implementation
- **Application**: `src/application/` - Use cases and services
- **State management**: Zustand stores in `src/stores/`
- **PDF rendering**: pdf.js (`pdfjs-dist`) with worker exclusion in vite config
- **Tauri IPC**: Type-safe API in `src/lib/api/` (re-exported from `src/lib/tauri-invoke.ts`)

### Backend (src-tauri/)

- **Tauri 2.x** with plugins: dialog, fs, sql (SQLite), shell
- **Domain**: `src/domain/` - Entities and business rules
- **Ports**: `src/ports/` - Repository and service traits
- **Adapters**: `src/adapters/` - SQLite repos, native TTS
- **Application**: `src/application/` - Service implementations
- **Commands**: `src/commands/` - Thin Tauri command handlers
- **TTS**: Native TTS via `tts` crate in `src/tts/`
- **Logging**: tracing with env-filter (default: `tauri_pdf_reader=debug`)

### Key Types (shared between frontend/backend)

- `Document` - PDF metadata (id, filePath, title, pageCount, currentPage, lastOpenedAt)
- `Highlight` - Text selection (id, documentId, pageNumber, rects[], color, textContent)
- Types generated by tauri-specta in `src/lib/bindings.ts`

## Test Structure

- **Domain tests**: Pure unit tests in `**/domain/**/tests/`
- **Contract tests**: Verify port implementations in `tests/`
- **Architecture tests**: Boundary validation in `src/__tests__/architecture/`
- **UI component tests**: Component behavior in `src/__tests__/ui/`
- **E2E tests**: Critical user flows in `e2e/`

## Configuration Files

- `src-tauri/tauri.conf.json` - Tauri app config, window settings, CSP, SQLite plugin config
- `src-tauri/Cargo.toml` - Rust dependencies, features (`native-tts`, `elevenlabs-tts`, `test-mocks`)
- `vite.config.ts` - Vite config with pdf.js worker handling (`optimizeDeps.exclude: ['pdfjs-dist']`)
- `vitest.config.ts` - Test config with 80% coverage thresholds

## TypeScript Strictness

Strict mode enabled with: `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `noUnusedLocals`, `noUnusedParameters`

## UI/UX Design System

All CSS values should use tokens from `src/ui/tokens/`:

```css
/* Colors */
background: var(--color-bg-toolbar);
color: var(--color-text-primary);
border: 1px solid var(--color-border);

/* Spacing (4px base) */
padding: var(--space-4); /* 16px */
gap: var(--space-2); /* 8px */

/* Typography */
font-size: var(--text-sm);
font-weight: var(--font-medium);

/* Layout */
height: var(--button-height);
width: var(--width-sidebar);

/* Motion */
transition: all var(--transition-fast);
```

### Reusable Components

Import from `src/ui/components/`:

- `Button` - Primary/secondary/ghost button variants
- `IconButton` - Icon-only buttons with accessible labels
- `Panel` - Collapsible side panels
- `EmptyState` - Empty content placeholders
- `ListRow` - List items with leading/trailing slots
- `Toast` - Notification messages

### Keyboard Shortcuts

Defined in `src/hooks/useKeyboardShortcuts.ts`:

- `Ctrl+O` - Open file
- `Ctrl+,` - Settings
- `Ctrl+H` - Toggle highlights
- `Ctrl+B` - Toggle sidebar
- `Escape` - Close modal/panel
- `Space` - Play/Pause TTS

## Z-Index Token System

All z-index values use CSS custom properties from `src/ui/tokens/z-index.css`:

```css
/* Base layers (PDF rendering) */
--z-base: 0; /* Background */
--z-canvas: 1; /* PDF canvas */
--z-text-layer: 2; /* Text selection layer */
--z-highlight: 10; /* Highlight overlays */

/* Interactive elements */
--z-dropdown: 50; /* Dropdowns */
--z-sticky: 75; /* Fixed headers/footers */
--z-floating: 100; /* Floating toolbars */

/* Overlays */
--z-sidebar: 900; /* Side panels */
--z-modal: 1000; /* Modal dialogs */
--z-context-menu: 1001; /* Context menus (above modals) */
--z-toast: 2000; /* Toast notifications */
```

## AI TTS Integration

The app uses ElevenLabs AI TTS with the following patterns:

### Audio Caching

- **File-based cache** in `{app_data_dir}/tts_cache/`
- **Cache key**: SHA256(text + voice_id + model_id + settings)
- **Adapter**: `src-tauri/src/adapters/audio_cache.rs`
- **Frontend API**: `src/lib/api/ai-tts.ts` (aiTtsCacheInfo, aiTtsCacheClear)

### State Management

- **Zustand store**: `src/stores/ai-tts-store.ts`
- **State machine**: Uses `VALID_TRANSITIONS` map and `transitionTo(nextState)` for validated state changes
- **States**: idle → loading → playing ⇄ paused → idle (or error)
- **Event-driven sync**: Backend emits `ai-tts:*` events to sync frontend state
- **Debug logging**: All state transitions logged via `console.debug('[TTS]...')`
- **Stale closure prevention**: Use refs (`currentPageRef`, `totalPagesRef`) in async callbacks to avoid capturing stale state

### Page Navigation & TTS

- TTS stops automatically on page change (see `src/components/PageNavigation.tsx`)
- Error recovery UI with dismiss/settings buttons in AiPlaybackBar
- **Auto-page**: `autoPageEnabled` setting enables automatic page advancement after TTS completes
- **Auto-scroll**: `scrollToWord()` keeps current TTS word visible in viewport

### Page Element Identification

- **Pattern**: Use `data-page-number` attribute on page containers for reliable DOM targeting
- **Lookup**: `document.querySelector('[data-page-number="${pageNum}"]')` instead of ref-based containment
- **Rationale**: `element.closest('[data-page-number]')` is more reliable than `contains()` for event delegation across dynamically rendered pages

## Linux Prerequisites

```bash
# System dependencies for Tauri
sudo apt install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# TTS (Speech Dispatcher)
sudo apt install -y speech-dispatcher libspeechd-dev
```

## Active Technologies
- TypeScript 5.6.x (frontend), Rust 2021 edition (backend) + React 18.3+, Zustand 5.x, Tauri 2.x, rodio 0.21+, id3 1.x (006-reading-session-audio-cache)
- SQLite via tauri-plugin-sql (metadata) + filesystem (audio files) (006-reading-session-audio-cache)

## Recent Changes
- 006-reading-session-audio-cache: Added TypeScript 5.6.x (frontend), Rust 2021 edition (backend) + React 18.3+, Zustand 5.x, Tauri 2.x, rodio 0.21+, id3 1.x
