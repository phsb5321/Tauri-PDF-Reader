import type {
  TtsCapabilities,
  TtsChunk,
  TtsInitResponse,
  TtsPort,
  TtsState,
  VoiceInfo,
} from '../../ports/tts.port';

/**
 * Mock implementation of TtsPort for testing.
 * Simulates TTS functionality without actual audio.
 */
export class MockTtsAdapter implements TtsPort {
  private state: TtsState = {
    initialized: false,
    isSpeaking: false,
    isPaused: false,
    currentChunkId: null,
    currentVoice: null,
    rate: 1.0,
  };

  private voices: VoiceInfo[] = [
    { id: 'voice-1', name: 'Test Voice 1', language: 'en-US' },
    { id: 'voice-2', name: 'Test Voice 2', language: 'en-GB' },
  ];

  async init(): Promise<TtsInitResponse> {
    this.state.initialized = true;
    this.state.currentVoice = this.voices[0];
    return {
      available: true,
      backend: 'mock',
      defaultVoice: 'voice-1',
      error: null,
    };
  }

  async listVoices(): Promise<VoiceInfo[]> {
    return [...this.voices];
  }

  async speak(text: string, chunkId?: string): Promise<void> {
    if (!this.state.initialized) {
      throw new Error('TTS not initialized');
    }
    this.state.isSpeaking = true;
    this.state.currentChunkId = chunkId ?? null;
    // In a real mock, you might want to simulate completion after a delay
    console.log(`[MockTTS] Speaking: ${text.substring(0, 50)}...`);
  }

  async speakLong(chunks: TtsChunk[]): Promise<void> {
    for (const chunk of chunks) {
      await this.speak(chunk.text, chunk.id);
    }
  }

  async stop(): Promise<void> {
    this.state.isSpeaking = false;
    this.state.isPaused = false;
    this.state.currentChunkId = null;
  }

  async pause(): Promise<void> {
    if (this.state.isSpeaking) {
      this.state.isPaused = true;
      this.state.isSpeaking = false;
    }
  }

  async resume(): Promise<void> {
    if (this.state.isPaused) {
      this.state.isPaused = false;
      this.state.isSpeaking = true;
    }
  }

  async setVoice(voiceId: string): Promise<void> {
    const voice = this.voices.find((v) => v.id === voiceId);
    if (!voice) {
      throw new Error(`Voice not found: ${voiceId}`);
    }
    this.state.currentVoice = voice;
  }

  async setRate(rate: number): Promise<void> {
    if (rate < 0.5 || rate > 3.0) {
      throw new Error(`Rate must be between 0.5 and 3.0, got ${rate}`);
    }
    this.state.rate = rate;
  }

  async getState(): Promise<TtsState> {
    return { ...this.state };
  }

  async checkCapabilities(): Promise<TtsCapabilities> {
    return {
      supportsUtterance: true,
      supportsRate: true,
      supportsPitch: false,
      supportsVolume: false,
    };
  }

  // Test helpers
  reset(): void {
    this.state = {
      initialized: false,
      isSpeaking: false,
      isPaused: false,
      currentChunkId: null,
      currentVoice: null,
      rate: 1.0,
    };
  }

  simulateSpeechEnd(): void {
    this.state.isSpeaking = false;
    this.state.currentChunkId = null;
  }
}
