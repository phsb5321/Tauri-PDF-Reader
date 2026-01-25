# Tauri Command Contracts: Stabilization Fixes

**Branch**: `005-stabilization-fixes` | **Date**: 2026-01-14

## Overview

This fix sprint modifies existing Tauri commands rather than creating new ones. This document specifies the behavioral changes and new events.

---

## Track A: Highlights

### Existing Commands (No Changes Required)

| Command | Status | Notes |
|---------|--------|-------|
| `highlights_create` | ✓ Working | Creates highlight with validated data |
| `highlights_list_for_page` | ✓ Working | Returns highlights for specific page |
| `highlights_list_for_document` | ✓ Working | Returns all highlights for document |
| `highlights_update` | ✓ Working | Updates color, note, text_content |
| `highlights_delete` | ✓ Working | Removes highlight by ID |
| `highlights_batch_create` | ✓ Working | Bulk creation for efficiency |

**Frontend Gap**: No orchestration calling these commands from text selection.

---

## Track C: TTS Playback

### Modified Commands

#### `ai_tts_pause`

**Current Behavior**:
```rust
#[tauri::command]
pub async fn ai_tts_pause(state: State<'_, AiTtsEngineState>) -> Result<StopResponse, String>
```
- Calls `engine.pause()`
- Returns success/failure

**Required Behavior**:
```rust
#[tauri::command]
pub async fn ai_tts_pause(
    app: AppHandle,  // ADD
    state: State<'_, AiTtsEngineState>
) -> Result<StopResponse, String>
```
- Calls `engine.pause()`
- **Emits** `ai-tts:paused` event
- Updates backend `TtsState.is_paused = true, is_playing = false`
- Returns success/failure

#### `ai_tts_resume`

**Current Behavior**:
- Calls `engine.resume()`
- Returns success/failure

**Required Behavior**:
- Calls `engine.resume()`
- **Emits** `ai-tts:resumed` event
- Updates backend `TtsState.is_paused = false, is_playing = true`
- Returns success/failure

#### `ai_tts_stop`

**Current Behavior**:
- Calls `engine.stop()`
- Returns success/failure

**Required Behavior** (if not already):
- Calls `engine.stop()`
- **Emits** `ai-tts:stopped` event (verify this exists)
- Updates backend `TtsState.is_playing = false, is_paused = false`
- Returns success/failure

### New Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `ai-tts:paused` | `{}` (empty) | When `ai_tts_pause` succeeds |
| `ai-tts:resumed` | `{}` (empty) | When `ai_tts_resume` succeeds |

### Existing Events (Verify Working)

| Event | Payload | Trigger |
|-------|---------|---------|
| `ai-tts:started` | `{ text: string }` | When audio playback begins |
| `ai-tts:completed` | `{}` | When audio finishes normally |
| `ai-tts:stopped` | `{}` | When user stops playback |
| `ai-tts:error` | `{ error: string }` | On any TTS error |

---

## Track D: TTS Audio Cache

### New Commands

#### `ai_tts_cache_info`

**Purpose**: Get cache statistics for settings UI

**Signature**:
```rust
#[tauri::command]
pub async fn ai_tts_cache_info() -> Result<CacheInfo, String>
```

**Response**:
```typescript
interface CacheInfo {
  totalSizeBytes: number;
  entryCount: number;
  oldestEntry: string | null;  // RFC3339 timestamp
  newestEntry: string | null;  // RFC3339 timestamp
}
```

#### `ai_tts_cache_clear`

**Purpose**: Clear all cached audio files

**Signature**:
```rust
#[tauri::command]
pub async fn ai_tts_cache_clear() -> Result<ClearResult, String>
```

**Response**:
```typescript
interface ClearResult {
  success: boolean;
  bytesCleared: number;
  entriesRemoved: number;
}
```

#### `ai_tts_cache_invalidate_voice`

**Purpose**: Clear cache entries for a specific voice (when user changes voice)

**Signature**:
```rust
#[tauri::command]
pub async fn ai_tts_cache_invalidate_voice(voice_id: String) -> Result<ClearResult, String>
```

#### `ai_tts_cache_validate`

**Purpose**: Validate cache integrity and report/repair corrupted entries

**Signature**:
```rust
#[tauri::command]
pub async fn ai_tts_cache_validate() -> Result<ValidationReport, String>
```

**Response**:
```typescript
interface ValidationReport {
  validEntries: number;       // Entries with matching content hash
  corruptedEntries: number;   // Entries with hash mismatch (marked invalid)
  orphanedFiles: number;      // Files without DB entry
  orphanedSizeBytes: number;  // Size of orphaned files
}
```

#### `ai_tts_cache_get_with_timings`

**Purpose**: Retrieve cached audio with word timing data

**Signature**:
```rust
#[tauri::command]
pub async fn ai_tts_cache_get_with_timings(
    cache_key: String
) -> Result<Option<CachedAudioWithTimings>, String>
```

**Response**:
```typescript
interface CachedAudioWithTimings {
  audioPath: string;              // Path to MP3 file
  wordTimings: WordTiming[];      // Array of timing data
  totalDurationMs: number;        // Total duration in ms
  lastAccessedAt: string;         // RFC3339 timestamp
}

interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  charStart: number;
  charEnd: number;
}
```

---

## Track B: Render Settings

### Modified Command

#### `update_render_settings`

**Current Behavior**:
- Saves settings to SQLite
- Returns success/failure

**Required Behavior**:
- Saves settings to SQLite
- If `hwAccelerationEnabled` changed:
  - Write flag file to `{app_data_dir}/.hw_accel_disabled` (or remove it)
  - Return `requiresRestart: true` in response

**Response**:
```typescript
interface UpdateRenderSettingsResponse {
  success: boolean;
  requiresRestart: boolean;  // ADD: true if HW accel changed
}
```

---

## Frontend Event Listeners

### Current Listeners (in useAiTts.ts)

```typescript
onAiTtsStarted((event) => { /* ... */ });
onAiTtsCompleted((event) => { /* ... */ });
onAiTtsStopped((event) => { /* ... */ });
onAiTtsError((event) => { /* ... */ });
```

### Required Listeners (ADD)

```typescript
// In useAiTts.ts setup
const unsub5 = await listen('ai-tts:paused', () => {
  if (mounted) store.setPlaybackState('paused');
});

const unsub6 = await listen('ai-tts:resumed', () => {
  if (mounted) store.setPlaybackState('playing');
});
```

---

## Error Codes

### Highlight Errors
| Code | Message | Cause |
|------|---------|-------|
| `EMPTY_RECTS` | "Highlight must have at least one rectangle" | Empty rects array |
| `INVALID_COLOR` | "Invalid color format" | Color not #RRGGBB |
| `INVALID_PAGE` | "Page number must be >= 1" | page_number < 1 |
| `DOCUMENT_NOT_FOUND` | "Document not found" | Invalid document_id |

### TTS Errors
| Code | Message | Cause |
|------|---------|-------|
| `NOT_INITIALIZED` | "TTS engine not initialized" | Called before init |
| `INVALID_API_KEY` | "Invalid ElevenLabs API key" | Auth failure |
| `VOICE_NOT_FOUND` | "Voice not found" | Invalid voice_id |
| `AUDIO_PLAYBACK_ERROR` | "Failed to play audio" | rodio error |
| `NETWORK_ERROR` | "Failed to reach ElevenLabs API" | Connection issue |

---

## State Synchronization Contract

### Invariant
The frontend `playbackState` MUST match the backend `TtsState` at all times (within event propagation delay).

### Synchronization Points

| Action | Frontend State | Backend State | Event |
|--------|----------------|---------------|-------|
| User clicks Play | `loading` | - | - |
| Audio starts | `playing` | `is_playing=true` | `ai-tts:started` |
| User clicks Pause | `paused` | `is_paused=true` | `ai-tts:paused` |
| User clicks Resume | `playing` | `is_playing=true` | `ai-tts:resumed` |
| User clicks Stop | `idle` | both false | `ai-tts:stopped` |
| Audio completes | `idle` | both false | `ai-tts:completed` |
| Error occurs | `error` | both false | `ai-tts:error` |
| User changes page | `idle` | both false | (frontend calls stop) |

---

## Notes

- All commands use `Result<T, String>` return type (consistent with existing pattern)
- Events emitted via `app.emit(event_name, payload)`
- Frontend listens via `@tauri-apps/api/event::listen()`
- State logging should include timestamp and transition details for debugging
