# Data Model: Tauri PDF Reader with TTS and Highlights

**Feature Branch**: `001-tauri-pdf-tts-reader`
**Date**: 2026-01-11

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                            DOCUMENT                                  │
├─────────────────────────────────────────────────────────────────────┤
│ id: TEXT (PK) [SHA-256 hash]                                        │
│ file_path: TEXT NOT NULL                                            │
│ title: TEXT NOT NULL                                                │
│ page_count: INTEGER NOT NULL                                        │
│ current_page: INTEGER DEFAULT 1                                     │
│ scroll_position: REAL DEFAULT 0.0                                   │
│ last_tts_chunk_id: TEXT                                             │
│ last_opened_at: TEXT NOT NULL                                       │
│ created_at: TEXT NOT NULL                                           │
└───────────────┬─────────────────────────────────────────────────────┘
                │ 1
                │
                │ *
┌───────────────┴─────────────────────────────────────────────────────┐
│                           HIGHLIGHT                                  │
├─────────────────────────────────────────────────────────────────────┤
│ id: TEXT (PK) [UUID]                                                │
│ document_id: TEXT (FK → document.id) ON DELETE CASCADE              │
│ page_number: INTEGER NOT NULL                                       │
│ rects: TEXT NOT NULL [JSON array of Rect]                           │
│ color: TEXT NOT NULL [hex color #RRGGBB]                            │
│ text_content: TEXT                                                  │
│ note: TEXT                                                          │
│ created_at: TEXT NOT NULL                                           │
│ updated_at: TEXT                                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                           SETTINGS                                   │
├─────────────────────────────────────────────────────────────────────┤
│ key: TEXT (PK)                                                      │
│ value: TEXT NOT NULL [JSON]                                         │
│ updated_at: TEXT NOT NULL                                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          _MIGRATIONS                                 │
├─────────────────────────────────────────────────────────────────────┤
│ version: INTEGER (PK)                                               │
│ applied_at: TEXT NOT NULL                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Entities

### Document

Represents a PDF file in the user's library.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PK | SHA-256 content hash of the PDF file. Enables duplicate detection and survives file relocation. |
| `file_path` | TEXT | NOT NULL | Absolute path to the PDF file on disk. |
| `title` | TEXT | NOT NULL | Display title. Defaults to filename, can be customized by user. |
| `page_count` | INTEGER | NOT NULL | Total number of pages in the PDF. |
| `current_page` | INTEGER | DEFAULT 1 | Last viewed page number (1-indexed). |
| `scroll_position` | REAL | DEFAULT 0.0 | Vertical scroll offset within current page (0.0 to 1.0). |
| `last_tts_chunk_id` | TEXT | NULLABLE | Identifier of last TTS chunk for resume functionality. |
| `last_opened_at` | TEXT | NOT NULL | ISO 8601 timestamp of last open. Used for sorting library. |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp when document was first added to library. |

**Computed Properties**:
- `progress_percentage`: `(current_page / page_count) * 100`

**Validation Rules**:
- `file_path` must be an absolute path
- `current_page` must be between 1 and `page_count`
- `scroll_position` must be between 0.0 and 1.0

---

### Highlight

A marked text passage within a document.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PK | UUID v4. |
| `document_id` | TEXT | FK, NOT NULL | References `document.id`. CASCADE on delete. |
| `page_number` | INTEGER | NOT NULL | Page where highlight appears (1-indexed). |
| `rects` | TEXT | NOT NULL | JSON array of `Rect` objects defining highlight bounds. |
| `color` | TEXT | NOT NULL | Hex color code (e.g., `#FFEB3B`). |
| `text_content` | TEXT | NULLABLE | Selected text content for anchoring and search. |
| `note` | TEXT | NULLABLE | User-added note/annotation. |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp of creation. |
| `updated_at` | TEXT | NULLABLE | ISO 8601 timestamp of last modification. |

**Rect Schema** (stored as JSON):
```typescript
interface Rect {
  x: number;      // Left position (page coordinates)
  y: number;      // Top position (page coordinates)
  width: number;  // Width in page units
  height: number; // Height in page units
}
```

**Validation Rules**:
- `rects` array must have at least one element
- `color` must match regex `^#[0-9a-fA-F]{6}$`
- `page_number` must be >= 1

---

### Settings

Key-value store for user preferences.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `key` | TEXT | PK | Setting identifier (e.g., `tts.voice`, `theme`). |
| `value` | TEXT | NOT NULL | JSON-encoded value. |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp of last update. |

**Standard Keys**:

| Key | Value Type | Default | Description |
|-----|-----------|---------|-------------|
| `tts.voice` | string | System default | Selected TTS voice ID. |
| `tts.rate` | number | 1.0 | Speech rate (0.5 to 3.0). |
| `tts.follow_along` | boolean | true | Auto-scroll during TTS. |
| `highlight.colors` | string[] | `["#FFEB3B", "#4CAF50", "#2196F3", "#F44336"]` | Available highlight colors. |
| `highlight.default_color` | string | `"#FFEB3B"` | Default highlight color. |
| `theme` | string | `"system"` | UI theme (`light`, `dark`, `system`). |
| `telemetry.analytics` | boolean | false | Opt-in usage analytics. |
| `telemetry.errors` | boolean | false | Opt-in error reporting. |
| `last_clean_shutdown` | boolean | true | Crash detection flag. |

---

## Indexes

```sql
-- Optimize highlight queries by document and page
CREATE INDEX idx_highlights_document_page
    ON highlights(document_id, page_number);

-- Optimize library sorting by last opened
CREATE INDEX idx_documents_last_opened
    ON documents(last_opened_at DESC);

-- Optimize title search (case-insensitive)
CREATE INDEX idx_documents_title
    ON documents(title COLLATE NOCASE);
```

---

## State Transitions

### Document Lifecycle

```
┌──────────┐     open()      ┌──────────┐
│  CLOSED  │ ───────────────>│  OPEN    │
└──────────┘                 └────┬─────┘
     ^                            │
     │                            │ navigate(), scroll(), tts_play()
     │                            v
     │                       ┌──────────┐
     │    close()            │ READING  │
     └───────────────────────┴──────────┘
                                  │
                                  │ auto-save (30s interval)
                                  v
                             [DB UPDATE: current_page, scroll_position, last_tts_chunk_id]
```

### Highlight Lifecycle

```
┌──────────┐    create()     ┌──────────┐   update_color()   ┌──────────┐
│  (none)  │ ───────────────>│ CREATED  │ ───────────────────>│ MODIFIED │
└──────────┘                 └────┬─────┘   add_note()        └────┬─────┘
                                  │                                │
                                  │ delete()                       │ delete()
                                  v                                v
                             ┌──────────┐                     ┌──────────┐
                             │ DELETED  │                     │ DELETED  │
                             └──────────┘                     └──────────┘
```

---

## TypeScript Types (Frontend)

```typescript
// src/lib/schemas.ts

import { z } from 'zod';

export const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const DocumentSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  title: z.string(),
  pageCount: z.number().int().positive(),
  currentPage: z.number().int().min(1),
  scrollPosition: z.number().min(0).max(1),
  lastTtsChunkId: z.string().nullable(),
  lastOpenedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const HighlightSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string(),
  pageNumber: z.number().int().min(1),
  rects: z.array(RectSchema).min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textContent: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
});

export const SettingsSchema = z.object({
  ttsVoice: z.string().nullable(),
  ttsRate: z.number().min(0.5).max(3.0),
  ttsFollowAlong: z.boolean(),
  highlightColors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)),
  highlightDefaultColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  theme: z.enum(['light', 'dark', 'system']),
  telemetryAnalytics: z.boolean(),
  telemetryErrors: z.boolean(),
});

// Input types for create/update operations
export const CreateHighlightInputSchema = z.object({
  documentId: z.string(),
  pageNumber: z.number().int().min(1),
  rects: z.array(RectSchema).min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textContent: z.string().nullable(),
});

export const UpdateHighlightInputSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  note: z.string().nullable().optional(),
});

// Type exports
export type Rect = z.infer<typeof RectSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type CreateHighlightInput = z.infer<typeof CreateHighlightInputSchema>;
export type UpdateHighlightInput = z.infer<typeof UpdateHighlightInputSchema>;
```

---

## Rust Types (Backend)

```rust
// src-tauri/src/db/models.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub file_path: String,
    pub title: String,
    pub page_count: i32,
    pub current_page: i32,
    pub scroll_position: f64,
    pub last_tts_chunk_id: Option<String>,
    pub last_opened_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Highlight {
    pub id: String,
    pub document_id: String,
    pub page_number: i32,
    pub rects: Vec<Rect>,
    pub color: String,
    pub text_content: Option<String>,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHighlightInput {
    pub document_id: String,
    pub page_number: i32,
    pub rects: Vec<Rect>,
    pub color: String,
    pub text_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateHighlightInput {
    pub color: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceInfo {
    pub id: String,
    pub name: String,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsState {
    pub is_speaking: bool,
    pub current_chunk_id: Option<String>,
    pub current_voice: Option<String>,
    pub rate: f64,
}
```

---

## Database Migrations

```sql
-- Migration 001: Initial schema
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    title TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    current_page INTEGER NOT NULL DEFAULT 1,
    scroll_position REAL NOT NULL DEFAULT 0.0,
    last_tts_chunk_id TEXT,
    last_opened_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    rects TEXT NOT NULL,
    color TEXT NOT NULL,
    text_content TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_highlights_document_page
    ON highlights(document_id, page_number);

CREATE INDEX IF NOT EXISTS idx_documents_last_opened
    ON documents(last_opened_at DESC);

-- PRAGMAs (run at connection time)
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000;
PRAGMA busy_timeout = 5000;
```
