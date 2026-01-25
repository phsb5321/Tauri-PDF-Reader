/**
 * TtsPort
 *
 * Text-to-speech engine operations.
 * Implemented by: TauriNativeTtsAdapter, TauriAiTtsAdapter, MockTtsAdapter
 */

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

export interface TtsInitResponse {
  available: boolean;
  backend: string | null;
  defaultVoice: string | null;
  error: string | null;
}

export interface TtsCapabilities {
  supportsUtterance: boolean;
  supportsRate: boolean;
  supportsPitch: boolean;
  supportsVolume: boolean;
}

export interface TtsChunk {
  id: string;
  text: string;
}

export interface TtsPort {
  /**
   * Initialize the TTS engine
   */
  init(): Promise<TtsInitResponse>;

  /**
   * List available voices
   */
  listVoices(): Promise<VoiceInfo[]>;

  /**
   * Speak a single text chunk
   */
  speak(text: string, chunkId?: string): Promise<void>;

  /**
   * Speak multiple chunks sequentially (for long content)
   */
  speakLong(chunks: TtsChunk[]): Promise<void>;

  /**
   * Stop all speech
   */
  stop(): Promise<void>;

  /**
   * Pause current speech
   */
  pause(): Promise<void>;

  /**
   * Resume paused speech
   */
  resume(): Promise<void>;

  /**
   * Set the active voice
   */
  setVoice(voiceId: string): Promise<void>;

  /**
   * Set playback rate (0.5 - 3.0)
   */
  setRate(rate: number): Promise<void>;

  /**
   * Get current TTS state
   */
  getState(): Promise<TtsState>;

  /**
   * Check engine capabilities
   */
  checkCapabilities(): Promise<TtsCapabilities>;
}
