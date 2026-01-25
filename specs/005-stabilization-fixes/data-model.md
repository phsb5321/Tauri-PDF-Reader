# Data Model: Stabilization & Fixes Sprint

**Branch**: `005-stabilization-fixes` | **Date**: 2026-01-14

## Overview

This is a fix sprint - no new entities are introduced. This document clarifies the existing data model and identifies field additions/corrections needed.

---

## Existing Entities

### Document

Represents a PDF file in the library.

**Table**: `documents` (SQLite)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | TEXT | PRIMARY KEY | SHA-256 hash of file content |
| file_path | TEXT | NOT NULL, UNIQUE | Absolute path to PDF |
| title | TEXT | nullable | User-set or filename-derived |
| page_count | INTEGER | nullable | Total pages in document |
| current_page | INTEGER | DEFAULT 1 | Reading progress (1-indexed) |
| scroll_position | REAL | DEFAULT 0.0 | Vertical scroll (0.0-1.0) |
| last_tts_chunk_id | TEXT | nullable | Current TTS position |
| last_opened_at | TEXT | nullable | RFC3339 timestamp |
| file_hash | TEXT | nullable | For duplicate detection |
| created_at | TEXT | NOT NULL | RFC3339 creation timestamp |

**Relationships**:
- `Document` 1:N `Highlight` (via document_id)
- `Document` 1:N `CachedAudio` (via document_id) - **NEW in this sprint**

**Frontend Type** (TypeScript):
```typescript
interface Document {
  id: string;
  filePath: string;
  title: string | null;
  pageCount: number | null;
  currentPage: number;
  scrollPosition: number;
  lastTtsChunkId: string | null;
  lastOpenedAt: string | null;
  fileHash: string | null;
  createdAt: string;
}
```

---

### Highlight

Represents marked text in a document.

**Table**: `highlights` (SQLite)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| document_id | TEXT | NOT NULL, FK → documents.id | ON DELETE CASCADE |
| page_number | INTEGER | NOT NULL, CHECK ≥ 1 | 1-indexed |
| rects | TEXT | NOT NULL | JSON array of Rect objects |
| color | TEXT | NOT NULL | Hex format #RRGGBB |
| text_content | TEXT | nullable | Extracted highlighted text |
| note | TEXT | nullable | User annotation |
| created_at | TEXT | NOT NULL | RFC3339 timestamp |
| updated_at | TEXT | nullable | RFC3339 timestamp |

**Rect Object** (stored in `rects` JSON):
```typescript
interface Rect {
  x: number;      // PDF coordinate space (scale=1.0)
  y: number;      // PDF coordinate space (scale=1.0)
  width: number;  // PDF coordinate space
  height: number; // PDF coordinate space
}
```

**Validation Rules**:
- `rects` array must be non-empty
- `color` must match `/^#[0-9A-Fa-f]{6}$/`
- `page_number` must be ≥ 1

**Frontend Type** (TypeScript):
```typescript
interface Highlight {
  id: string;
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
}
```

---

### CachedAudio (ENHANCED - Track D)

Represents generated TTS audio for a text chunk with word timing data.

**Table**: `tts_cache_metadata` (SQLite) - **EXISTING but needs population**

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| cache_key | TEXT | PRIMARY KEY | SHA-256 hash of (text + voice + settings) |
| document_id | TEXT | nullable, FK → documents.id | ON DELETE CASCADE |
| page_number | INTEGER | NOT NULL | Page this audio belongs to |
| text_hash | TEXT | NOT NULL | SHA-256 of source text only |
| voice_id | TEXT | NOT NULL | ElevenLabs voice ID |
| model_id | TEXT | NOT NULL | ElevenLabs model ID |
| settings_hash | TEXT | NOT NULL | Hash of (stability + similarity + speed) |
| file_path | TEXT | NOT NULL, UNIQUE | Path to cached .mp3 file |
| size_bytes | INTEGER | NOT NULL | File size for cache management |
| content_hash | TEXT | NOT NULL | SHA-256 of file content (corruption detection) |
| created_at | TEXT | NOT NULL | RFC3339 timestamp |
| last_accessed_at | TEXT | NOT NULL | For LRU eviction |
| access_count | INTEGER | NOT NULL, DEFAULT 1 | Frequency tracking for hybrid LRU/LFU |
| word_timings_json | TEXT | nullable | JSON array of WordTiming objects |
| total_duration_ms | INTEGER | nullable | Audio duration in milliseconds |
| is_valid | BOOLEAN | NOT NULL, DEFAULT 1 | Soft delete for corrupted files |

**WordTiming Object** (stored in `word_timings_json` JSON array):
```typescript
interface WordTiming {
  word: string;       // The word text
  startTime: number;  // Start time in seconds
  endTime: number;    // End time in seconds
  charStart: number;  // Character offset (start)
  charEnd: number;    // Character offset (end)
}
```

**Cache Key Generation**:
```rust
fn generate_cache_key(text: &str, voice_id: &str, settings: &TtsConfig) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    hasher.update(voice_id.as_bytes());
    hasher.update(settings.model_id.as_bytes());
    hasher.update(&settings.stability.to_le_bytes());
    hasher.update(&settings.similarity_boost.to_le_bytes());
    hasher.update(&settings.speed.to_le_bytes());
    format!("{:x}", hasher.finalize())
}
```

**Cache Invalidation Rules**:
- Voice changes → all cache entries for old voice invalidated
- Speed changes → all cache entries with different speed invalidated
- Text changes → specific text_hash entries invalidated (automatic via key mismatch)

---

### PlaybackState (In-Memory Only)

Represents the current TTS playback status.

**NOT persisted to database** - reconstructed on app start

**Frontend Type** (TypeScript):
```typescript
type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface TtsState {
  playbackState: PlaybackState;
  currentText: string | null;
  error: string | null;
  currentDocumentId: string | null;
  currentPageNumber: number | null;
}
```

**Backend Type** (Rust):
```rust
pub struct TtsState {
    pub is_playing: bool,
    pub is_paused: bool,
    pub current_text: Option<String>,
    pub current_voice_id: Option<String>,
    pub progress: f32,  // 0.0 to 1.0
}
```

**State Transitions**:
```
idle → loading (on speak())
loading → playing (on audio start event)
loading → error (on initialization failure)
playing → paused (on pause())
paused → playing (on resume())
playing → idle (on completion/stop)
paused → idle (on stop)
error → idle (on clearError())
ANY → idle (on page navigation)  ← FIX NEEDED
```

---

### RenderSettings

Represents PDF rendering configuration.

**Table**: `settings` (SQLite, key-value store)

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `render.qualityMode` | TEXT | `"balanced"` | `performance` \| `balanced` \| `ultra` |
| `render.maxMegapixels` | INTEGER | 24 | Range: 8-48 |
| `render.hwAccelerationEnabled` | BOOLEAN | true | Platform-specific |
| `render.debugOverlayEnabled` | BOOLEAN | false | Shows diagnostics |

**Frontend Type** (TypeScript):
```typescript
interface RenderSettings {
  qualityMode: 'performance' | 'balanced' | 'ultra';
  maxMegapixels: number;
  hwAccelerationEnabled: boolean;
  debugOverlayEnabled: boolean;
}
```

---

## Entity Relationships

```
┌─────────────┐
│  Document   │
└──────┬──────┘
       │
       │ 1:N
       ├────────────┐
       │            │
       ▼            ▼
┌──────────────┐  ┌─────────────────┐
│  Highlight   │  │  CachedAudio    │
└──────────────┘  │  (NEW)          │
                  └─────────────────┘
```

---

## Migration Required

### Migration V3: Enhance TTS Cache Metadata Table

```sql
-- Migration: 003_enhance_tts_cache_metadata.sql
-- The table already exists, add missing LRU and integrity columns

ALTER TABLE tts_cache_metadata ADD COLUMN IF NOT EXISTS model_id TEXT;
ALTER TABLE tts_cache_metadata ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE tts_cache_metadata ADD COLUMN IF NOT EXISTS access_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tts_cache_metadata ADD COLUMN IF NOT EXISTS word_timings_json TEXT;
ALTER TABLE tts_cache_metadata ADD COLUMN IF NOT EXISTS total_duration_ms INTEGER;
ALTER TABLE tts_cache_metadata ADD COLUMN IF NOT EXISTS is_valid BOOLEAN NOT NULL DEFAULT 1;

-- Update existing rows to have valid last_accessed_at if null
UPDATE tts_cache_metadata SET last_accessed_at = created_at WHERE last_accessed_at IS NULL;

-- Add indexes for LRU eviction queries
CREATE INDEX IF NOT EXISTS idx_tts_cache_last_accessed
    ON tts_cache_metadata(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tts_cache_size
    ON tts_cache_metadata(size_bytes);
CREATE INDEX IF NOT EXISTS idx_tts_cache_valid
    ON tts_cache_metadata(is_valid) WHERE is_valid = 1;
CREATE INDEX IF NOT EXISTS idx_tts_cache_document
    ON tts_cache_metadata(document_id);
CREATE INDEX IF NOT EXISTS idx_tts_cache_voice
    ON tts_cache_metadata(voice_id);
```

---

## Validation Schemas (Zod)

### Highlight Schema
```typescript
const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const HighlightSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string(),
  pageNumber: z.number().int().min(1),
  rects: z.array(RectSchema).min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  textContent: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
});
```

### Render Settings Schema
```typescript
const RenderSettingsSchema = z.object({
  qualityMode: z.enum(['performance', 'balanced', 'ultra']).default('balanced'),
  maxMegapixels: z.number().min(8).max(48).default(24),
  hwAccelerationEnabled: z.boolean().default(true),
  debugOverlayEnabled: z.boolean().default(false),
});
```

---

## Notes

- **Coordinate System**: All highlight rects stored in PDF coordinate space (scale=1.0). Frontend applies current viewport scale during rendering.
- **Cache Directory**: TTS audio cached in platform app cache directory (`dirs::cache_dir()`), separate from app data.
- **Playback State**: Not persisted - always starts as `idle` on app launch. TTS chunk position (which page/position) IS persisted in Document.
