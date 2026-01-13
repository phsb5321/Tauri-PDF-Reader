# Data Model: Tauri PDF Reader

**Feature**: 044-tauri-pdf-reader | **Date**: 2026-01-11 | **Phase**: 1

## Overview

This document defines the data entities, their relationships, and storage schema for the Tauri PDF Reader application.

---

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│    Document     │──────<│    Highlight    │
├─────────────────┤  1:N  ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ file_path       │       │ document_id (FK)│
│ title           │       │ page_number     │
│ page_count      │       │ rects (JSON)    │
│ current_page    │       │ color           │
│ last_opened_at  │       │ text_content    │
│ file_hash       │       │ created_at      │
│ created_at      │       └─────────────────┘
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌─────────────────┐
│ ReadingSession  │       │   AppSettings   │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ key (PK)        │
│ document_id (FK)│       │ value (JSON)    │
│ started_at      │       │ updated_at      │
│ ended_at        │       └─────────────────┘
│ pages_viewed    │
└─────────────────┘
```

---

## Entity Definitions

### Document

Represents a PDF file in the user's library.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PK | UUID v4 |
| `file_path` | TEXT | UNIQUE, NOT NULL | Absolute path to PDF file |
| `title` | TEXT | | Document title (from metadata or filename) |
| `page_count` | INTEGER | | Total pages in document |
| `current_page` | INTEGER | DEFAULT 1 | Last viewed page (reading progress) |
| `last_opened_at` | TEXT | | ISO 8601 timestamp |
| `file_hash` | TEXT | | SHA-256 hash for identity/change detection |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**TypeScript Interface**:
```typescript
interface Document {
  id: string;
  filePath: string;
  title: string | null;
  pageCount: number | null;
  currentPage: number;
  lastOpenedAt: string | null;
  fileHash: string | null;
  createdAt: string;
}
```

**Rust Struct**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub file_path: String,
    pub title: Option<String>,
    pub page_count: Option<i32>,
    pub current_page: i32,
    pub last_opened_at: Option<String>,
    pub file_hash: Option<String>,
    pub created_at: String,
}
```

---

### Highlight

A text highlight within a document. Stored as overlay metadata, not embedded in PDF.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PK | UUID v4 |
| `document_id` | TEXT | FK → Document, NOT NULL | Parent document |
| `page_number` | INTEGER | NOT NULL | 1-indexed page number |
| `rects` | TEXT | NOT NULL | JSON array of rectangles |
| `color` | TEXT | NOT NULL | CSS color value (e.g., "#ffff00") |
| `text_content` | TEXT | | Highlighted text for TTS |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Rect JSON Schema**:
```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "x": { "type": "number" },
      "y": { "type": "number" },
      "width": { "type": "number" },
      "height": { "type": "number" }
    },
    "required": ["x", "y", "width", "height"]
  }
}
```

**TypeScript Interface**:
```typescript
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Highlight {
  id: string;
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent: string | null;
  createdAt: string;
}
```

**Rust Struct**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Highlight {
    pub id: String,
    pub document_id: String,
    pub page_number: i32,
    pub rects: Vec<Rect>,
    pub color: String,
    pub text_content: Option<String>,
    pub created_at: String,
}
```

---

### ReadingSession

Tracks reading activity for analytics (optional, v0 may omit).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PK | UUID v4 |
| `document_id` | TEXT | FK → Document, NOT NULL | Document being read |
| `started_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `ended_at` | TEXT | | ISO 8601 timestamp |
| `pages_viewed` | TEXT | | JSON array of page numbers |

**TypeScript Interface**:
```typescript
interface ReadingSession {
  id: string;
  documentId: string;
  startedAt: string;
  endedAt: string | null;
  pagesViewed: number[];
}
```

---

### AppSettings

Key-value store for application settings.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `key` | TEXT | PK | Setting key |
| `value` | TEXT | NOT NULL | JSON-encoded value |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Predefined Keys**:

| Key | Value Type | Default | Description |
|-----|------------|---------|-------------|
| `default_highlight_color` | string | "#ffff00" | Default color for new highlights |
| `tts_voice` | string | null | Selected TTS voice ID |
| `tts_rate` | number | 1.0 | Speech rate (0.5 - 2.0) |
| `theme` | string | "system" | "light", "dark", or "system" |
| `zoom_level` | number | 1.0 | Default zoom level |

**TypeScript Interface**:
```typescript
interface AppSettings {
  defaultHighlightColor: string;
  ttsVoice: string | null;
  ttsRate: number;
  theme: 'light' | 'dark' | 'system';
  zoomLevel: number;
}
```

---

## Database Schema (SQLite)

```sql
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,
    title TEXT,
    page_count INTEGER,
    current_page INTEGER NOT NULL DEFAULT 1,
    last_opened_at TEXT,
    file_hash TEXT,
    created_at TEXT NOT NULL
);

-- Highlights table
CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    rects TEXT NOT NULL,  -- JSON array
    color TEXT NOT NULL,
    text_content TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Index for fast highlight lookup by document and page
CREATE INDEX IF NOT EXISTS idx_highlights_document_page 
    ON highlights(document_id, page_number);

-- Reading sessions table (optional for v0)
CREATE TABLE IF NOT EXISTS reading_sessions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    pages_viewed TEXT,  -- JSON array
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,  -- JSON encoded
    updated_at TEXT NOT NULL
);

-- Insert default settings
INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES
    ('default_highlight_color', '"#ffff00"', datetime('now')),
    ('tts_rate', '1.0', datetime('now')),
    ('theme', '"system"', datetime('now')),
    ('zoom_level', '1.0', datetime('now'));
```

---

## Data Validation (Zod Schemas)

```typescript
import { z } from 'zod';

export const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const HighlightCreateSchema = z.object({
  documentId: z.string().uuid(),
  pageNumber: z.number().int().positive(),
  rects: z.array(RectSchema).min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textContent: z.string().optional(),
});

export const DocumentCreateSchema = z.object({
  filePath: z.string().min(1),
  title: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
  fileHash: z.string().optional(),
});

export const SettingsSchema = z.object({
  defaultHighlightColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ttsVoice: z.string().nullable(),
  ttsRate: z.number().min(0.5).max(2.0),
  theme: z.enum(['light', 'dark', 'system']),
  zoomLevel: z.number().min(0.25).max(4.0),
});
```

---

## Migration Strategy

For v0, migrations are embedded in the app startup:

```typescript
// src/lib/db.ts
import Database from '@tauri-apps/plugin-sql';

const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS documents (...);
      CREATE TABLE IF NOT EXISTS highlights (...);
      CREATE TABLE IF NOT EXISTS app_settings (...);
    `
  },
  // Future migrations added here
];

export async function initDatabase() {
  const db = await Database.load('sqlite:pdf-reader.db');
  
  // Create migrations table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
  
  // Get current version
  const result = await db.select<{version: number}[]>(
    'SELECT MAX(version) as version FROM _migrations'
  );
  const currentVersion = result[0]?.version ?? 0;
  
  // Apply pending migrations
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      await db.execute(migration.sql);
      await db.execute(
        'INSERT INTO _migrations (version, applied_at) VALUES (?, ?)',
        [migration.version, new Date().toISOString()]
      );
    }
  }
  
  return db;
}
```
