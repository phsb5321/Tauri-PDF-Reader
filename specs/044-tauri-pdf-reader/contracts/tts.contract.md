# Contract: TTS Commands

**Feature**: 044-tauri-pdf-reader | **Date**: 2026-01-11 | **Phase**: 1

## Overview

Tauri IPC commands for text-to-speech functionality using the Rust `tts` crate.

---

## Commands

### `tts_init`

Initialize the TTS engine. Must be called before any other TTS commands.

**Invoke**:
```typescript
await invoke('tts_init');
```

**Request**: None

**Response**:
```typescript
type Response = null;  // Success
```

**Errors**:
| Code | Description |
|------|-------------|
| `TTS_NOT_AVAILABLE` | TTS engine not available on this system |
| `TTS_INIT_FAILED` | Failed to initialize TTS engine |

---

### `tts_speak`

Speak the provided text. Queues utterance (does not interrupt current speech).

**Invoke**:
```typescript
await invoke('tts_speak', { text: 'Hello world' });
```

**Request**:
```typescript
interface TtsSpeakRequest {
  text: string;       // Text to speak (max 10,000 characters)
  interrupt?: boolean; // If true, stop current speech first (default: false)
}
```

**Response**:
```typescript
type Response = null;  // Success (speech started/queued)
```

**Errors**:
| Code | Description |
|------|-------------|
| `TTS_NOT_INITIALIZED` | Call `tts_init` first |
| `TTS_TEXT_TOO_LONG` | Text exceeds 10,000 character limit |
| `TTS_SPEAK_FAILED` | Failed to start speech |

---

### `tts_stop`

Stop any current speech immediately.

**Invoke**:
```typescript
await invoke('tts_stop');
```

**Request**: None

**Response**:
```typescript
type Response = null;  // Success
```

---

### `tts_pause`

Pause current speech (if supported by platform).

**Invoke**:
```typescript
await invoke('tts_pause');
```

**Request**: None

**Response**:
```typescript
type Response = null;  // Success
```

**Notes**: Not all platforms support pause. May behave as stop on some systems.

---

### `tts_resume`

Resume paused speech.

**Invoke**:
```typescript
await invoke('tts_resume');
```

**Request**: None

**Response**:
```typescript
type Response = null;  // Success
```

---

### `tts_set_rate`

Set the speech rate.

**Invoke**:
```typescript
await invoke('tts_set_rate', { rate: 1.5 });
```

**Request**:
```typescript
interface TtsSetRateRequest {
  rate: number;  // 0.5 (slow) to 2.0 (fast), 1.0 = normal
}
```

**Response**:
```typescript
type Response = null;  // Success
```

**Errors**:
| Code | Description |
|------|-------------|
| `TTS_INVALID_RATE` | Rate must be between 0.5 and 2.0 |

---

### `tts_set_voice`

Set the TTS voice by ID.

**Invoke**:
```typescript
await invoke('tts_set_voice', { voiceId: 'com.apple.voice.compact.en-US.Samantha' });
```

**Request**:
```typescript
interface TtsSetVoiceRequest {
  voiceId: string;  // Voice ID from tts_list_voices
}
```

**Response**:
```typescript
type Response = null;  // Success
```

**Errors**:
| Code | Description |
|------|-------------|
| `TTS_VOICE_NOT_FOUND` | Voice ID not available |

---

### `tts_list_voices`

Get list of available TTS voices.

**Invoke**:
```typescript
const voices = await invoke<VoiceInfo[]>('tts_list_voices');
```

**Request**: None

**Response**:
```typescript
interface VoiceInfo {
  id: string;        // Unique voice identifier
  name: string;      // Human-readable name
  language?: string; // Language code (e.g., "en-US")
}

type Response = VoiceInfo[];
```

---

### `tts_is_speaking`

Check if TTS is currently speaking.

**Invoke**:
```typescript
const speaking = await invoke<boolean>('tts_is_speaking');
```

**Request**: None

**Response**:
```typescript
type Response = boolean;
```

---

### `tts_check_available`

Check if TTS is available on this system (for pre-flight check).

**Invoke**:
```typescript
const available = await invoke<TtsAvailability>('tts_check_available');
```

**Request**: None

**Response**:
```typescript
interface TtsAvailability {
  available: boolean;
  backend: string | null;  // e.g., "AVFoundation", "WinRT", "SpeechDispatcher"
  error: string | null;    // Error message if not available
}
```

---

## TypeScript Client

```typescript
// src/services/tts-service.ts
import { invoke } from '@tauri-apps/api/core';

export interface VoiceInfo {
  id: string;
  name: string;
  language?: string;
}

export interface TtsAvailability {
  available: boolean;
  backend: string | null;
  error: string | null;
}

class TtsService {
  private initialized = false;

  async init(): Promise<void> {
    await invoke('tts_init');
    this.initialized = true;
  }

  async checkAvailable(): Promise<TtsAvailability> {
    return await invoke('tts_check_available');
  }

  async speak(text: string, interrupt = false): Promise<void> {
    if (!this.initialized) await this.init();
    await invoke('tts_speak', { text, interrupt });
  }

  async stop(): Promise<void> {
    await invoke('tts_stop');
  }

  async pause(): Promise<void> {
    await invoke('tts_pause');
  }

  async resume(): Promise<void> {
    await invoke('tts_resume');
  }

  async setRate(rate: number): Promise<void> {
    await invoke('tts_set_rate', { rate });
  }

  async setVoice(voiceId: string): Promise<void> {
    await invoke('tts_set_voice', { voiceId });
  }

  async listVoices(): Promise<VoiceInfo[]> {
    return await invoke('tts_list_voices');
  }

  async isSpeaking(): Promise<boolean> {
    return await invoke('tts_is_speaking');
  }
}

export const ttsService = new TtsService();
```

---

## Rust Implementation Reference

See `research.md` for implementation details. Key types:

```rust
// src-tauri/src/commands/tts.rs

#[derive(serde::Serialize)]
pub struct VoiceInfo {
    pub id: String,
    pub name: String,
    pub language: Option<String>,
}

#[derive(serde::Serialize)]
pub struct TtsAvailability {
    pub available: bool,
    pub backend: Option<String>,
    pub error: Option<String>,
}
```
