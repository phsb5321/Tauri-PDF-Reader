# Data Model: Reading Session Manager with Audio Cache & Progress Persistence

**Feature Branch**: `006-reading-session-audio-cache`
**Created**: 2026-01-25

## Overview

This document defines the data model for the reading session manager and enhanced audio cache features. The design extends the existing SQLite schema and follows hexagonal architecture patterns.

---

## 1. SQLite Schema Extensions

### Migration Version 3: Reading Sessions & Enhanced Cache

```sql
-- Migration 3: Reading Sessions and Enhanced Audio Cache
-- Adds reading sessions, session documents, and enhances tts_cache_metadata

-- Reading Sessions Table
CREATE TABLE IF NOT EXISTS reading_sessions (
    id TEXT PRIMARY KEY,                    -- UUID
    name TEXT NOT NULL,                     -- User-defined session name
    created_at TEXT NOT NULL,               -- ISO 8601 timestamp
    updated_at TEXT NOT NULL,               -- ISO 8601 timestamp
    last_accessed_at TEXT NOT NULL          -- For sorting by recency
);

-- Session Documents Junction Table
CREATE TABLE IF NOT EXISTS session_documents (
    session_id TEXT NOT NULL,               -- FK to reading_sessions.id
    document_id TEXT NOT NULL,              -- FK to documents.id
    position INTEGER NOT NULL,              -- Order in session (0-indexed)
    current_page INTEGER NOT NULL DEFAULT 1, -- Saved page position
    scroll_position REAL NOT NULL DEFAULT 0.0, -- Saved scroll position
    created_at TEXT NOT NULL,               -- When added to session
    PRIMARY KEY (session_id, document_id),
    FOREIGN KEY (session_id) REFERENCES reading_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Enhance existing tts_cache_metadata with chunk tracking
-- Note: tts_cache_metadata already exists from migration 2
-- Add new columns if they don't exist
ALTER TABLE tts_cache_metadata ADD COLUMN chunk_index INTEGER;
ALTER TABLE tts_cache_metadata ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tts_cache_metadata ADD COLUMN total_chunks INTEGER;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reading_sessions_last_accessed
    ON reading_sessions(last_accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_documents_session
    ON session_documents(session_id, position);

CREATE INDEX IF NOT EXISTS idx_tts_cache_document_page
    ON tts_cache_metadata(document_id, page_number);

-- Cache settings table for configuration
CREATE TABLE IF NOT EXISTS cache_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Insert default cache settings
INSERT OR IGNORE INTO cache_settings (key, value, updated_at) VALUES
    ('max_size_bytes', '5368709120', datetime('now')),  -- 5GB default
    ('eviction_policy', 'lru', datetime('now'));
```

---

## 2. Entity Definitions

### 2.1 ReadingSession (Domain Entity)

**TypeScript** (`src/domain/sessions/session.ts`):

```typescript
export interface ReadingSession {
  id: string; // UUID
  name: string; // User-defined name (1-100 chars)
  documents: SessionDocument[]; // Ordered list of documents
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  lastAccessedAt: string; // For recency sorting
}

export interface SessionDocument {
  documentId: string; // FK to documents.id
  position: number; // Order in session (0-indexed)
  currentPage: number; // Saved page position
  scrollPosition: number; // Saved scroll position (0.0-1.0)
  createdAt: string; // When added to session
}

// Validation rules
export const SESSION_NAME_MIN_LENGTH = 1;
export const SESSION_NAME_MAX_LENGTH = 100;
export const MAX_DOCUMENTS_PER_SESSION = 50;
```

**Rust** (`src-tauri/src/domain/sessions/session.rs`):

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingSession {
    pub id: String,
    pub name: String,
    pub documents: Vec<SessionDocument>,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDocument {
    pub document_id: String,
    pub position: i32,
    pub current_page: i32,
    pub scroll_position: f64,
    pub created_at: String,
}

impl ReadingSession {
    pub fn validate(&self) -> Result<(), String> {
        if self.name.is_empty() || self.name.len() > 100 {
            return Err("Session name must be 1-100 characters".into());
        }
        if self.documents.len() > 50 {
            return Err("Session cannot contain more than 50 documents".into());
        }
        Ok(())
    }
}
```

### 2.2 AudioCacheEntry (Enhanced)

**TypeScript** (`src/domain/cache/cache-entry.ts`):

```typescript
export interface AudioCacheEntry {
  cacheKey: string; // SHA256(text + voice_id + model_id)
  documentId: string | null; // Associated document (nullable for orphans)
  pageNumber: number | null; // Source page
  chunkIndex: number | null; // Chunk position within page
  totalChunks: number | null; // Total chunks for page (for coverage calc)
  textHash: string; // SHA256 of text content only
  voiceId: string; // ElevenLabs voice ID
  settingsHash: string; // Hash of TTS settings
  filePath: string; // Path to MP3 file
  sizeBytes: number; // File size in bytes
  durationMs: number; // Audio duration in milliseconds
  createdAt: string; // ISO 8601 timestamp
  lastAccessedAt: string; // For LRU eviction
}
```

**Rust** (`src-tauri/src/domain/cache/cache_entry.rs`):

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioCacheEntry {
    pub cache_key: String,
    pub document_id: Option<String>,
    pub page_number: Option<i32>,
    pub chunk_index: Option<i32>,
    pub total_chunks: Option<i32>,
    pub text_hash: String,
    pub voice_id: String,
    pub settings_hash: String,
    pub file_path: String,
    pub size_bytes: i64,
    pub duration_ms: i64,
    pub created_at: String,
    pub last_accessed_at: String,
}
```

### 2.3 CoverageStats (Calculated Entity)

**TypeScript** (`src/domain/cache/coverage.ts`):

```typescript
export interface CoverageStats {
  documentId: string;
  totalChunks: number; // Total chunks in document
  cachedChunks: number; // Number of cached chunks
  coveragePercent: number; // 0-100 percentage
  totalDurationMs: number; // Sum of cached audio duration
  cachedSizeBytes: number; // Total cache size for document
  lastUpdated: string; // ISO 8601 timestamp

  // Per-page breakdown (optional, for detailed UI)
  pageStats?: PageCoverageStats[];
}

export interface PageCoverageStats {
  pageNumber: number;
  totalChunks: number;
  cachedChunks: number;
  coveragePercent: number;
  durationMs: number;
}

// Helper functions
export function calculateCoveragePercent(
  cached: number,
  total: number,
): number {
  if (total === 0) return 0;
  return Math.round((cached / total) * 100);
}

export function isFullyCached(stats: CoverageStats): boolean {
  return stats.cachedChunks === stats.totalChunks && stats.totalChunks > 0;
}
```

**Rust** (`src-tauri/src/domain/cache/coverage.rs`):

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverageStats {
    pub document_id: String,
    pub total_chunks: i32,
    pub cached_chunks: i32,
    pub coverage_percent: f64,
    pub total_duration_ms: i64,
    pub cached_size_bytes: i64,
    pub last_updated: String,
    pub page_stats: Option<Vec<PageCoverageStats>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageCoverageStats {
    pub page_number: i32,
    pub total_chunks: i32,
    pub cached_chunks: i32,
    pub coverage_percent: f64,
    pub duration_ms: i64,
}

impl CoverageStats {
    pub fn is_fully_cached(&self) -> bool {
        self.cached_chunks == self.total_chunks && self.total_chunks > 0
    }

    pub fn calculate_percent(cached: i32, total: i32) -> f64 {
        if total == 0 {
            return 0.0;
        }
        ((cached as f64 / total as f64) * 100.0).round()
    }
}
```

### 2.4 ExportResult

**TypeScript** (`src/domain/export/export-result.ts`):

```typescript
export interface ExportResult {
  success: boolean;
  outputPath: string; // Path to exported file
  format: ExportFormat; // 'mp3' | 'm4b'
  totalDurationMs: number; // Total audio duration
  chapterCount: number; // Number of chapters embedded
  fileSizeBytes: number; // Output file size
  exportedAt: string; // ISO 8601 timestamp
}

export interface ExportProgress {
  phase: "loading" | "concatenating" | "embedding" | "writing" | "complete";
  currentChunk: number;
  totalChunks: number;
  percent: number; // 0-100
  estimatedRemainingMs: number;
}

export type ExportFormat = "mp3" | "m4b";

export interface ExportOptions {
  documentId: string;
  format: ExportFormat;
  outputPath: string;
  includeChapters: boolean; // Default: true
  chapterStrategy: "page" | "document"; // Default: 'page'
}
```

**Rust** (`src-tauri/src/domain/export/export_result.rs`):

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub success: bool,
    pub output_path: String,
    pub format: String,
    pub total_duration_ms: i64,
    pub chapter_count: i32,
    pub file_size_bytes: i64,
    pub exported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub phase: String,
    pub current_chunk: i32,
    pub total_chunks: i32,
    pub percent: f64,
    pub estimated_remaining_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub document_id: String,
    pub format: String,
    pub output_path: String,
    pub include_chapters: bool,
    pub chapter_strategy: String,
}
```

---

## 3. State Transitions

### 3.1 Reading Session Lifecycle

```
┌────────────┐
│   DRAFT    │ ← Session created but not saved
└─────┬──────┘
      │ save()
      ▼
┌────────────┐
│   SAVED    │ ← Persisted to SQLite
└─────┬──────┘
      │ restore()
      ▼
┌────────────┐
│   ACTIVE   │ ← Documents loaded, user reading
└─────┬──────┘
      │ update() / close()
      ▼
┌────────────┐
│   SAVED    │ ← Changes persisted
└────────────┘
      │ delete()
      ▼
┌────────────┐
│  DELETED   │ ← Removed from database
└────────────┘
```

### 3.2 Audio Cache Entry Lifecycle

```
┌────────────┐
│   MISS     │ ← Cache lookup returns nothing
└─────┬──────┘
      │ fetch from API
      ▼
┌────────────┐
│  PENDING   │ ← API request in progress
└─────┬──────┘
      │ store_cache()
      ▼
┌────────────┐
│   CACHED   │ ← Audio + metadata stored
└─────┬──────┘
      │ access()
      ▼
┌────────────┐
│ ACCESSED   │ ← last_accessed_at updated
└─────┬──────┘
      │ evict() (LRU)
      ▼
┌────────────┐
│  EVICTED   │ ← File + metadata deleted
└────────────┘
```

### 3.3 Export Process States

```
┌─────────────┐
│    IDLE     │
└──────┬──────┘
       │ check_readiness()
       ▼
┌─────────────┐
│  CHECKING   │
└──────┬──────┘
       │
       ├─────────────────────┐
       ▼                     ▼
┌─────────────┐      ┌─────────────┐
│   READY     │      │  INCOMPLETE │ ← Missing chunks
└──────┬──────┘      └─────────────┘
       │ start_export()
       ▼
┌─────────────┐
│   LOADING   │ ← Loading cached audio files
└──────┬──────┘
       ▼
┌─────────────┐
│CONCATENATING│ ← Joining audio samples
└──────┬──────┘
       ▼
┌─────────────┐
│  EMBEDDING  │ ← Adding ID3v2 chapters
└──────┬──────┘
       ▼
┌─────────────┐
│   WRITING   │ ← Writing output file
└──────┬──────┘
       ├─────────────────────┐
       ▼                     ▼
┌─────────────┐      ┌─────────────┐
│  COMPLETE   │      │   ERROR     │
└─────────────┘      └─────────────┘
```

---

## 4. Relationships

### Entity Relationship Diagram

```
┌─────────────────────┐
│     documents       │
├─────────────────────┤
│ id (PK)             │◄─────────────────────────────────────┐
│ file_path           │                                       │
│ title               │                                       │
│ page_count          │                                       │
│ ...                 │                                       │
└─────────────────────┘                                       │
        ▲                                                     │
        │ 1:N                                                 │
        │                                                     │
┌───────┴─────────────┐       ┌─────────────────────┐        │
│ session_documents   │       │  reading_sessions   │        │
├─────────────────────┤       ├─────────────────────┤        │
│ session_id (PK,FK)──┼──────►│ id (PK)             │        │
│ document_id (PK,FK) │       │ name                │        │
│ position            │       │ created_at          │        │
│ current_page        │       │ updated_at          │        │
│ scroll_position     │       │ last_accessed_at    │        │
│ created_at          │       └─────────────────────┘        │
└─────────────────────┘                                       │
                                                              │
┌─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐                                    │
│  │ tts_cache_metadata  │                                    │
│  ├─────────────────────┤                                    │
│  │ cache_key (PK)      │                                    │
│  │ document_id (FK)────┼────────────────────────────────────┘
│  │ page_number         │
│  │ chunk_index         │
│  │ total_chunks        │
│  │ text_hash           │
│  │ voice_id            │
│  │ settings_hash       │
│  │ file_path           │
│  │ size_bytes          │
│  │ duration_ms         │
│  │ created_at          │
│  │ last_accessed_at    │
│  └─────────────────────┘
│
│  ┌─────────────────────┐
│  │   cache_settings    │
│  ├─────────────────────┤
│  │ key (PK)            │
│  │ value               │
│  │ updated_at          │
│  └─────────────────────┘
```

### Cardinality Summary

| Relationship                             | Cardinality |
| ---------------------------------------- | ----------- |
| `reading_sessions` → `session_documents` | 1:N         |
| `documents` → `session_documents`        | 1:N         |
| `documents` → `tts_cache_metadata`       | 1:N         |

---

## 5. Validation Rules

### Session Validation

| Field       | Rule                                         |
| ----------- | -------------------------------------------- |
| `name`      | Required, 1-100 characters, trimmed          |
| `documents` | Max 50 documents per session                 |
| `position`  | Unique within session, 0-indexed, contiguous |

### Cache Entry Validation

| Field         | Rule                                   |
| ------------- | -------------------------------------- |
| `cache_key`   | Required, SHA256 format (64 hex chars) |
| `voice_id`    | Required, valid ElevenLabs voice ID    |
| `size_bytes`  | Must be > 0                            |
| `duration_ms` | Must be > 0                            |
| `file_path`   | Must exist and be readable             |

### Export Validation

| Field         | Rule                                         |
| ------------- | -------------------------------------------- |
| `document_id` | Must exist in documents table                |
| `format`      | Must be 'mp3' or 'm4b'                       |
| `output_path` | Must be writable location                    |
| Coverage      | Must be 100% or user confirms partial export |

---

## 6. Indexes for Performance

| Index                                | Purpose                   | Expected Query Pattern                       |
| ------------------------------------ | ------------------------- | -------------------------------------------- |
| `idx_reading_sessions_last_accessed` | Sort sessions by recency  | `ORDER BY last_accessed_at DESC`             |
| `idx_session_documents_session`      | List documents in session | `WHERE session_id = ? ORDER BY position`     |
| `idx_tts_cache_document_page`        | Coverage calculation      | `WHERE document_id = ? GROUP BY page_number` |
| `idx_tts_cache_voice`                | Cache invalidation        | `WHERE voice_id = ?` (already exists)        |
| `idx_tts_cache_document`             | Document cache cleanup    | `WHERE document_id = ?` (already exists)     |

---

## 7. Migration Strategy

### Backward Compatibility

- `tts_cache_metadata` table already exists but columns may be missing
- Use `ALTER TABLE ADD COLUMN IF NOT EXISTS` pattern
- Existing cache entries get `chunk_index = NULL`, `duration_ms = 0`
- Frontend handles missing coverage data gracefully

### Migration Order

1. Create `reading_sessions` table
2. Create `session_documents` table
3. Add missing columns to `tts_cache_metadata`
4. Create `cache_settings` table with defaults
5. Create new indexes
6. Update `_migrations` table with version 3
