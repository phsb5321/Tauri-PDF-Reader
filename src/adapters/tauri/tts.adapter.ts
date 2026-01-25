/**
 * TauriTtsAdapter
 *
 * Tauri adapter for native TTS using the tts crate.
 * Implements TtsPort interface for the hexagonal architecture.
 */

import {
  ttsInit,
  ttsListVoices,
  ttsSpeak,
  ttsSpeakLong,
  ttsStop,
  ttsPause,
  ttsResume,
  ttsSetVoice,
  ttsSetRate,
  ttsGetState,
  ttsCheckCapabilities,
} from '../../lib/api/tts';
import type {
  TtsPort,
  TtsInitResponse,
  VoiceInfo,
  TtsState,
  TtsCapabilities,
  TtsChunk,
} from '../../ports/tts.port';

export class TauriTtsAdapter implements TtsPort {
  async init(): Promise<TtsInitResponse> {
    const result = await ttsInit();
    return {
      available: result.available,
      backend: result.backend ?? null,
      defaultVoice: result.defaultVoice ?? null,
      error: result.error ?? null,
    };
  }

  async listVoices(): Promise<VoiceInfo[]> {
    const result = await ttsListVoices();
    return result.voices.map((v) => ({
      id: v.id,
      name: v.name,
      language: v.language ?? null,
    }));
  }

  async speak(text: string, _chunkId?: string): Promise<void> {
    await ttsSpeak(text, false);
  }

  async speakLong(chunks: TtsChunk[]): Promise<void> {
    const text = chunks.map((c) => c.text).join(' ');
    await ttsSpeakLong(text, false);
  }

  async stop(): Promise<void> {
    await ttsStop();
  }

  async pause(): Promise<void> {
    await ttsPause();
  }

  async resume(): Promise<void> {
    await ttsResume();
  }

  async setVoice(voiceId: string): Promise<void> {
    await ttsSetVoice(voiceId);
  }

  async setRate(rate: number): Promise<void> {
    await ttsSetRate(rate);
  }

  async getState(): Promise<TtsState> {
    const state = await ttsGetState();
    // The Tauri API returns currentVoice as a string (voice ID), but
    // the port expects VoiceInfo. Map string to VoiceInfo structure.
    const currentVoice = state.currentVoice
      ? {
          id: String(state.currentVoice),
          name: String(state.currentVoice),
          language: null,
        }
      : null;

    return {
      initialized: state.initialized,
      isSpeaking: state.isSpeaking,
      isPaused: state.isPaused,
      currentChunkId: state.currentChunkId ?? null,
      currentVoice,
      rate: state.rate,
    };
  }

  async checkCapabilities(): Promise<TtsCapabilities> {
    const caps = await ttsCheckCapabilities();
    return {
      supportsUtterance: true,
      supportsRate: caps.supportsRate,
      supportsPitch: caps.supportsPitch,
      supportsVolume: caps.supportsVolume,
    };
  }
}
