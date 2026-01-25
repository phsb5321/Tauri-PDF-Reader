/**
 * TTS Word Highlight Store
 *
 * Manages state for karaoke-style word highlighting during TTS playback.
 * Tracks word timings, current playback position, and active word index.
 */

import { create } from 'zustand';
import type { WordTiming } from '../lib/api/ai-tts';

export interface TtsHighlightState {
  // Word timing data from ElevenLabs
  wordTimings: WordTiming[];
  totalDuration: number;

  // Playback tracking
  isActive: boolean;
  isPaused: boolean;
  currentWordIndex: number;
  playbackStartTime: number | null; // performance.now() when playback started
  pausedAtTime: number | null; // elapsed time when paused

  // Text being spoken (for matching)
  currentText: string | null;
  pageNumber: number | null;

  // Actions
  startHighlighting: (
    text: string,
    wordTimings: WordTiming[],
    totalDuration: number,
    pageNumber: number
  ) => void;
  stopHighlighting: () => void;
  pauseHighlighting: () => void;
  resumeHighlighting: () => void;
  updateCurrentWord: (index: number) => void;
  setPlaybackStartTime: (time: number) => void;
  reset: () => void;
}

const initialState = {
  wordTimings: [] as WordTiming[],
  totalDuration: 0,
  isActive: false,
  isPaused: false,
  currentWordIndex: -1,
  playbackStartTime: null as number | null,
  pausedAtTime: null as number | null,
  currentText: null as string | null,
  pageNumber: null as number | null,
};

export const useTtsHighlightStore = create<TtsHighlightState>((set, get) => ({
  ...initialState,

  startHighlighting: (text, wordTimings, totalDuration, pageNumber) => {
    console.debug('[TtsHighlightStore] Starting highlighting', {
      wordCount: wordTimings.length,
      duration: totalDuration,
      pageNumber,
    });
    set({
      wordTimings,
      totalDuration,
      currentText: text,
      pageNumber,
      isActive: true,
      isPaused: false,
      currentWordIndex: 0, // Start at 0 instead of -1
      playbackStartTime: performance.now(),
      pausedAtTime: null,
    });
  },

  stopHighlighting: () => {
    console.debug('[TtsHighlightStore] Stopping highlighting');
    set({
      isActive: false,
      isPaused: false,
      currentWordIndex: -1,
      playbackStartTime: null,
      pausedAtTime: null,
    });
  },

  pauseHighlighting: () => {
    const { playbackStartTime, pausedAtTime, isActive } = get();
    // Only pause if active and not already paused
    if (isActive && playbackStartTime !== null && pausedAtTime === null) {
      const elapsed = performance.now() - playbackStartTime;
      console.debug('[TtsHighlightStore] Pausing at', elapsed);
      set({
        isPaused: true,
        pausedAtTime: elapsed,
      });
    }
  },

  resumeHighlighting: () => {
    const { pausedAtTime, isActive } = get();
    if (isActive && pausedAtTime !== null) {
      console.debug('[TtsHighlightStore] Resuming from', pausedAtTime);
      // Adjust start time to account for pause
      set({
        isPaused: false,
        playbackStartTime: performance.now() - pausedAtTime,
        pausedAtTime: null,
      });
    }
  },

  updateCurrentWord: (index) => {
    const { currentWordIndex } = get();
    if (index !== currentWordIndex) {
      set({ currentWordIndex: index });
    }
  },

  setPlaybackStartTime: (time) => {
    set({ playbackStartTime: time });
  },

  reset: () => set(initialState),
}));

// Selectors
export const selectCurrentWord = (state: TtsHighlightState): WordTiming | null => {
  if (state.currentWordIndex >= 0 && state.currentWordIndex < state.wordTimings.length) {
    return state.wordTimings[state.currentWordIndex];
  }
  return null;
};

export const selectIsHighlighting = (state: TtsHighlightState): boolean =>
  state.isActive && !state.isPaused;
