import { useEffect, useCallback, useRef } from 'react';
import { useTtsStore } from '../stores/tts-store';
import { onTtsChunkStarted, onTtsChunkCompleted, onTtsCompleted } from '../lib/tauri-invoke';

interface TtsEventHandlers {
  onChunkStart?: (chunkId: string) => void;
  onChunkComplete?: (chunkId: string) => void;
  onStop?: () => void;
  onError?: (error: string) => void;
}

/**
 * Hook to subscribe to TTS events from the backend
 */
export function useTtsEvents(handlers: TtsEventHandlers = {}) {
  const { setPlaybackState, setCurrentChunk, nextChunk } = useTtsStore();
  const handlersRef = useRef(handlers);

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Handle chunk started event
  const handleChunkStarted = useCallback(
    (chunkIndex: number) => {
      const chunkId = `chunk-${chunkIndex}`;
      setCurrentChunk(chunkId, chunkIndex);
      setPlaybackState('playing');
      handlersRef.current.onChunkStart?.(chunkId);
    },
    [setCurrentChunk, setPlaybackState]
  );

  // Handle chunk completed event
  const handleChunkCompleted = useCallback(
    (chunkIndex: number) => {
      const chunkId = `chunk-${chunkIndex}`;
      handlersRef.current.onChunkComplete?.(chunkId);

      // Automatically advance to next chunk
      const next = nextChunk();
      if (!next) {
        // No more chunks, playback complete
        setPlaybackState('idle');
      }
    },
    [nextChunk, setPlaybackState]
  );

  // Handle stop event
  const handleStopped = useCallback(() => {
    setPlaybackState('idle');
    setCurrentChunk(null);
    handlersRef.current.onStop?.();
  }, [setPlaybackState, setCurrentChunk]);

  // Subscribe to TTS events
  useEffect(() => {
    let unsubscribeChunkStarted: (() => void) | null = null;
    let unsubscribeChunkCompleted: (() => void) | null = null;
    let unsubscribeStopped: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        unsubscribeChunkStarted = await onTtsChunkStarted((event) => {
          handleChunkStarted(event.chunkIndex);
        });

        unsubscribeChunkCompleted = await onTtsChunkCompleted((event) => {
          handleChunkCompleted(event.chunkIndex);
        });

        unsubscribeStopped = await onTtsCompleted(() => {
          handleStopped();
        });
      } catch (error) {
        console.error('Failed to set up TTS event listeners:', error);
        handlersRef.current.onError?.(String(error));
      }
    };

    setupListeners();

    return () => {
      unsubscribeChunkStarted?.();
      unsubscribeChunkCompleted?.();
      unsubscribeStopped?.();
    };
  }, [handleChunkStarted, handleChunkCompleted, handleStopped]);
}

/**
 * Hook for tracking TTS playback progress
 */
export function useTtsProgress() {
  const { playbackState, currentChunkIndex, chunks } = useTtsStore();
  const startTimeRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  // Track playback start time
  useEffect(() => {
    if (playbackState === 'playing') {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
    } else if (playbackState === 'paused') {
      // Store elapsed time when paused
      if (startTimeRef.current !== null) {
        elapsedRef.current += Date.now() - startTimeRef.current;
        startTimeRef.current = null;
      }
    } else if (playbackState === 'idle') {
      // Reset on stop
      startTimeRef.current = null;
      elapsedRef.current = 0;
    }
  }, [playbackState]);

  const getElapsed = useCallback(() => {
    let elapsed = elapsedRef.current;
    if (startTimeRef.current !== null) {
      elapsed += Date.now() - startTimeRef.current;
    }
    return elapsed / 1000; // Return in seconds
  }, []);

  const getProgress = useCallback(() => {
    if (currentChunkIndex < 0 || chunks.length === 0) {
      return 0;
    }
    return (currentChunkIndex + 1) / chunks.length;
  }, [currentChunkIndex, chunks.length]);

  return {
    getElapsed,
    getProgress,
    isPlaying: playbackState === 'playing',
    isPaused: playbackState === 'paused',
  };
}
