import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AiVoiceInfo, AiTtsState as BackendTtsState } from '../lib/tauri-invoke';

export type AiTtsPlaybackState = 'idle' | 'playing' | 'paused' | 'loading' | 'error';

interface AiTtsState {
  // Initialization
  initialized: boolean;
  apiKey: string | null;
  initError: string | null;

  // Playback state
  playbackState: AiTtsPlaybackState;
  currentText: string | null;
  error: string | null;

  // Voice settings
  voices: AiVoiceInfo[];
  selectedVoiceId: string | null;
  speed: number;

  // Actions
  setApiKey: (key: string | null) => void;
  setInitialized: (initialized: boolean, error?: string) => void;
  setVoices: (voices: AiVoiceInfo[]) => void;
  setSelectedVoice: (voiceId: string | null) => void;
  setSpeed: (speed: number) => void;
  setPlaybackState: (state: AiTtsPlaybackState) => void;
  setCurrentText: (text: string | null) => void;
  setError: (error: string | null) => void;
  updateFromBackend: (state: BackendTtsState) => void;
  reset: () => void;
}

const DEFAULT_SPEED = 1.0;
const MIN_SPEED = 0.5;
const MAX_SPEED = 2.0;

// Default ElevenLabs voice (Rachel - good for narration)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

const initialState = {
  initialized: false,
  apiKey: null as string | null,
  initError: null as string | null,
  playbackState: 'idle' as AiTtsPlaybackState,
  currentText: null as string | null,
  error: null as string | null,
  voices: [] as AiVoiceInfo[],
  selectedVoiceId: DEFAULT_VOICE_ID,
  speed: DEFAULT_SPEED,
};

export const useAiTtsStore = create<AiTtsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setApiKey: (key) => set({ apiKey: key }),

      setInitialized: (initialized, error) =>
        set({
          initialized,
          initError: error ?? null,
          playbackState: initialized ? 'idle' : 'error',
        }),

      setVoices: (voices) => {
        const { selectedVoiceId } = get();
        // If current voice isn't in the list, select the first one
        const voiceExists = voices.some((v) => v.id === selectedVoiceId);
        set({
          voices,
          selectedVoiceId: voiceExists ? selectedVoiceId : voices[0]?.id ?? null,
        });
      },

      setSelectedVoice: (voiceId) => set({ selectedVoiceId: voiceId }),

      setSpeed: (speed) => {
        const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
        set({ speed: clampedSpeed });
      },

      setPlaybackState: (state) => set({ playbackState: state }),

      setCurrentText: (text) => set({ currentText: text }),

      setError: (error) =>
        set({
          error,
          playbackState: error ? 'error' : get().playbackState,
        }),

      updateFromBackend: (backendState) => {
        set({
          initialized: backendState.initialized,
          playbackState: backendState.isPlaying
            ? 'playing'
            : backendState.isPaused
              ? 'paused'
              : 'idle',
          selectedVoiceId: backendState.currentVoiceId ?? get().selectedVoiceId,
        });
      },

      reset: () =>
        set({
          ...initialState,
          // Preserve API key and voice selection across resets
          apiKey: get().apiKey,
          selectedVoiceId: get().selectedVoiceId,
        }),
    }),
    {
      name: 'ai-tts-storage',
      partialize: (state) => ({
        // Only persist these fields
        apiKey: state.apiKey,
        selectedVoiceId: state.selectedVoiceId,
        speed: state.speed,
      }),
    }
  )
);

// Derived selectors
export const selectIsPlaying = (state: AiTtsState) => state.playbackState === 'playing';
export const selectIsPaused = (state: AiTtsState) => state.playbackState === 'paused';
export const selectIsLoading = (state: AiTtsState) => state.playbackState === 'loading';
export const selectCanPlay = (state: AiTtsState) => state.initialized && !state.error;
export const selectNeedsApiKey = (state: AiTtsState) => !state.apiKey;
export const selectSelectedVoice = (state: AiTtsState) =>
  state.voices.find((v) => v.id === state.selectedVoiceId) ?? null;
