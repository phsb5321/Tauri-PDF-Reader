/**
 * AI TTS API
 *
 * Tauri commands for AI-powered text-to-speech (ElevenLabs).
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Types

export interface AiVoiceInfo {
  id: string;
  name: string;
  provider: 'elevenlabs';
  previewUrl: string | null;
  labels: Record<string, string> | null;
}

export interface AiTtsConfig {
  provider: 'elevenlabs';
  apiKey: string | null;
  voiceId: string | null;
  modelId: string | null;
  stability: number;
  similarityBoost: number;
  speed: number;
}

export interface AiTtsState {
  initialized: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentVoiceId: string | null;
}

/**
 * Word timing information for karaoke-style highlighting
 */
export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  charStart: number;
  charEnd: number;
}

/**
 * Response from speak with timestamps
 */
export interface SpeakWithTimestampsResponse {
  success: boolean;
  wordTimings: WordTiming[];
  totalDuration: number;
}

// Commands

export async function aiTtsInit(apiKey: string): Promise<{ success: boolean; voicesCount: number }> {
  return invoke('ai_tts_init', { apiKey });
}

export async function aiTtsListVoices(): Promise<{ voices: AiVoiceInfo[] }> {
  return invoke('ai_tts_list_voices');
}

export async function aiTtsSpeak(
  text: string,
  voiceId?: string
): Promise<{ success: boolean }> {
  return invoke('ai_tts_speak', { text, voiceId });
}

/**
 * Speak text with word-level timestamps for karaoke highlighting
 *
 * Returns word timings that can be used to highlight text in sync with audio playback
 */
export async function aiTtsSpeakWithTimestamps(
  text: string,
  voiceId?: string
): Promise<SpeakWithTimestampsResponse> {
  return invoke('ai_tts_speak_with_timestamps', { text, voiceId });
}

export async function aiTtsStop(): Promise<{ success: boolean }> {
  return invoke('ai_tts_stop');
}

export async function aiTtsPause(): Promise<{ success: boolean }> {
  return invoke('ai_tts_pause');
}

export async function aiTtsResume(): Promise<{ success: boolean }> {
  return invoke('ai_tts_resume');
}

export async function aiTtsSetVoice(voiceId: string): Promise<{ success: boolean }> {
  return invoke('ai_tts_set_voice', { voiceId });
}

export async function aiTtsSetSpeed(speed: number): Promise<{ success: boolean }> {
  return invoke('ai_tts_set_speed', { speed });
}

export async function aiTtsGetState(): Promise<AiTtsState> {
  return invoke('ai_tts_get_state');
}

export async function aiTtsGetConfig(): Promise<AiTtsConfig> {
  return invoke('ai_tts_get_config');
}

// Cache Types

export interface AiTtsCacheInfo {
  totalSizeBytes: number;
  entryCount: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}

export interface AiTtsCacheClearResult {
  success: boolean;
  bytesCleared: number;
  entriesRemoved: number;
}

/**
 * Response from prebuffer command
 */
export interface AiTtsPrebufferResponse {
  success: boolean;
  cached: boolean;
  wordCount: number;
  totalDuration: number;
}

// Cache Commands

/**
 * Get TTS audio cache statistics
 */
export async function aiTtsCacheInfo(): Promise<AiTtsCacheInfo> {
  return invoke('ai_tts_cache_info');
}

/**
 * Clear all cached TTS audio
 */
export async function aiTtsCacheClear(): Promise<AiTtsCacheClearResult> {
  return invoke('ai_tts_cache_clear');
}

/**
 * Invalidate cached audio for a specific voice
 */
export async function aiTtsCacheInvalidateVoice(voiceId: string): Promise<AiTtsCacheClearResult> {
  return invoke('ai_tts_cache_invalidate_voice', { voiceId });
}

// Pre-buffering Commands

/**
 * Pre-generate and cache TTS audio without playing
 * 
 * Call this when a PDF page loads to ensure instant playback when user clicks play.
 * The audio is fetched from ElevenLabs (if not already cached) and saved to disk cache.
 */
export async function aiTtsPrebuffer(
  text: string,
  voiceId?: string
): Promise<AiTtsPrebufferResponse> {
  return invoke('ai_tts_prebuffer', { text, voiceId });
}

// Event Types

export interface AiTtsStartedEvent {
  text: string;
  voiceId: string;
}

export interface AiTtsCompletedEvent {
  success: boolean;
}

export interface AiTtsErrorEvent {
  error: string;
}

// Event Listeners

export function onAiTtsStarted(
  callback: (event: AiTtsStartedEvent) => void
): Promise<UnlistenFn> {
  return listen<AiTtsStartedEvent>('ai-tts:started', (event) => callback(event.payload));
}

export function onAiTtsCompleted(
  callback: (event: AiTtsCompletedEvent) => void
): Promise<UnlistenFn> {
  return listen<AiTtsCompletedEvent>('ai-tts:completed', (event) => callback(event.payload));
}

export function onAiTtsStopped(callback: () => void): Promise<UnlistenFn> {
  return listen('ai-tts:stopped', () => callback());
}

export function onAiTtsPaused(callback: () => void): Promise<UnlistenFn> {
  return listen('ai-tts:paused', () => callback());
}

export function onAiTtsResumed(callback: () => void): Promise<UnlistenFn> {
  return listen('ai-tts:resumed', () => callback());
}

export function onAiTtsError(
  callback: (event: AiTtsErrorEvent) => void
): Promise<UnlistenFn> {
  return listen<AiTtsErrorEvent>('ai-tts:error', (event) => callback(event.payload));
}

/**
 * Event emitted right before audio playback begins.
 * Frontend should use this to sync the highlight timer.
 */
export interface AiTtsPlaybackStartingEvent {
  duration: number;
}

/**
 * Listen for playback starting event - emitted right before audio plays.
 * This is the correct time to start the highlight timer for accurate sync.
 */
export function onAiTtsPlaybackStarting(
  callback: (event: AiTtsPlaybackStartingEvent) => void
): Promise<UnlistenFn> {
  return listen<AiTtsPlaybackStartingEvent>('ai-tts:playback-starting', (event) => callback(event.payload));
}
