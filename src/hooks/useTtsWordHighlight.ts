/**
 * TTS Word Highlight Hook
 *
 * Manages karaoke-style word-by-word highlighting during TTS playback.
 * Uses requestAnimationFrame for smooth 60fps highlight updates.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  aiTtsSpeakWithTimestamps,
  aiTtsStop,
  aiTtsPause,
  aiTtsResume,
} from "../lib/tauri-invoke";
import { onAiTtsPlaybackStarting, onAiTtsFinished } from "../lib/api/ai-tts";
import {
  useTtsHighlightStore,
  selectIsHighlighting,
} from "../stores/tts-highlight-store";
import { useAiTtsStore } from "../stores/ai-tts-store";
import {
  buildWordFallbackTimings,
  findWordIndexAtTime,
} from "../lib/tts-tracking";
import {
  mapSpokenRangeToSource,
  type AlignmentSegment,
  type ProsodyBoundary,
} from "../lib/prosody-plan";

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
  const playbackStartTimeRef = useRef<number | null>(null);
  const playbackGenerationRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // For debug logging throttling
  const lastLoggedSecond = useRef<number>(-1);

  const isHighlighting = useTtsHighlightStore(selectIsHighlighting);

  // Complete the current playback session. Idempotent: the rAF timer path and
  // the backend `ai-tts:finished` event can both reach here, but only the first
  // one to observe an active session runs — the rest no-op via the isActive
  // guard, so completion (and any auto-page advance) happens exactly once.
  const completePlayback = useCallback(
    (reason: string) => {
      if (!useTtsHighlightStore.getState().isActive) return;
      console.debug(`[TtsWordHighlight] Playback complete (${reason})`);
      speakingRef.current = false;
      requestIdRef.current += 1;
      playbackStartTimeRef.current = null;
      playbackGenerationRef.current = null;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      highlightStore.stopHighlighting();
      ttsStore.setPlaybackState("idle");
      optionsRef.current.onComplete?.();
    },
    [highlightStore, ttsStore],
  );

  // Animation loop that updates current word based on elapsed time
  const updateHighlight = useCallback(() => {
    const state = useTtsHighlightStore.getState();

    if (!state.isActive || state.playbackStartTime === null) {
      console.debug("[TtsWordHighlight] Animation loop stopped - not active");
      return;
    }

    if (state.isPaused) {
      // Keep the animation frame alive but don't update
      animationFrameRef.current = requestAnimationFrame(updateHighlight);
      return;
    }

    const elapsed = (performance.now() - state.playbackStartTime) / 1000; // Convert to seconds

    // Word timings are 1×-relative, but at speed S the audio plays S× faster, so
    // after `elapsed` real seconds the spoken position is `elapsed · S` into the
    // 1× timeline. Select + complete against that audio-time (spec 039, FR-009).
    const ttsState = useAiTtsStore.getState();
    // Local audio is already synthesized at the requested speed. ElevenLabs
    // returns a 1× timeline and uses the player-side stretch ratio.
    const timelineRate = ttsState.provider === "local" ? 1 : ttsState.speed;
    const audioElapsed = elapsed * timelineRate;

    // Debug: log every 60 frames (~1 second) to avoid spam
    if (
      Math.floor(elapsed * 10) % 10 === 0 &&
      Math.floor(elapsed) !== lastLoggedSecond.current
    ) {
      lastLoggedSecond.current = Math.floor(elapsed);
      console.debug("[TtsWordHighlight] Animation tick", {
        elapsed: elapsed.toFixed(2),
        totalDuration: state.totalDuration,
        currentWordIndex: state.currentWordIndex,
        wordCount: state.wordTimings.length,
        firstWordTiming: state.wordTimings[0],
      });
    }

    // Completion is deliberately NOT inferred from this visual clock. Only the
    // native sink-drained event may advance a sentence/page; otherwise decode
    // latency or estimated marks can cut the clip and a late old event can
    // terminate its successor.

    // Find current word based on audio time (pure, unit-tested selection).
    const newWordIndex = findWordIndexAtTime(audioElapsed, state.wordTimings);

    // Update if word changed
    if (newWordIndex !== lastWordIndexRef.current && newWordIndex >= 0) {
      lastWordIndexRef.current = newWordIndex;
      highlightStore.updateCurrentWord(newWordIndex);

      if (newWordIndex < state.wordTimings.length) {
        const word = state.wordTimings[newWordIndex];
        optionsRef.current.onWordChange?.(newWordIndex, word.word);
        optionsRef.current.onScrollNeeded?.(newWordIndex, word.word);
      }
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(updateHighlight);
  }, [highlightStore]);

  // Start animation loop when highlighting becomes active
  useEffect(() => {
    const state = useTtsHighlightStore.getState();

    if (state.isActive) {
      console.debug("[TtsWordHighlight] Starting animation loop");
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

  // Listen for playback-starting event to capture the exact audio start time
  // This event is emitted by the backend RIGHT BEFORE audio starts playing.
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    onAiTtsPlaybackStarting((event) => {
      // Capture the exact moment - this is when audio is about to start
      const startTime = performance.now();
      playbackStartTimeRef.current = startTime;
      playbackGenerationRef.current = event.generation;

      console.debug("[TtsWordHighlight] Playback starting event received", {
        duration: event.duration,
        capturedStartTime: startTime,
      });

      // If highlighting is already active (startHighlighting was called before event arrived),
      // update the playback start time now
      const state = useTtsHighlightStore.getState();
      if (state.isActive) {
        console.debug(
          "[TtsWordHighlight] Updating playback start time (highlighting already active)",
        );
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

  // Drive completion off the real audio-finished signal. The backend emits
  // `ai-tts:finished` when the rodio sink drains naturally; completing here
  // (not only on the rAF duration estimate) is what fixes the unknown-duration
  // case — there the 026 guard intentionally suppresses timer completion (which
  // would otherwise skip the page on frame 1), so the event is the ONLY honest
  // completion signal. A ref keeps the subscription stable across renders while
  // always invoking the latest completePlayback (avoids stale-closure auto-page).
  const completePlaybackRef = useRef(completePlayback);
  useEffect(() => {
    completePlaybackRef.current = completePlayback;
  }, [completePlayback]);

  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    onAiTtsFinished((event) => {
      const activeGeneration = playbackGenerationRef.current;
      if (activeGeneration !== null && event?.generation !== activeGeneration) {
        console.debug("[TtsWordHighlight] Ignoring stale finished event", {
          activeGeneration,
          finishedGeneration: event?.generation,
        });
        return;
      }
      completePlaybackRef.current("ai-tts:finished event");
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
    async (
      text: string,
      pageNumber: number,
      voiceId?: string,
      baseOffset = 0,
      alignment?: readonly AlignmentSegment[],
      boundaryAfter?: ProsodyBoundary,
    ) => {
      if (!ttsStore.initialized) {
        console.warn("[TtsWordHighlight] TTS not initialized");
        return false;
      }

      // Guard against double-calls from React StrictMode
      if (speakingRef.current) {
        console.debug(
          "[TtsWordHighlight] Already speaking, ignoring duplicate request",
        );
        return false;
      }

      // Stop any existing playback
      if (highlightStore.isActive) {
        await aiTtsStop();
        highlightStore.stopHighlighting();
      }

      speakingRef.current = true;
      const currentRequestId = ++requestIdRef.current;

      ttsStore.setPlaybackState("loading");
      ttsStore.setError(null);

      try {
        console.debug("[TtsWordHighlight] Requesting TTS with timestamps", {
          textLength: text.length,
          pageNumber,
          requestId: currentRequestId,
        });

        const result = await aiTtsSpeakWithTimestamps(
          text,
          voiceId ?? ttsStore.selectedVoiceId ?? undefined,
          boundaryAfter,
        );

        // Check if this request was superseded
        if (currentRequestId !== requestIdRef.current) {
          console.debug(
            "[TtsWordHighlight] Request superseded, ignoring result",
          );
          speakingRef.current = false;
          return false;
        }

        if (result.success) {
          console.debug("[TtsWordHighlight] TTS response received", {
            wordCount: result.wordTimings.length,
            duration: result.totalDuration,
          });

          // Local providers publish a measured WAV duration but no word marks.
          // Keep the overlay and bottom progress on the real audio clock with
          // deterministic per-word estimates rather than starting an empty
          // timeline that remains stuck at 0%.
          const usingFallback = result.wordTimings.length === 0;
          const relativeTimings = usingFallback
            ? buildWordFallbackTimings(text, result.totalDuration)
            : result.wordTimings;
          const wordTimings = relativeTimings.flatMap((timing) => {
            const mapped = alignment
              ? mapSpokenRangeToSource(
                  alignment,
                  timing.charStart,
                  timing.charEnd,
                )
              : { start: timing.charStart, end: timing.charEnd };
            // An insertion-only mark has no PDF range. Punctuation attached to
            // a real word still overlaps its copy segment and maps normally.
            if (!mapped) return [];
            return [
              {
                ...timing,
                charStart: mapped.start + baseOffset,
                charEnd: mapped.end + baseOffset,
              },
            ];
          });

          // Start highlighting - this triggers the animation loop via useEffect
          highlightStore.startHighlighting(
            text,
            wordTimings,
            result.totalDuration,
            pageNumber,
            usingFallback,
          );

          // If we captured a playback start time from the event (which fires before response),
          // use that instead of the time set by startHighlighting
          if (playbackStartTimeRef.current !== null) {
            console.debug(
              "[TtsWordHighlight] Using captured playback start time from event:",
              playbackStartTimeRef.current,
            );
            highlightStore.setPlaybackStartTime(playbackStartTimeRef.current);
            playbackStartTimeRef.current = null; // Reset for next playback
          }

          ttsStore.setPlaybackState("playing");
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
        if (message.startsWith("TTS_CANCELLED:")) {
          ttsStore.setError(null);
          ttsStore.setPlaybackState("idle");
          speakingRef.current = false;
          return false;
        }
        console.error(
          "[TtsWordHighlight] Failed to speak with timestamps:",
          message,
        );
        ttsStore.setError(message);
        ttsStore.setPlaybackState("error");
        speakingRef.current = false;
      }

      return false;
    },
    [highlightStore, ttsStore, updateHighlight],
  );

  // Stop playback and highlighting
  const stop = useCallback(async () => {
    try {
      speakingRef.current = false;
      requestIdRef.current += 1;
      playbackStartTimeRef.current = null;
      playbackGenerationRef.current = null;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      await aiTtsStop();
      highlightStore.stopHighlighting();
      ttsStore.setPlaybackState("idle");
    } catch (error) {
      console.error("[TtsWordHighlight] Failed to stop:", error);
    }
  }, [highlightStore, ttsStore]);

  // Pause playback
  const pause = useCallback(async () => {
    try {
      await aiTtsPause();
      highlightStore.pauseHighlighting();
      ttsStore.setPlaybackState("paused");
    } catch (error) {
      console.error("[TtsWordHighlight] Failed to pause:", error);
    }
  }, [highlightStore, ttsStore]);

  // Resume playback
  const resume = useCallback(async () => {
    try {
      await aiTtsResume();
      highlightStore.resumeHighlighting();
      ttsStore.setPlaybackState("playing");
      // Restart animation loop
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(updateHighlight);
      }
    } catch (error) {
      console.error("[TtsWordHighlight] Failed to resume:", error);
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
