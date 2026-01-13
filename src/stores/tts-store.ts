import { create } from 'zustand';
import type { VoiceInfo, TtsInitResponse } from '../lib/schemas';

export type TtsPlaybackState = 'idle' | 'playing' | 'paused' | 'loading';

interface TextChunk {
  id: string;
  text: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
}

interface TtsState {
  // Initialization
  initialized: boolean;
  available: boolean;
  backend: string | null;
  initError: string | null;

  // Playback state
  playbackState: TtsPlaybackState;
  currentChunkId: string | null;
  currentChunkIndex: number;

  // Chunks queue
  chunks: TextChunk[];

  // Voice settings
  voices: VoiceInfo[];
  currentVoice: VoiceInfo | null;
  rate: number;

  // Follow-along mode
  followAlong: boolean;

  // Actions
  setInitialized: (response: TtsInitResponse) => void;
  setVoices: (voices: VoiceInfo[]) => void;
  setCurrentVoice: (voice: VoiceInfo | null) => void;
  setRate: (rate: number) => void;
  setPlaybackState: (state: TtsPlaybackState) => void;
  setCurrentChunk: (chunkId: string | null, index?: number) => void;
  setChunks: (chunks: TextChunk[]) => void;
  addChunk: (chunk: TextChunk) => void;
  clearChunks: () => void;
  setFollowAlong: (enabled: boolean) => void;
  nextChunk: () => TextChunk | null;
  previousChunk: () => TextChunk | null;
  getCurrentChunk: () => TextChunk | null;
  reset: () => void;
}

const DEFAULT_RATE = 1.0;
const MIN_RATE = 0.5;
const MAX_RATE = 3.0;

const initialState = {
  initialized: false,
  available: false,
  backend: null as string | null,
  initError: null as string | null,
  playbackState: 'idle' as TtsPlaybackState,
  currentChunkId: null as string | null,
  currentChunkIndex: -1,
  chunks: [] as TextChunk[],
  voices: [] as VoiceInfo[],
  currentVoice: null as VoiceInfo | null,
  rate: DEFAULT_RATE,
  followAlong: true,
};

export const useTtsStore = create<TtsState>((set, get) => ({
  ...initialState,

  setInitialized: (response) => {
    set({
      initialized: true,
      available: response.available,
      backend: response.backend,
      initError: response.error,
    });
  },

  setVoices: (voices) => set({ voices }),

  setCurrentVoice: (voice) => set({ currentVoice: voice }),

  setRate: (rate) => {
    const clampedRate = Math.max(MIN_RATE, Math.min(MAX_RATE, rate));
    set({ rate: clampedRate });
  },

  setPlaybackState: (state) => set({ playbackState: state }),

  setCurrentChunk: (chunkId, index) => {
    if (index !== undefined) {
      set({ currentChunkId: chunkId, currentChunkIndex: index });
    } else if (chunkId) {
      const { chunks } = get();
      const foundIndex = chunks.findIndex((c) => c.id === chunkId);
      set({ currentChunkId: chunkId, currentChunkIndex: foundIndex });
    } else {
      set({ currentChunkId: null, currentChunkIndex: -1 });
    }
  },

  setChunks: (chunks) => set({ chunks, currentChunkIndex: -1, currentChunkId: null }),

  addChunk: (chunk) => {
    const { chunks } = get();
    set({ chunks: [...chunks, chunk] });
  },

  clearChunks: () => set({ chunks: [], currentChunkIndex: -1, currentChunkId: null }),

  setFollowAlong: (enabled) => set({ followAlong: enabled }),

  nextChunk: () => {
    const { chunks, currentChunkIndex } = get();
    const nextIndex = currentChunkIndex + 1;
    if (nextIndex < chunks.length) {
      const nextChunk = chunks[nextIndex];
      set({ currentChunkIndex: nextIndex, currentChunkId: nextChunk.id });
      return nextChunk;
    }
    return null;
  },

  previousChunk: () => {
    const { chunks, currentChunkIndex } = get();
    const prevIndex = currentChunkIndex - 1;
    if (prevIndex >= 0) {
      const prevChunk = chunks[prevIndex];
      set({ currentChunkIndex: prevIndex, currentChunkId: prevChunk.id });
      return prevChunk;
    }
    return null;
  },

  getCurrentChunk: () => {
    const { chunks, currentChunkIndex } = get();
    if (currentChunkIndex >= 0 && currentChunkIndex < chunks.length) {
      return chunks[currentChunkIndex];
    }
    return null;
  },

  reset: () => set(initialState),
}));

// Derived selectors
export const selectIsPlaying = (state: TtsState) => state.playbackState === 'playing';
export const selectIsPaused = (state: TtsState) => state.playbackState === 'paused';
export const selectIsLoading = (state: TtsState) => state.playbackState === 'loading';
export const selectCanPlay = (state: TtsState) => state.initialized && state.available;
