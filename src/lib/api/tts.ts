/**
 * TTS API
 *
 * Tauri commands for native text-to-speech.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { VoiceInfo, TtsInitResponse, TtsState } from '../schemas';

// Commands

export async function ttsInit(): Promise<TtsInitResponse> {
  return invoke('tts_init');
}

export async function ttsListVoices(): Promise<{ voices: VoiceInfo[] }> {
  return invoke('tts_list_voices');
}

export async function ttsSpeak(
  text: string,
  interrupt = false
): Promise<{ chunkId: string }> {
  return invoke('tts_speak', { text, interrupt });
}

export async function ttsSpeakLong(
  text: string,
  interrupt = false
): Promise<{ totalChunks: number }> {
  return invoke('tts_speak_long', { text, interrupt });
}

export async function ttsStop(): Promise<{ success: boolean }> {
  return invoke('tts_stop');
}

export async function ttsPause(): Promise<{ success: boolean; supported: boolean }> {
  return invoke('tts_pause');
}

export async function ttsResume(): Promise<{ success: boolean }> {
  return invoke('tts_resume');
}

export async function ttsSetVoice(
  voiceId: string
): Promise<{ success: boolean; voice: VoiceInfo }> {
  return invoke('tts_set_voice', { voiceId });
}

export async function ttsSetRate(rate: number): Promise<{ success: boolean; rate: number }> {
  return invoke('tts_set_rate', { rate });
}

export async function ttsGetState(): Promise<TtsState> {
  return invoke('tts_get_state');
}

export async function ttsCheckCapabilities(): Promise<{
  supportsPause: boolean;
  supportsResume: boolean;
  supportsPitch: boolean;
  supportsVolume: boolean;
  supportsRate: boolean;
  minRate: number;
  maxRate: number;
}> {
  return invoke('tts_check_capabilities');
}

// Event Types

export interface TtsChunkStartedEvent {
  chunkIndex: number;
  totalChunks: number;
  text: string;
}

export interface TtsChunkCompletedEvent {
  chunkIndex: number;
}

export interface TtsCompletedEvent {
  success: boolean;
}

// Event Listeners

export function onTtsChunkStarted(
  callback: (event: TtsChunkStartedEvent) => void
): Promise<UnlistenFn> {
  return listen<TtsChunkStartedEvent>('tts:chunk-started', (event) =>
    callback(event.payload)
  );
}

export function onTtsChunkCompleted(
  callback: (event: TtsChunkCompletedEvent) => void
): Promise<UnlistenFn> {
  return listen<TtsChunkCompletedEvent>('tts:chunk-completed', (event) =>
    callback(event.payload)
  );
}

export function onTtsCompleted(
  callback: (event: TtsCompletedEvent) => void
): Promise<UnlistenFn> {
  return listen<TtsCompletedEvent>('tts:completed', (event) => callback(event.payload));
}
