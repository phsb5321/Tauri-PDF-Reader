# Research: Reading Session Manager with Audio Cache & Progress Persistence

**Feature Branch**: `006-reading-session-audio-cache`
**Created**: 2026-01-25

## Executive Summary

This research documents findings from codebase exploration and external research for implementing the Reading Session Manager with Audio Cache & Progress Persistence feature. All technical decisions have been validated against the existing architecture.

---

## 1. Existing TTS Data Flow Analysis

### Current Architecture

The TTS system follows this flow:

```
PDF Document
    ↓
pdf.js getTextContent() → text extraction
    ↓
Frontend text chunking (src/domain/tts/text-chunking.ts)
    ↓
aiTtsSpeakWithTimestamps(text, voiceId) → Tauri IPC
    ↓
AiTtsEngine (src-tauri/src/ai_tts/mod.rs)
    ↓
AudioCacheAdapter check (src-tauri/src/adapters/audio_cache.rs)
    ↓ cache miss
ElevenLabsClient.text_to_speech_with_timestamps()
    ↓
AudioCacheAdapter.set_with_timestamps() → disk storage
    ↓
AudioPlayer.play_mp3() via rodio
    ↓
ai-tts:playback-starting event → frontend word highlight sync
```

### Key Files Identified

| Component         | File Path                               | Purpose                           |
| ----------------- | --------------------------------------- | --------------------------------- |
| Text Extraction   | `src/services/pdf-service.ts`           | PDF.js page text extraction       |
| Text Chunking     | `src/domain/tts/text-chunking.ts`       | Sentence-based chunking algorithm |
| AI TTS Store      | `src/stores/ai-tts-store.ts`            | Zustand state machine for TTS     |
| TTS Commands      | `src-tauri/src/commands/ai_tts.rs`      | Tauri command handlers            |
| TTS Engine        | `src-tauri/src/ai_tts/mod.rs`           | Core TTS orchestration            |
| ElevenLabs Client | `src-tauri/src/ai_tts/elevenlabs.rs`    | API integration                   |
| Audio Cache       | `src-tauri/src/adapters/audio_cache.rs` | File-based caching                |
| Audio Player      | `src-tauri/src/ai_tts/player.rs`        | Rodio-based playback              |

### Existing Cache Implementation

**Current caching** (file-based, no metadata tracking):

- Location: `{app_cache_dir}/tts_cache/`
- Files: `{cache_key}.mp3` + `{cache_key}.json` (word timings)
- Key generation: `SHA256(text + voice_id + model_id + settings_hash)`
- No SQLite metadata tracking
- No per-document coverage tracking
- No LRU eviction

**Decision**: Enhance existing `AudioCacheAdapter` rather than replace it. Add SQLite metadata table for tracking coverage and enabling LRU eviction.

---

## 2. Database Schema Analysis

### Existing Tables

| Table                | Purpose                            | Relationships               |
| -------------------- | ---------------------------------- | --------------------------- |
| `documents`          | PDF metadata, reading position     | PK: id (content hash)       |
| `highlights`         | Text selections                    | FK: document_id → documents |
| `settings`           | Key-value user preferences         | None                        |
| `tts_cache_metadata` | Cache tracking (exists but unused) | FK: document_id → documents |
| `_migrations`        | Schema versioning                  | None                        |

### Existing tts_cache_metadata Schema

The table already exists in migrations but is **not actively used**:

```sql
CREATE TABLE IF NOT EXISTS tts_cache_metadata (
    cache_key TEXT PRIMARY KEY,
    document_id TEXT,
    page_number INTEGER,
    text_hash TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    settings_hash TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    last_accessed_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
```

**Decision**: Leverage existing table with enhancements for chunk tracking, duration, and coverage calculation.

---

## 3. Text Chunking Analysis

### Chunk ID Determinism

**Finding**: Chunk IDs are **fully deterministic**.

- Format: `chunk-{pageNumber}-{chunkIndex}`
- Algorithm: Sentence-based with merging (max 500 chars, min 20 chars)
- Same input text always produces same chunks

**Implications for caching**:

- Can use `chunk.id + voiceId + modelId` as stable cache key
- Chunk boundaries are reproducible across sessions
- Per-chunk caching enables granular coverage tracking

### Chunking Algorithm Parameters

```typescript
const MAX_CHUNK_LENGTH = 500; // characters
const MIN_CHUNK_LENGTH = 20; // characters
const WORDS_PER_MINUTE = 150; // for duration estimation
```

**Decision**: Store chunk metadata alongside audio cache for coverage calculation.

---

## 4. State Management Patterns

### AI TTS State Machine

The existing state machine in `ai-tts-store.ts` follows strict transition rules:

```typescript
const VALID_TRANSITIONS = {
  idle: ["loading", "error"],
  loading: ["playing", "idle", "error"],
  playing: ["paused", "idle", "error"],
  paused: ["playing", "idle", "error"],
  error: ["idle", "loading"],
};
```

**Decision**: Extend existing store with cache coverage state rather than creating new store.

### Persistence Patterns

- **Settings**: Dual-layer (localStorage + SQLite backend)
- **Document progress**: Debounced auto-save with emergency localStorage fallback
- **Highlights**: Optimistic updates with retry queue

**Decision**: Reading sessions will use SQLite persistence like documents/highlights, not localStorage.

---

## 5. Audio Concatenation Research

### Rust Libraries Evaluated

| Library                                             | Purpose                  | Suitability                              |
| --------------------------------------------------- | ------------------------ | ---------------------------------------- |
| [rodio](https://github.com/RustAudio/rodio)         | Playback + concatenation | Already in use, supports source chaining |
| [symphonia](https://github.com/pdeljanov/Symphonia) | MP3 decoding             | Used via rodio, pure Rust                |
| [hound](https://lib.rs/crates/hound)                | WAV read/write           | Useful for intermediate format           |
| [id3](https://lib.rs/crates/id3)                    | ID3v2 tag writing        | Required for chapter markers             |

**Decision**: Use rodio for concatenation (decode → concat samples → encode). Use `id3` crate for chapter markers.

### Chapter Marker Format

ID3v2 CHAP frames support:

- Chapter start/end times in milliseconds
- Embedded TIT2 (title) sub-frames
- Compatible with VLC, Apple Music, podcast apps

**Decision**: Embed ID3v2 CHAP frames for chapter navigation. One chapter per PDF page.

---

## 6. Cache Storage Strategy

### Research Findings

SQLite vs Filesystem for audio caching:

- [SQLite benchmarks](https://sqlite.org/fasterthanfs.html) show 35% faster for small BLOBs (<100KB)
- Audio chunks are typically 50KB-500KB (30 seconds to 5 minutes of speech)
- Filesystem preferred for larger files to avoid database bloat

**Decision**: Hybrid approach (matches existing pattern):

- **SQLite**: Metadata tracking (cache keys, durations, coverage)
- **Filesystem**: Actual MP3 files in `{app_cache_dir}/tts_cache/`

### LRU Eviction Strategy

```
When cache size > limit:
  1. Query metadata ordered by last_accessed_at ASC
  2. Delete oldest entries until under limit
  3. Cascade delete filesystem files
  4. Update cache statistics
```

**Decision**: Implement LRU eviction in `AudioCacheAdapter` with configurable limit (default 5GB).

---

## 7. Tauri Command Patterns

### Command Registration Pattern

All commands must be registered in `src-tauri/src/lib.rs`:

1. Add to `collect_commands!` macro for type generation
2. Add to `generate_handler!` macro for runtime registration

### New Commands Required

```rust
// Audio Cache Management
audio_cache_get_coverage(document_id) → CoverageStats
audio_cache_prebuffer_page(document_id, page_number) → PrebufferResult
audio_cache_clear_document(document_id) → ()
audio_cache_get_size() → CacheInfo

// Audio Export
audio_export_document(document_id, format, output_path) → ExportResult
audio_export_check_ready(document_id) → ExportReadiness

// Reading Sessions
session_create(name, document_ids) → Session
session_list() → Vec<Session>
session_get(session_id) → Session
session_update(session_id, updates) → Session
session_delete(session_id) → ()
session_restore(session_id) → SessionState
```

---

## 8. Frontend Integration Points

### UI Components Required

| Component            | Location                         | Purpose                         |
| -------------------- | -------------------------------- | ------------------------------- |
| `AudioCacheProgress` | `src/components/audio-progress/` | Visual cache coverage indicator |
| `SessionMenu`        | `src/components/session-menu/`   | Sidebar session manager         |
| `AudioExportDialog`  | `src/components/export-dialog/`  | Export options UI               |
| `CacheSettings`      | Existing settings panel          | Cache size limit configuration  |

### Store Extensions

```typescript
// Extend ai-tts-store.ts
interface AiTtsState {
  // ... existing state
  cacheCoverage: Map<string, CoverageStats>; // document_id → coverage
  setCacheCoverage: (documentId: string, coverage: CoverageStats) => void;
}

// New session-store.ts
interface SessionState {
  sessions: ReadingSession[];
  activeSessionId: string | null;
  createSession: (name: string, documentIds: string[]) => Promise<Session>;
  restoreSession: (sessionId: string) => Promise<void>;
}
```

---

## 9. Technical Decisions Summary

| Decision            | Choice                                      | Rationale                                        |
| ------------------- | ------------------------------------------- | ------------------------------------------------ |
| Cache storage       | Hybrid (SQLite metadata + filesystem audio) | Matches existing pattern, optimal for file sizes |
| Chunk tracking      | Per-chunk metadata in SQLite                | Enables accurate coverage calculation            |
| Export format       | MP3 with ID3v2 chapters                     | Broad compatibility, `id3` crate available       |
| Session persistence | SQLite tables                               | Consistent with documents/highlights             |
| LRU eviction        | `last_accessed_at` ordering                 | Standard pattern, simple to implement            |
| State management    | Extend existing stores                      | Avoid store proliferation                        |
| Cache key           | `chunk_id + voice_id + model_id`            | Deterministic, deduplication-friendly            |

---

## 10. Risk Assessment

### Technical Risks

| Risk                                      | Mitigation                                               |
| ----------------------------------------- | -------------------------------------------------------- |
| Audio concatenation quality (gaps/clicks) | Use sample-level concatenation, validate with test cases |
| Export performance for large documents    | Stream processing, progress events                       |
| Cache corruption                          | Validation on read, automatic re-fetch on failure        |
| Chunk determinism breaks                  | Hash-based fallback if chunk IDs change                  |

### Integration Risks

| Risk                         | Mitigation                                               |
| ---------------------------- | -------------------------------------------------------- |
| State machine complexity     | Extend existing AI TTS state machine patterns            |
| Migration for existing users | Cache metadata table already exists, backward compatible |
| Performance impact           | Async operations, debounced updates                      |

---

## Sources

- [Rodio - Rust Audio Playback](https://github.com/RustAudio/rodio)
- [Symphonia - Pure Rust Multimedia](https://github.com/pdeljanov/Symphonia)
- [ID3v2 Chapter Frame Specification](https://id3.org/id3v2-chapters-1.0)
- [ID3 Rust Crate](https://lib.rs/crates/id3)
- [SQLite 35% Faster Than Filesystem](https://sqlite.org/fasterthanfs.html)
