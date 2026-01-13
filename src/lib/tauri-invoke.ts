import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  Document,
  Highlight,
  VoiceInfo,
  Rect,
  TtsInitResponse,
  TtsState,
  ListHighlightsResponse,
  DeleteResponse,
  ExportResponse,
  FileExistsResponse,
} from './schemas';

// ============================================================================
// Library Commands
// ============================================================================

export async function libraryAddDocument(
  filePath: string,
  title?: string,
  pageCount?: number
): Promise<Document> {
  return invoke('library_add_document', { filePath, title, pageCount });
}

export async function libraryGetDocument(id: string): Promise<Document | null> {
  return invoke('library_get_document', { id });
}

export async function libraryGetDocumentByPath(filePath: string): Promise<Document | null> {
  return invoke('library_get_document_by_path', { filePath });
}

export async function libraryListDocuments(
  orderBy: 'last_opened' | 'created' | 'title' = 'last_opened',
  limit?: number,
  offset?: number
): Promise<Document[]> {
  return invoke('library_list_documents', { orderBy, limit, offset });
}

export async function libraryUpdateProgress(
  id: string,
  currentPage: number,
  scrollPosition?: number,
  lastTtsChunkId?: string
): Promise<Document> {
  return invoke('library_update_progress', {
    id,
    currentPage,
    scrollPosition,
    lastTtsChunkId,
  });
}

export async function libraryUpdateDocument(
  id: string,
  updates: { title?: string; pageCount?: number; fileHash?: string }
): Promise<void> {
  return invoke('library_update_document', { id, ...updates });
}

export async function libraryUpdateTitle(id: string, title: string): Promise<Document> {
  return invoke('library_update_title', { id, title });
}

export async function libraryRelocateDocument(
  id: string,
  newFilePath: string
): Promise<Document> {
  return invoke('library_relocate_document', { id, newFilePath });
}

export async function libraryRemoveDocument(id: string): Promise<void> {
  return invoke('library_remove_document', { id });
}

export async function libraryOpenDocument(id: string): Promise<Document> {
  return invoke('library_open_document', { id });
}

export async function libraryCheckFileExists(id: string): Promise<FileExistsResponse> {
  return invoke('library_check_file_exists', { id });
}

// ============================================================================
// Highlight Commands
// ============================================================================

export interface CreateHighlightInput {
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent?: string;
}

export async function highlightsCreate(input: CreateHighlightInput): Promise<Highlight> {
  return invoke('highlights_create', { ...input });
}

export async function highlightsBatchCreate(
  highlights: CreateHighlightInput[]
): Promise<{ highlights: Highlight[]; created: number }> {
  return invoke('highlights_batch_create', { highlights });
}

export async function highlightsGet(id: string): Promise<Highlight> {
  return invoke('highlights_get', { id });
}

export async function highlightsListForDocument(
  documentId: string
): Promise<ListHighlightsResponse> {
  return invoke('highlights_list_for_document', { documentId });
}

export async function highlightsListForPage(
  documentId: string,
  pageNumber: number
): Promise<ListHighlightsResponse> {
  return invoke('highlights_list_for_page', { documentId, pageNumber });
}

export async function highlightsUpdate(
  id: string,
  updates: { color?: string; note?: string | null }
): Promise<Highlight> {
  return invoke('highlights_update', { id, ...updates });
}

export async function highlightsDelete(id: string): Promise<DeleteResponse> {
  return invoke('highlights_delete', { id });
}

export async function highlightsDeleteForDocument(
  documentId: string
): Promise<DeleteResponse> {
  return invoke('highlights_delete_for_document', { documentId });
}

export async function highlightsExport(
  documentId: string,
  format: 'markdown' | 'json'
): Promise<ExportResponse> {
  return invoke('highlights_export', { documentId, format });
}

// ============================================================================
// TTS Commands
// ============================================================================

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

// ============================================================================
// TTS Event Listeners
// ============================================================================

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

// ============================================================================
// AI TTS Commands (ElevenLabs)
// ============================================================================

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

// AI TTS Event Listeners

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

export function onAiTtsError(
  callback: (event: AiTtsErrorEvent) => void
): Promise<UnlistenFn> {
  return listen<AiTtsErrorEvent>('ai-tts:error', (event) => callback(event.payload));
}

// ============================================================================
// Settings Commands
// ============================================================================

export interface SettingResponse {
  key: string;
  value: unknown;
}

export interface SettingsMap {
  settings: Record<string, unknown>;
}

export async function settingsGet(key: string): Promise<SettingResponse> {
  return invoke('settings_get', { key });
}

export async function settingsSet(key: string, value: unknown): Promise<SettingResponse> {
  return invoke('settings_set', { key, value });
}

export async function settingsGetAll(): Promise<SettingsMap> {
  return invoke('settings_get_all');
}

export async function settingsDelete(key: string): Promise<boolean> {
  return invoke('settings_delete', { key });
}

export async function settingsSetBatch(
  settings: Record<string, unknown>
): Promise<SettingsMap> {
  return invoke('settings_set_batch', { settings });
}
