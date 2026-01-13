import { useCallback, useEffect, useRef } from 'react';
import {
  aiTtsInit,
  aiTtsListVoices,
  aiTtsSpeak,
  aiTtsStop,
  aiTtsPause,
  aiTtsResume,
  aiTtsSetVoice,
  aiTtsSetSpeed,
  aiTtsGetState,
  onAiTtsStarted,
  onAiTtsCompleted,
  onAiTtsStopped,
  onAiTtsError,
} from '../lib/tauri-invoke';
import { useAiTtsStore } from '../stores/ai-tts-store';

/**
 * Hook for AI TTS (ElevenLabs) operations
 */
export function useAiTts() {
  const store = useAiTtsStore();
  const initializingRef = useRef(false);

  // Initialize TTS when API key is available
  const initialize = useCallback(async (apiKey: string) => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    store.setPlaybackState('loading');

    try {
      const result = await aiTtsInit(apiKey);

      if (result.success) {
        store.setApiKey(apiKey);
        store.setInitialized(true);

        // Fetch voices
        const voicesResult = await aiTtsListVoices();
        store.setVoices(voicesResult.voices);

        // Set voice if one is selected
        if (store.selectedVoiceId) {
          await aiTtsSetVoice(store.selectedVoiceId);
        }

        // Set speed
        await aiTtsSetSpeed(store.speed);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.setInitialized(false, message);
    } finally {
      initializingRef.current = false;
      store.setPlaybackState('idle');
    }
  }, [store]);

  // Auto-initialize if API key exists
  useEffect(() => {
    if (store.apiKey && !store.initialized && !initializingRef.current) {
      initialize(store.apiKey);
    }
  }, [store.apiKey, store.initialized, initialize]);

  // Subscribe to TTS events
  useEffect(() => {
    const unsubscribers: Promise<() => void>[] = [];

    unsubscribers.push(
      onAiTtsStarted((event) => {
        store.setPlaybackState('playing');
        store.setCurrentText(event.text);
      })
    );

    unsubscribers.push(
      onAiTtsCompleted(() => {
        store.setPlaybackState('idle');
        store.setCurrentText(null);
      })
    );

    unsubscribers.push(
      onAiTtsStopped(() => {
        store.setPlaybackState('idle');
        store.setCurrentText(null);
      })
    );

    unsubscribers.push(
      onAiTtsError((event) => {
        store.setError(event.error);
        store.setPlaybackState('error');
      })
    );

    return () => {
      unsubscribers.forEach(async (unsub) => {
        const fn = await unsub;
        fn();
      });
    };
  }, [store]);

  // Speak text
  const speak = useCallback(
    async (text: string) => {
      if (!store.initialized) {
        console.warn('AI TTS not initialized');
        return;
      }

      store.setPlaybackState('loading');
      store.setError(null);

      try {
        await aiTtsSpeak(text, store.selectedVoiceId ?? undefined);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        store.setError(message);
      }
    },
    [store]
  );

  // Stop playback
  const stop = useCallback(async () => {
    try {
      await aiTtsStop();
      store.setPlaybackState('idle');
    } catch (error) {
      console.error('Failed to stop TTS:', error);
    }
  }, [store]);

  // Pause playback
  const pause = useCallback(async () => {
    try {
      await aiTtsPause();
      store.setPlaybackState('paused');
    } catch (error) {
      console.error('Failed to pause TTS:', error);
    }
  }, [store]);

  // Resume playback
  const resume = useCallback(async () => {
    try {
      await aiTtsResume();
      store.setPlaybackState('playing');
    } catch (error) {
      console.error('Failed to resume TTS:', error);
    }
  }, [store]);

  // Toggle play/pause
  const togglePlayback = useCallback(async () => {
    if (store.playbackState === 'playing') {
      await pause();
    } else if (store.playbackState === 'paused') {
      await resume();
    }
  }, [store.playbackState, pause, resume]);

  // Set voice
  const setVoice = useCallback(
    async (voiceId: string) => {
      try {
        await aiTtsSetVoice(voiceId);
        store.setSelectedVoice(voiceId);
      } catch (error) {
        console.error('Failed to set voice:', error);
      }
    },
    [store]
  );

  // Set speed
  const setSpeed = useCallback(
    async (speed: number) => {
      try {
        await aiTtsSetSpeed(speed);
        store.setSpeed(speed);
      } catch (error) {
        console.error('Failed to set speed:', error);
      }
    },
    [store]
  );

  // Refresh state from backend
  const refreshState = useCallback(async () => {
    try {
      const state = await aiTtsGetState();
      store.updateFromBackend(state);
    } catch (error) {
      console.error('Failed to refresh TTS state:', error);
    }
  }, [store]);

  return {
    // State
    initialized: store.initialized,
    apiKey: store.apiKey,
    playbackState: store.playbackState,
    currentText: store.currentText,
    error: store.error,
    voices: store.voices,
    selectedVoiceId: store.selectedVoiceId,
    speed: store.speed,
    needsApiKey: !store.apiKey,

    // Actions
    initialize,
    speak,
    stop,
    pause,
    resume,
    togglePlayback,
    setVoice,
    setSpeed,
    refreshState,
  };
}
