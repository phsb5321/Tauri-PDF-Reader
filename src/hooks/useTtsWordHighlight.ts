/**
 * TTS Word Highlight Hook
 *
 * Manages karaoke-style word-by-word highlighting during TTS playback.
 * Uses requestAnimationFrame for smooth 60fps highlight updates.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  aiTtsSpeakWithTimestamps,
  aiTtsStop,
  aiTtsPause,
  aiTtsResume,
} from '../lib/tauri-invoke';
import { onAiTtsPlaybackStarting } from '../lib/api/ai-tts';
import { useTtsHighlightStore, selectIsHighlighting } from '../stores/tts-highlight-store';
import { useAiTtsStore } from '../stores/ai-tts-store';

export interface UseTtsWordHighlightOptions {
  /** Callback when a new word becomes active */
  onWordChange?: (wordIndex: number, word: string) => void;
  /** Callback when playback completes */
  onComplete?: () => void;
  /** Callback when scrolling is needed to keep word visible */
  onScrollNeeded?: (wordIndex: number, word: string) => void;
}

export function useTtsWordHighlight(options: UseTtsWordHighlightOptions = {}) {
  const highlightStore = useTtsHighlightStore();
  const ttsStore = useAiTtsStore();
  const animationFrameRef = useRef<number | null>(null);
  const lastWordIndexRef = useRef<number>(-1);
  // Guard against double-calls from React StrictMode
  const speakingRef = useRef<boolean>(false);
  const requestIdRef = useRef<number>(0);
  // For debug logging throttling
  const lastLoggedSecond = useRef<number>(-1);

  const isHighlighting = useTtsHighlightStore(selectIsHighlighting);

  // Animation loop that updates current word based on elapsed time
  const updateHighlight = useCallback(() => {
    const state = useTtsHighlightStore.getState();

    if (!state.isActive || state.playbackStartTime === null) {
      console.debug('[TtsWordHighlight] Animation loop stopped - not active');
      return;
    }

    if (state.isPaused) {
      // Keep the animation frame alive but don't update
      animationFrameRef.current = requestAnimationFrame(updateHighlight);
      return;
    }

    const elapsed = (performance.now() - state.playbackStartTime) / 1000; // Convert to seconds

    // Debug: log every 60 frames (~1 second) to avoid spam
    if (Math.floor(elapsed * 10) % 10 === 0 && Math.floor(elapsed) !== lastLoggedSecond.current) {
      lastLoggedSecond.current = Math.floor(elapsed);
      console.debug('[TtsWordHighlight] Animation tick', {
        elapsed: elapsed.toFixed(2),
        totalDuration: state.totalDuration,
        currentWordIndex: state.currentWordIndex,
        wordCount: state.wordTimings.length,
        firstWordTiming: state.wordTimings[0],
      });
    }

    // Check if playback is complete
    if (elapsed >= state.totalDuration) {
      console.debug('[TtsWordHighlight] Playback complete');
      speakingRef.current = false;
      highlightStore.stopHighlighting();
      ttsStore.setPlaybackState('idle');
      options.onComplete?.();
      return;
    }

    // Find current word based on elapsed time
    let newWordIndex = -1;
    for (let i = 0; i < state.wordTimings.length; i++) {
      const word = state.wordTimings[i];
      if (elapsed >= word.startTime && elapsed < word.endTime) {
        newWordIndex = i;
        break;
      }
      // Handle gap between words - keep last word highlighted
      if (i < state.wordTimings.length - 1) {
        const nextWord = state.wordTimings[i + 1];
        if (elapsed >= word.endTime && elapsed < nextWord.startTime) {
          newWordIndex = i;
          break;
        }
      }
    }

    // If we're past all words, highlight the last one
    if (newWordIndex === -1 && state.wordTimings.length > 0) {
      const lastWord = state.wordTimings[state.wordTimings.length - 1];
      if (elapsed >= lastWord.startTime) {
        newWordIndex = state.wordTimings.length - 1;
      }
    }

    // Update if word changed
    if (newWordIndex !== lastWordIndexRef.current && newWordIndex >= 0) {
      lastWordIndexRef.current = newWordIndex;
      highlightStore.updateCurrentWord(newWordIndex);

      if (newWordIndex < state.wordTimings.length) {
        const word = state.wordTimings[newWordIndex];
        options.onWordChange?.(newWordIndex, word.word);
        options.onScrollNeeded?.(newWordIndex, word.word);
      }
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(updateHighlight);
  }, [highlightStore, ttsStore, options]);

  // Start animation loop when highlighting becomes active
  useEffect(() => {
    const state = useTtsHighlightStore.getState();
    
    if (state.isActive) {
      console.debug('[TtsWordHighlight] Starting animation loop');
      lastWordIndexRef.current = -1;
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(updateHighlight);
      }
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isHighlighting, updateHighlight]);

  // Store the playback start time from the event
  // This ref captures the exact moment audio starts (from backend event)
  const playbackStartTimeRef = useRef<number | null>(null);

  // Listen for playback-starting event to capture the exact audio start time
  // This event is emitted by the backend RIGHT BEFORE audio starts playing.
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    onAiTtsPlaybackStarting((event) => {
      // Capture the exact moment - this is when audio is about to start
      const startTime = performance.now();
      playbackStartTimeRef.current = startTime;

      console.debug('[TtsWordHighlight] Playback starting event received', {
        duration: event.duration,
        capturedStartTime: startTime,
      });

      // If highlighting is already active (startHighlighting was called before event arrived),
      // update the playback start time now
      const state = useTtsHighlightStore.getState();
      if (state.isActive) {
        console.debug('[TtsWordHighlight] Updating playback start time (highlighting already active)');
        state.setPlaybackStartTime(startTime);
      }
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  // Speak text with word highlighting
  const speakWithHighlight = useCallback(
    async (text: string, pageNumber: number, voiceId?: string) => {
      if (!ttsStore.initialized) {
        console.warn('[TtsWordHighlight] TTS not initialized');
        return false;
      }

      // Guard against double-calls from React StrictMode
      if (speakingRef.current) {
        console.debug('[TtsWordHighlight] Already speaking, ignoring duplicate request');
        return false;
      }

      // Stop any existing playback
      if (highlightStore.isActive) {
        await aiTtsStop();
        highlightStore.stopHighlighting();
      }

      speakingRef.current = true;
      const currentRequestId = ++requestIdRef.current;

      ttsStore.setPlaybackState('loading');
      ttsStore.setError(null);

      try {
        console.debug('[TtsWordHighlight] Requesting TTS with timestamps', {
          textLength: text.length,
          pageNumber,
          requestId: currentRequestId,
        });

        const result = await aiTtsSpeakWithTimestamps(text, voiceId ?? ttsStore.selectedVoiceId ?? undefined);

        // Check if this request was superseded
        if (currentRequestId !== requestIdRef.current) {
          console.debug('[TtsWordHighlight] Request superseded, ignoring result');
          speakingRef.current = false;
          return false;
        }

        if (result.success) {
          console.debug('[TtsWordHighlight] TTS response received', {
            wordCount: result.wordTimings.length,
            duration: result.totalDuration,
          });

          // Start highlighting - this triggers the animation loop via useEffect
          highlightStore.startHighlighting(text, result.wordTimings, result.totalDuration, pageNumber);
          
          // If we captured a playback start time from the event (which fires before response),
          // use that instead of the time set by startHighlighting
          if (playbackStartTimeRef.current !== null) {
            console.debug('[TtsWordHighlight] Using captured playback start time from event:', playbackStartTimeRef.current);
            highlightStore.setPlaybackStartTime(playbackStartTimeRef.current);
            playbackStartTimeRef.current = null; // Reset for next playback
          }
          
          ttsStore.setPlaybackState('playing');
          ttsStore.setCurrentText(text);

          // Manually start animation loop in case useEffect doesn't catch it
          if (animationFrameRef.current === null) {
            lastWordIndexRef.current = -1;
            animationFrameRef.current = requestAnimationFrame(updateHighlight);
          }

          return true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[TtsWordHighlight] Failed to speak with timestamps:', message);
        ttsStore.setError(message);
        ttsStore.setPlaybackState('error');
        speakingRef.current = false;
      }

      return false;
    },
    [highlightStore, ttsStore, updateHighlight]
  );

  // Stop playback and highlighting
  const stop = useCallback(async () => {
    try {
      speakingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      await aiTtsStop();
      highlightStore.stopHighlighting();
      ttsStore.setPlaybackState('idle');
    } catch (error) {
      console.error('[TtsWordHighlight] Failed to stop:', error);
    }
  }, [highlightStore, ttsStore]);

  // Pause playback
  const pause = useCallback(async () => {
    try {
      await aiTtsPause();
      highlightStore.pauseHighlighting();
      ttsStore.setPlaybackState('paused');
    } catch (error) {
      console.error('[TtsWordHighlight] Failed to pause:', error);
    }
  }, [highlightStore, ttsStore]);

  // Resume playback
  const resume = useCallback(async () => {
    try {
      await aiTtsResume();
      highlightStore.resumeHighlighting();
      ttsStore.setPlaybackState('playing');
      // Restart animation loop
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(updateHighlight);
      }
    } catch (error) {
      console.error('[TtsWordHighlight] Failed to resume:', error);
    }
  }, [highlightStore, ttsStore, updateHighlight]);

  // Toggle play/pause
  const togglePlayback = useCallback(async () => {
    if (highlightStore.isPaused) {
      await resume();
    } else if (highlightStore.isActive) {
      await pause();
    }
  }, [highlightStore.isPaused, highlightStore.isActive, pause, resume]);

  return {
    // State
    isActive: highlightStore.isActive,
    isPaused: highlightStore.isPaused,
    currentWordIndex: highlightStore.currentWordIndex,
    wordTimings: highlightStore.wordTimings,
    currentText: highlightStore.currentText,
    pageNumber: highlightStore.pageNumber,

    // Actions
    speakWithHighlight,
    stop,
    pause,
    resume,
    togglePlayback,
  };
}
