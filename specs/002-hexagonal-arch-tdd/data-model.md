# Data Model: Hexagonal Architecture + TDD Guardrails

**Feature**: 002-hexagonal-arch-tdd
**Date**: 2026-01-13
**Status**: Complete

## Overview

This document defines the domain entities, ports (interfaces), and their relationships in the hexagonal architecture. Entities are pure data structures with validation; ports define the contracts for external interactions.

---

## Domain Entities

### Document

Represents a PDF document in the user's library.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `string` | SHA-256 hash, unique | Content-based identifier |
| `filePath` | `string` | Non-empty, valid path | Absolute filesystem path |
| `title` | `string?` | Optional | User-editable document title |
| `pageCount` | `int?` | Positive if set | Total pages in PDF |
| `currentPage` | `int` | >= 1 | Last viewed page |
| `scrollPosition` | `float` | 0.0 - 1.0 | Vertical scroll position within page |
| `lastTtsChunkId` | `string?` | UUID if set | Last TTS chunk for resume |
| `lastOpenedAt` | `datetime?` | ISO 8601 | Last access timestamp |
| `fileHash` | `string?` | SHA-256 | Content hash for change detection |
| `createdAt` | `datetime` | ISO 8601 | First import timestamp |

**Invariants**:
- `currentPage` must be <= `pageCount` when both are set
- `scrollPosition` must be in [0.0, 1.0] range

**State Transitions**:
```
[New] --add--> [Imported] --open--> [Viewing] --close--> [Imported]
                    |                    |
                    +----remove----------+------> [Deleted]
```

---

### Highlight

Represents a text highlight annotation within a document.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `string` | UUID v4, unique | Unique highlight identifier |
| `documentId` | `string` | FK to Document | Parent document reference |
| `pageNumber` | `int` | >= 1 | Page containing highlight |
| `rects` | `Rect[]` | Non-empty array | Bounding rectangles (page coords) |
| `color` | `string` | Hex color (#RRGGBB) | Highlight color |
| `textContent` | `string?` | Optional | Selected text content |
| `note` | `string?` | Optional | User annotation |
| `createdAt` | `datetime` | ISO 8601 | Creation timestamp |
| `updatedAt` | `datetime?` | ISO 8601 | Last modification |

**Invariants**:
- `rects` must have at least one element
- `color` must match `/^#[0-9a-fA-F]{6}$/`
- `pageNumber` must be valid for parent document

---

### Rect (Value Object)

Represents a rectangle in page coordinate space.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `x` | `float` | Any | Left edge X coordinate |
| `y` | `float` | Any | Top edge Y coordinate |
| `width` | `float` | > 0 | Rectangle width |
| `height` | `float` | > 0 | Rectangle height |

---

### Settings (Aggregate)

User preferences stored as key-value pairs.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `tts.voice` | `string?` | System default | Selected TTS voice ID |
| `tts.rate` | `float` | 1.0 | Playback rate (0.5 - 3.0) |
| `tts.followAlong` | `bool` | true | Auto-scroll during TTS |
| `highlight.colors` | `string[]` | [#ffeb3b, #4caf50, #2196f3, #f44336] | Available colors |
| `highlight.defaultColor` | `string` | #ffeb3b | Default new highlight color |
| `theme` | `enum` | 'system' | UI theme (light/dark/system) |
| `telemetry.analytics` | `bool` | false | Usage analytics opt-in |
| `telemetry.errors` | `bool` | true | Error reporting opt-in |

---

### TtsState (Read Model)

Current state of the TTS engine (not persisted).

| Field | Type | Description |
|-------|------|-------------|
| `initialized` | `bool` | Engine ready |
| `isSpeaking` | `bool` | Currently playing audio |
| `isPaused` | `bool` | Playback paused |
| `currentChunkId` | `string?` | Active text chunk |
| `currentVoice` | `VoiceInfo?` | Selected voice |
| `rate` | `float` | Current playback rate |

---

### VoiceInfo (Value Object)

TTS voice metadata.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Voice identifier |
| `name` | `string` | Display name |
| `language` | `string?` | Language code (e.g., "en-US") |

---

### DomainError (Error Type)

Standardized error type for domain operations.

| Variant | Description |
|---------|-------------|
| `NotFound` | Resource not found (document, highlight, etc.) |
| `Validation` | Invalid input or business rule violation |
| `Storage` | Database or persistence error |
| `Tts` | Text-to-speech engine error |
| `FileSystem` | File operation error |

---

## Port Interfaces

### DocumentRepositoryPort

```typescript
interface DocumentRepositoryPort {
  add(filePath: string, title?: string, pageCount?: number): Promise<Document>;
  getById(id: string): Promise<Document | null>;
  getByPath(filePath: string): Promise<Document | null>;
  list(orderBy?: OrderBy, limit?: number, offset?: number): Promise<Document[]>;
  updateProgress(id: string, page: number, scroll?: number, ttsChunk?: string): Promise<Document>;
  updateTitle(id: string, title: string): Promise<Document>;
  relocate(id: string, newPath: string): Promise<Document>;
  remove(id: string): Promise<void>;
  checkFileExists(filePath: string): Promise<{ exists: boolean; filePath: string }>;
}

type OrderBy = 'last_opened' | 'created' | 'title';
```

**Rust Trait** (`src-tauri/src/ports/document_repository.rs`):
```rust
#[cfg_attr(any(test, feature = "test-mocks"), automock)]
#[async_trait]
pub trait DocumentRepository: Send + Sync {
    async fn add(&self, file_path: String, title: Option<String>, page_count: Option<i32>) -> Result<Document, DomainError>;
    async fn get_by_id(&self, id: String) -> Result<Option<Document>, DomainError>;
    async fn get_by_path(&self, path: String) -> Result<Option<Document>, DomainError>;
    async fn list(&self, order: OrderBy, limit: Option<i32>, offset: Option<i32>) -> Result<Vec<Document>, DomainError>;
    async fn update_progress(&self, id: String, page: i32, scroll: Option<f64>, tts_chunk: Option<String>) -> Result<Document, DomainError>;
    async fn update_title(&self, id: String, title: String) -> Result<Document, DomainError>;
    async fn relocate(&self, id: String, new_path: String) -> Result<Document, DomainError>;
    async fn remove(&self, id: String) -> Result<(), DomainError>;
    async fn check_file_exists(&self, path: String) -> Result<FileExistsResponse, DomainError>;
}
```

---

### HighlightRepositoryPort

```typescript
interface HighlightRepositoryPort {
  create(input: HighlightCreate): Promise<Highlight>;
  batchCreate(inputs: HighlightCreate[]): Promise<{ highlights: Highlight[]; created: number }>;
  getById(id: string): Promise<Highlight | null>;
  listForPage(documentId: string, pageNumber: number): Promise<Highlight[]>;
  listForDocument(documentId: string): Promise<Highlight[]>;
  update(id: string, input: HighlightUpdate): Promise<Highlight>;
  delete(id: string): Promise<void>;
  deleteForDocument(documentId: string): Promise<{ deleted: number }>;
  export(documentId: string, format: ExportFormat): Promise<{ content: string; filename: string }>;
}

type ExportFormat = 'markdown' | 'json' | 'text';

interface HighlightCreate {
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent?: string;
}

interface HighlightUpdate {
  color?: string;
  note?: string;
}
```

---

### TtsPort

```typescript
interface TtsPort {
  init(): Promise<TtsInitResponse>;
  listVoices(): Promise<VoiceInfo[]>;
  speak(text: string, chunkId?: string): Promise<void>;
  speakLong(chunks: Array<{ id: string; text: string }>): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  setVoice(voiceId: string): Promise<void>;
  setRate(rate: number): Promise<void>;
  getState(): Promise<TtsState>;
  checkCapabilities(): Promise<TtsCapabilities>;
}

interface TtsInitResponse {
  available: boolean;
  backend?: string;
  defaultVoice?: string;
  error?: string;
}

interface TtsCapabilities {
  supportsUtterance: boolean;
  supportsRate: boolean;
  supportsPitch: boolean;
  supportsVolume: boolean;
}
```

---

### SettingsPort

```typescript
interface SettingsPort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
  delete(key: string): Promise<void>;
  setBatch(settings: Record<string, unknown>): Promise<void>;
}
```

---

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                         DOMAIN LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐       1:N       ┌───────────┐                    │
│  │ Document │────────────────▶│ Highlight │                    │
│  └──────────┘                 └───────────┘                    │
│       │                            │                           │
│       │ uses                       │ contains                  │
│       ▼                            ▼                           │
│  ┌──────────┐                 ┌──────────┐                     │
│  │ Settings │                 │   Rect   │ (value object)      │
│  └──────────┘                 └──────────┘                     │
│                                                                 │
│  ┌──────────┐                 ┌───────────┐                    │
│  │ TtsState │ (read model)    │ VoiceInfo │ (value object)     │
│  └──────────┘                 └───────────┘                    │
│                                                                 │
│  ┌─────────────┐                                               │
│  │ DomainError │ (error type)                                  │
│  └─────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ accessed via
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          PORTS LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  DocumentRepositoryPort  HighlightRepositoryPort               │
│  TtsPort                 SettingsPort                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ implemented by
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ADAPTERS LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Frontend:                    │  Backend:                       │
│  - TauriDocumentRepository    │  - SqliteDocumentRepo          │
│  - TauriHighlightRepository   │  - SqliteHighlightRepo         │
│  - TauriTtsAdapter            │  - NativeTtsAdapter            │
│  - TauriSettingsAdapter       │  - ElevenLabsAdapter           │
│  - MockDocumentRepository     │  - SqliteSettingsRepo          │
│  - MockHighlightRepository    │  - MockDocumentRepo            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Validation Rules Summary

| Entity | Rule | Error |
|--------|------|-------|
| Document | `filePath` non-empty | "File path required" |
| Document | `currentPage` >= 1 | "Page must be positive" |
| Document | `scrollPosition` in [0, 1] | "Scroll must be 0-1" |
| Highlight | `rects` non-empty | "At least one rect required" |
| Highlight | `color` hex format | "Invalid color format" |
| Highlight | `pageNumber` >= 1 | "Page must be positive" |
| Settings | `tts.rate` in [0.5, 3.0] | "Rate out of range" |
| Settings | `theme` in enum | "Invalid theme" |
| Rect | `width` > 0 | "Width must be positive" |
| Rect | `height` > 0 | "Height must be positive" |
