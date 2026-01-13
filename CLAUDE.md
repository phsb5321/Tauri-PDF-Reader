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

# Type check frontend only
pnpm build  # runs tsc && vite build

# Lint
pnpm lint
```

### Rust-specific Commands

```bash
# Check Rust code
cd src-tauri && cargo check

# Build with native TTS feature
cd src-tauri && cargo build --features native-tts

# Run Rust tests
cd src-tauri && cargo test
```

## Architecture

### Frontend (src/)
- **React + TypeScript + Vite** on port 1420
- **State management**: Zustand stores in `src/stores/`
  - `document-store.ts` - Current PDF document, page navigation, zoom, highlights
  - `settings-store.ts` - Theme, TTS settings
- **PDF rendering**: pdf.js (`pdfjs-dist`) with worker exclusion in vite config
- **Schema validation**: Zod schemas in `src/lib/schemas.ts` define all data types (Document, Highlight, Settings)
- **Tauri IPC**: Type-safe invoke wrapper in `src/lib/tauri-invoke.ts`

### Backend (src-tauri/)
- **Tauri 2.x** with plugins: dialog, fs, sql (SQLite), shell
- **Commands** in `src/commands/`: library (document CRUD), highlights
- **Database**: SQLite via `tauri-plugin-sql`, db schema in `src/db/`
- **TTS**: Optional native TTS via `tts` crate (feature flag `native-tts`)
- **Logging**: tracing with env-filter (default: `tauri_pdf_reader=debug`)

### Data Flow
1. Frontend calls Tauri commands via `invoke()`
2. Rust commands interact with SQLite for persistence
3. PDF rendering happens entirely in frontend via pdf.js
4. Highlights are stored in SQLite, keyed by document ID and page number

### Key Types (shared between frontend/backend)
- `Document` - PDF metadata (id, filePath, title, pageCount, currentPage, lastOpenedAt)
- `Highlight` - Text selection (id, documentId, pageNumber, rects[], color, textContent)
- Both use camelCase serialization (`#[serde(rename_all = "camelCase")]`)

## Configuration Files

- `src-tauri/tauri.conf.json` - Tauri app config, window settings, CSP, SQLite plugin config
- `src-tauri/Cargo.toml` - Rust dependencies, features (`native-tts`)
- `vite.config.ts` - Vite config with pdf.js worker handling (`optimizeDeps.exclude: ['pdfjs-dist']`)

## TypeScript Strictness

Strict mode enabled with: `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `noUnusedLocals`, `noUnusedParameters`

## Active Technologies
- TypeScript 5.x (frontend), Rust 1.75+ (backend) + React 18+, Tauri 2.x, pdf.js, Zustand, Zod, tauri-plugin-sql, tauri-plugin-dialog (001-tauri-pdf-tts-reader)
- SQLite via tauri-plugin-sql (local database) (001-tauri-pdf-tts-reader)

## Recent Changes
- 001-tauri-pdf-tts-reader: Added TypeScript 5.x (frontend), Rust 1.75+ (backend) + React 18+, Tauri 2.x, pdf.js, Zustand, Zod, tauri-plugin-sql, tauri-plugin-dialog
