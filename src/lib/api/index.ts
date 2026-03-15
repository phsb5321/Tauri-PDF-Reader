/**
 * Tauri API
 *
 * Re-exports all Tauri command wrappers organized by domain.
 */

// Library API
export {
  libraryAddDocument,
  libraryGetDocument,
  libraryGetDocumentByPath,
  libraryListDocuments,
  libraryUpdateProgress,
  libraryUpdateDocument,
  libraryUpdateTitle,
  libraryRelocateDocument,
  libraryRemoveDocument,
  libraryOpenDocument,
  libraryCheckFileExists,
} from "./library";

// Highlights API
export {
  highlightsCreate,
  highlightsBatchCreate,
  highlightsGet,
  highlightsListForDocument,
  highlightsListForPage,
  highlightsUpdate,
  highlightsDelete,
  highlightsDeleteForDocument,
  highlightsExport,
  type CreateHighlightInput,
} from "./highlights";

// TTS API
export {
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
  onTtsChunkStarted,
  onTtsChunkCompleted,
  onTtsCompleted,
  type TtsChunkStartedEvent,
  type TtsChunkCompletedEvent,
  type TtsCompletedEvent,
} from "./tts";

// AI TTS API
export {
  aiTtsInit,
  aiTtsListVoices,
  aiTtsSpeak,
  aiTtsSpeakWithTimestamps,
  aiTtsStop,
  aiTtsPause,
  aiTtsResume,
  aiTtsSetVoice,
  aiTtsSetSpeed,
  aiTtsGetState,
  aiTtsGetConfig,
  // Cache management
  aiTtsCacheInfo,
  aiTtsCacheClear,
  aiTtsCacheInvalidateVoice,
  // Pre-buffering
  aiTtsPrebuffer,
  // Event listeners
  onAiTtsStarted,
  onAiTtsCompleted,
  onAiTtsStopped,
  onAiTtsPaused,
  onAiTtsResumed,
  onAiTtsError,
  // Types
  type AiVoiceInfo,
  type AiTtsConfig,
  type AiTtsState,
  type AiTtsCacheInfo,
  type AiTtsCacheClearResult,
  type AiTtsPrebufferResponse,
  type AiTtsStartedEvent,
  type AiTtsCompletedEvent,
  type AiTtsErrorEvent,
  type WordTiming,
  type SpeakWithTimestampsResponse,
} from "./ai-tts";

// Settings API
export {
  settingsGet,
  settingsSet,
  settingsGetAll,
  settingsDelete,
  settingsSetBatch,
  type SettingResponse,
  type SettingsMap,
} from "./settings";

// Audio Cache API
export {
  audioCacheGetCoverage,
  audioCacheClearDocument,
  audioCacheGetStats,
  audioCacheSetLimit,
  audioCacheGetLimit,
  audioCacheEvict,
  audioCacheNotifyCoverage,
  onCoverageUpdated,
  type CoverageResponse,
  type CacheStatsResponse,
  type EvictionResponse,
  type ClearDocumentResponse,
  type CoverageUpdatedEvent,
} from "./audio-cache";

// Sessions API (T066-T068)
export {
  sessionCreate,
  sessionGet,
  sessionList,
  sessionUpdate,
  sessionDelete,
  sessionRestore,
  sessionAddDocument,
  sessionRemoveDocument,
  sessionUpdateDocument,
  sessionTouch,
} from "./sessions";

// Audio Export API (T085-T086)
export {
  audioExportCheckReady,
  audioExportDocument,
  audioExportCancel,
} from "./audio-export";
