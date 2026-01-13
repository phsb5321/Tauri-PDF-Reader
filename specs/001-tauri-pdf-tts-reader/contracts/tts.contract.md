# API Contract: TTS Service

**Feature Branch**: `001-tauri-pdf-tts-reader`
**Date**: 2026-01-11

## Overview

The TTS (Text-to-Speech) Service provides native text-to-speech functionality using platform-specific voices and controls.

---

## Commands

### `tts_init`

Initialize the TTS engine. Must be called before other TTS commands.

**Input**: None

**Output**:
```typescript
interface TtsInitResponse {
  available: boolean;
  backend: string;         // 'WinRT' | 'AVFoundation' | 'SpeechDispatcher'
  defaultVoice: string | null;
  error: string | null;    // If available is false
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `TTS_UNAVAILABLE` | No TTS backend available on system |
| `INIT_FAILED` | Failed to initialize TTS engine |

**Behavior**:
- Initializes platform-specific TTS backend
- Returns availability status and backend info
- Safe to call multiple times (idempotent)

---

### `tts_list_voices`

Get all available system voices.

**Input**: None

**Output**:
```typescript
interface VoiceInfo {
  id: string;              // Platform-specific voice identifier
  name: string;            // Human-readable name
  language: string | null; // Language code (e.g., 'en-US')
}

interface ListVoicesResponse {
  voices: VoiceInfo[];
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `NOT_INITIALIZED` | TTS not initialized |

---

### `tts_speak`

Speak text aloud.

**Input**:
```typescript
interface TtsSpeakInput {
  text: string;          // Text to speak (max 10,000 chars)
  interrupt?: boolean;   // Stop current speech first (default: false)
}
```

**Output**:
```typescript
interface SpeakResponse {
  chunkId: string;       // Identifier for this speech chunk
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `NOT_INITIALIZED` | TTS not initialized |
| `TEXT_TOO_LONG` | Text exceeds 10,000 characters |
| `SPEAK_FAILED` | Platform TTS error |

**Behavior**:
- If `interrupt` is true, stops current speech before starting
- If `interrupt` is false and speech is active, queues text
- Returns chunk ID for tracking progress

---

### `tts_speak_long`

Speak long text with automatic chunking and progress events.

**Input**:
```typescript
interface TtsSpeakLongInput {
  text: string;          // Text to speak (no limit)
  interrupt?: boolean;   // Stop current speech first
}
```

**Output**:
```typescript
interface SpeakLongResponse {
  totalChunks: number;
}
```

**Events Emitted**:
```typescript
// Event: tts:chunk-started
interface ChunkStartedEvent {
  chunkIndex: number;
  totalChunks: number;
  text: string;
}

// Event: tts:chunk-completed
interface ChunkCompletedEvent {
  chunkIndex: number;
}

// Event: tts:completed
interface CompletedEvent {
  success: boolean;
}
```

**Behavior**:
- Splits text into sentence-based chunks (max 5,000 chars each)
- Emits events for frontend progress tracking
- Can be stopped mid-playback

---

### `tts_stop`

Stop current speech immediately.

**Input**: None

**Output**:
```typescript
interface StopResponse {
  success: boolean;
}
```

---

### `tts_pause`

Pause current speech.

**Input**: None

**Output**:
```typescript
interface PauseResponse {
  success: boolean;
  supported: boolean;    // False if platform doesn't support pause
}
```

**Behavior**:
- On platforms without pause support, acts as stop
- Returns `supported: false` if pause fell back to stop

---

### `tts_resume`

Resume paused speech.

**Input**: None

**Output**:
```typescript
interface ResumeResponse {
  success: boolean;
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `NOT_PAUSED` | No speech is currently paused |

---

### `tts_set_voice`

Set the voice for speech.

**Input**:
```typescript
interface SetVoiceInput {
  voiceId: string;       // Voice ID from tts_list_voices
}
```

**Output**:
```typescript
interface SetVoiceResponse {
  success: boolean;
  voice: VoiceInfo;
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `VOICE_NOT_FOUND` | Voice ID not available |
| `SET_VOICE_FAILED` | Failed to set voice |

---

### `tts_set_rate`

Set speech rate.

**Input**:
```typescript
interface SetRateInput {
  rate: number;          // 0.5 to 3.0 (1.0 is normal)
}
```

**Output**:
```typescript
interface SetRateResponse {
  success: boolean;
  rate: number;
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `INVALID_RATE` | Rate outside 0.5-3.0 range |

**Behavior**:
- Can be changed during active speech
- Change takes effect immediately

---

### `tts_get_state`

Get current TTS state.

**Input**: None

**Output**:
```typescript
interface TtsState {
  initialized: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  currentChunkId: string | null;
  currentVoice: VoiceInfo | null;
  rate: number;
}
```

---

### `tts_check_capabilities`

Check platform-specific TTS capabilities.

**Input**: None

**Output**:
```typescript
interface TtsCapabilities {
  supportsPause: boolean;
  supportsResume: boolean;
  supportsPitch: boolean;
  supportsVolume: boolean;
  supportsRate: boolean;
  minRate: number;
  maxRate: number;
}
```

---

## Frontend Integration

```typescript
// src/lib/tauri-invoke.ts

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface VoiceInfo {
  id: string;
  name: string;
  language: string | null;
}

export interface TtsState {
  initialized: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  currentChunkId: string | null;
  currentVoice: VoiceInfo | null;
  rate: number;
}

export async function ttsInit(): Promise<{ available: boolean; error?: string }> {
  return invoke('tts_init');
}

export async function ttsListVoices(): Promise<VoiceInfo[]> {
  const response = await invoke<{ voices: VoiceInfo[] }>('tts_list_voices');
  return response.voices;
}

export async function ttsSpeak(text: string, interrupt = false): Promise<string> {
  const response = await invoke<{ chunkId: string }>('tts_speak', {
    text,
    interrupt,
  });
  return response.chunkId;
}

export async function ttsSpeakLong(text: string, interrupt = false): Promise<number> {
  const response = await invoke<{ totalChunks: number }>('tts_speak_long', {
    text,
    interrupt,
  });
  return response.totalChunks;
}

export async function ttsStop(): Promise<void> {
  await invoke('tts_stop');
}

export async function ttsPause(): Promise<{ supported: boolean }> {
  return invoke('tts_pause');
}

export async function ttsResume(): Promise<void> {
  await invoke('tts_resume');
}

export async function ttsSetVoice(voiceId: string): Promise<VoiceInfo> {
  const response = await invoke<{ voice: VoiceInfo }>('tts_set_voice', { voiceId });
  return response.voice;
}

export async function ttsSetRate(rate: number): Promise<void> {
  await invoke('tts_set_rate', { rate });
}

export async function ttsGetState(): Promise<TtsState> {
  return invoke('tts_get_state');
}

// Event listeners
export function onTtsChunkStarted(
  callback: (event: { chunkIndex: number; totalChunks: number; text: string }) => void
) {
  return listen('tts:chunk-started', (event) => callback(event.payload as any));
}

export function onTtsCompleted(callback: () => void) {
  return listen('tts:completed', () => callback());
}
```

---

## Rust Command Signatures

```rust
// src-tauri/src/commands/tts.rs

use tauri::State;
use crate::tts::TtsState;

#[tauri::command]
#[cfg(feature = "native-tts")]
pub async fn tts_init(
    state: State<'_, TtsState>,
) -> Result<TtsInitResponse, String>;

#[tauri::command]
#[cfg(feature = "native-tts")]
pub async fn tts_list_voices(
    state: State<'_, TtsState>,
) -> Result<ListVoicesResponse, String>;

#[tauri::command]
#[cfg(feature = "native-tts")]
pub async fn tts_speak(
    state: State<'_, TtsState>,
    text: String,
    interrupt: Option<bool>,
) -> Result<SpeakResponse, String>;

#[tauri::command]
#[cfg(feature = "native-tts")]
pub async fn tts_speak_long(
    app: tauri::AppHandle,
    state: State<'_, TtsState>,
    text: String,
    interrupt: Option<bool>,
) -> Result<SpeakLongResponse, String>;

#[tauri::command]
#[cfg(feature = "native-tts")]
pub async fn tts_stop(
    state: State<'_, TtsState>,
) -> Result<StopResponse, String>;

#[tauri::command]
#[cfg(feature = "native-tts")]
pub async fn tts_pause(
    state: State<'_, TtsState>,
) -> Result<PauseResponse, String>;

#[tauri::command]
#[cfg(feature = "native-tts")]
pub async fn tts_resume(
    state: State<'_, TtsState>,
) -> Result<ResumeResponse, String>;

#[tauri::command]
#[cfg(feature = "native-tts")]
pub async fn tts_set_voice(
    state: State<'_, TtsState>,
    voice_id: String,
) -> Result<SetVoiceResponse, String>;

#[tauri::command]
#[cfg(feature = "native-tts")]
pub async fn tts_set_rate(
    state: State<'_, TtsState>,
    rate: f64,
) -> Result<SetRateResponse, String>;

#[tauri::command]
#[cfg(feature = "native-tts")]
pub async fn tts_get_state(
    state: State<'_, TtsState>,
) -> Result<TtsStateResponse, String>;

#[tauri::command]
#[cfg(feature = "native-tts")]
pub async fn tts_check_capabilities() -> Result<TtsCapabilities, String>;
```

---

## TTS State Management

```rust
// src-tauri/src/tts/engine.rs

use std::sync::Mutex;
use tts::Tts;

pub struct TtsState {
    pub engine: Mutex<Option<Tts>>,
    pub is_speaking: Mutex<bool>,
    pub is_paused: Mutex<bool>,
    pub current_chunk_id: Mutex<Option<String>>,
    pub current_voice_id: Mutex<Option<String>>,
    pub rate: Mutex<f64>,
}

impl TtsState {
    pub fn new() -> Self {
        Self {
            engine: Mutex::new(None),
            is_speaking: Mutex::new(false),
            is_paused: Mutex::new(false),
            current_chunk_id: Mutex::new(None),
            current_voice_id: Mutex::new(None),
            rate: Mutex::new(1.0),
        }
    }
}
```

---

## Platform Notes

### Windows (WinRT)
- Full support for all commands
- Rate range: 0.5 - 3.0
- Pause/resume fully supported

### macOS (AVFoundation)
- Full support for all commands
- Some voices require download
- Check voice availability before use

### Linux (speech-dispatcher)
- Requires `speech-dispatcher` package installed
- Pause may not be supported (falls back to stop)
- Limited voice selection
- Check `tts_check_capabilities` for supported features
