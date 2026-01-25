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
  onAiTtsPaused,
  onAiTtsResumed,
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
      // Only reset to idle if we're still in loading state from init
      // Don't clobber playing/paused states from ongoing playback
      const currentState = store.playbackState;
      if (currentState === 'loading') {
        store.setPlaybackState('idle');
      }
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
    const unsubscribers: (() => void)[] = [];
    let mounted = true;

    // Setup event listeners
    const setupListeners = async () => {
      try {
        const unsub1 = await onAiTtsStarted((event) => {
          if (mounted) {
            console.debug('[TTS] State transition: -> playing (started event)', { text: event.text.substring(0, 50) });
            store.setPlaybackState('playing');
            store.setCurrentText(event.text);
          }
        });
        if (mounted) unsubscribers.push(unsub1);

        const unsub2 = await onAiTtsCompleted(() => {
          if (mounted) {
            console.debug('[TTS] State transition: -> idle (completed event)');
            store.setPlaybackState('idle');
            store.setCurrentText(null);
          }
        });
        if (mounted) unsubscribers.push(unsub2);

        const unsub3 = await onAiTtsStopped(() => {
          if (mounted) {
            console.debug('[TTS] State transition: -> idle (stopped event)');
            store.setPlaybackState('idle');
            store.setCurrentText(null);
          }
        });
        if (mounted) unsubscribers.push(unsub3);

        const unsub4 = await onAiTtsPaused(() => {
          if (mounted) {
            console.debug('[TTS] State transition: -> paused (paused event)');
            store.setPlaybackState('paused');
          }
        });
        if (mounted) unsubscribers.push(unsub4);

        const unsub5 = await onAiTtsResumed(() => {
          if (mounted) {
            console.debug('[TTS] State transition: -> playing (resumed event)');
            store.setPlaybackState('playing');
          }
        });
        if (mounted) unsubscribers.push(unsub5);

        const unsub6 = await onAiTtsError((event) => {
          if (mounted) {
            console.debug('[TTS] State transition: -> error (error event)', { error: event.error });
            store.setError(event.error);
            store.setPlaybackState('error');
          }
        });
        if (mounted) unsubscribers.push(unsub6);
      } catch (error) {
        console.error('Failed to setup TTS event listeners:', error);
      }
    };

    setupListeners();

    return () => {
      mounted = false;
      // Synchronously call all unsubscribe functions
      unsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch (error) {
          console.error('Error unsubscribing from TTS event:', error);
        }
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
        console.debug('[TTS] State transition: -> error (speak failed)', { error: message });
        store.setError(message);
        store.setPlaybackState('error');
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
      console.debug('[TTS] Pause requested');
      await aiTtsPause();
      // State will be set by the ai-tts:paused event listener
    } catch (error) {
      console.error('Failed to pause TTS:', error);
    }
  }, []);

  // Resume playback
  const resume = useCallback(async () => {
    try {
      console.debug('[TTS] Resume requested');
      await aiTtsResume();
      // State will be set by the ai-tts:resumed event listener
    } catch (error) {
      console.error('Failed to resume TTS:', error);
    }
  }, []);

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

  // Clear error and reset to idle state (T025)
  const clearError = useCallback(() => {
    console.debug('[TTS] Clearing error state');
    store.clearError();
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
    clearError,
  };
}
