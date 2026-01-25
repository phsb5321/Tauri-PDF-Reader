import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AiVoiceInfo, AiTtsState as BackendTtsState } from '../lib/tauri-invoke';

export type AiTtsPlaybackState = 'idle' | 'playing' | 'paused' | 'loading' | 'error';

/**
 * Valid state transitions for TTS playback (T025)
 *
 * State machine ensures predictable UI behavior and prevents invalid states.
 * Format: fromState -> [validNextStates]
 */
const VALID_TRANSITIONS: Record<AiTtsPlaybackState, AiTtsPlaybackState[]> = {
  idle: ['loading', 'error'],           // Can start loading or enter error
  loading: ['playing', 'idle', 'error'], // Can start playing, cancel, or error
  playing: ['paused', 'idle', 'error'],  // Can pause, stop, or error
  paused: ['playing', 'idle', 'error'],  // Can resume, stop, or error
  error: ['idle', 'loading'],            // Can reset to idle or retry
};

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

  // Playback settings (T033)
  autoPageEnabled: boolean;

  // Actions
  setApiKey: (key: string | null) => void;
  setInitialized: (initialized: boolean, error?: string) => void;
  setVoices: (voices: AiVoiceInfo[]) => void;
  setSelectedVoice: (voiceId: string | null) => void;
  setSpeed: (speed: number) => void;
  setAutoPageEnabled: (enabled: boolean) => void;
  setPlaybackState: (state: AiTtsPlaybackState) => void;
  /** Transition to next state with validation (T026) */
  transitionTo: (nextState: AiTtsPlaybackState, force?: boolean) => boolean;
  setCurrentText: (text: string | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
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
  autoPageEnabled: true, // T033: Default to enabled for multi-page TTS
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

      setAutoPageEnabled: (enabled) => set({ autoPageEnabled: enabled }),

      setPlaybackState: (state) => {
        // Direct state set - for backward compatibility and event-driven updates
        // Prefer transitionTo() for validated state changes
        const currentState = get().playbackState;
        console.debug('[AiTtsStore] setPlaybackState:', currentState, '->', state);
        // Debug: Log stack trace when transitioning from playing to idle
        if (currentState === 'playing' && state === 'idle') {
          console.debug('[AiTtsStore] playing->idle stack:', new Error().stack);
        }
        set({ playbackState: state });
      },

      /** Transition to next state with validation (T026) */
      transitionTo: (nextState, force = false) => {
        const currentState = get().playbackState;
        const validNextStates = VALID_TRANSITIONS[currentState];

        if (!force && !validNextStates.includes(nextState)) {
          console.warn(
            `[AiTtsStore] Invalid state transition: ${currentState} -> ${nextState}. ` +
            `Valid transitions: ${validNextStates.join(', ')}`
          );
          return false;
        }

        console.debug('[AiTtsStore] transitionTo:', currentState, '->', nextState, force ? '(forced)' : '');
        set({ playbackState: nextState });
        return true;
      },

      setCurrentText: (text) => set({ currentText: text }),

      setError: (error) =>
        set({
          error,
          playbackState: error ? 'error' : get().playbackState,
        }),

      clearError: () =>
        set({
          error: null,
          playbackState: 'idle',
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
        autoPageEnabled: state.autoPageEnabled,
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
