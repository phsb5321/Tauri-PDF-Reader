import { useCallback, useEffect } from "react";
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
  onAiTtsFinished,
  onAiTtsPlaybackStarting,
  onAiTtsStopped,
  onAiTtsPaused,
  onAiTtsResumed,
  onAiTtsError,
} from "../lib/tauri-invoke";
import { commands } from "../lib/bindings";
import { useAiTtsStore, type AiTtsProvider } from "../stores/ai-tts-store";
import { useTtsHighlightStore } from "../stores/tts-highlight-store";

/** Provider-neutral AI TTS operations and live connection switching. */
export function useAiTts() {
  const store = useAiTtsStore();

  const activateProvider = useCallback(
    async (provider: AiTtsProvider, generation?: number): Promise<boolean> => {
      const before = useAiTtsStore.getState();
      if (before.connections[provider].status !== "connected") return false;
      const operation = generation ?? before.beginProviderOperation(provider);
      before.setSwitchingProvider(provider);
      before.setPlaybackState("loading");
      before.setCurrentText(null);
      before.setBackendPlaybackGeneration(null);
      useTtsHighlightStore.getState().stopHighlighting();

      try {
        const switched = await commands.aiTtsSwitchProvider(provider);
        if (switched.status === "error") throw new Error(switched.error);
        if (!useAiTtsStore.getState().isCurrentProviderOperation(operation)) {
          return false;
        }

        const connection = useAiTtsStore.getState().connections[provider];
        useAiTtsStore
          .getState()
          .setProviderConfig(
            provider,
            provider === "local" ? connection.destination : null,
            switched.data.supportsWordTimings,
            switched.data.maxTextUtf8Bytes,
          );
        useAiTtsStore.getState().setConnectionStatus(provider, "connected", {
          error: null,
          supportsWordTimings: switched.data.supportsWordTimings,
          maxTextUtf8Bytes: switched.data.maxTextUtf8Bytes,
        });

        const voicesResult = await aiTtsListVoices();
        if (!useAiTtsStore.getState().isCurrentProviderOperation(operation)) {
          return false;
        }
        useAiTtsStore.getState().setVoices(voicesResult.voices);
        const selected = useAiTtsStore.getState().selectedVoiceId;
        if (selected) await aiTtsSetVoice(selected);
        await aiTtsSetSpeed(useAiTtsStore.getState().speed);
        if (!useAiTtsStore.getState().isCurrentProviderOperation(operation)) {
          return false;
        }
        useAiTtsStore.getState().setApiKey(null);
        useAiTtsStore.getState().setError(null);
        useAiTtsStore.getState().setInitialized(true);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (useAiTtsStore.getState().isCurrentProviderOperation(operation)) {
          useAiTtsStore.getState().setConnectionStatus(provider, "connected", {
            error: message,
          });
          useAiTtsStore.getState().setError(message);
        }
        return false;
      } finally {
        const current = useAiTtsStore.getState();
        if (current.isCurrentProviderOperation(operation)) {
          current.setSwitchingProvider(null);
          if (current.playbackState === "loading") {
            current.setPlaybackState(current.initialized ? "idle" : "error");
          }
        }
      }
    },
    [],
  );

  const failConnection = useCallback(
    (provider: AiTtsProvider, generation: number, error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const current = useAiTtsStore.getState();
      current.setConnectionStatus(
        provider,
        current.connections[provider].status === "connected"
          ? "connected"
          : "error",
        { error: message },
      );
      if (
        current.isCurrentProviderOperation(generation) &&
        current.provider === provider &&
        !current.initialized
      ) {
        current.setInitialized(false, message);
      }
    },
    [],
  );

  const initialize = useCallback(
    async (apiKey: string) => {
      const initial = useAiTtsStore.getState();
      if (initial.connections.elevenlabs.status === "connecting") return;
      const generation = initial.beginProviderOperation("elevenlabs");
      if (!initial.initialized) initial.setPlaybackState("loading");
      try {
        const result = await aiTtsInit(apiKey);
        useAiTtsStore
          .getState()
          .setConnectionStatus("elevenlabs", "connected", {
            error: null,
            supportsWordTimings: result.supportsWordTimings,
            maxTextUtf8Bytes: result.maxTextUtf8Bytes,
          });
        if (useAiTtsStore.getState().isCurrentProviderOperation(generation)) {
          await activateProvider("elevenlabs", generation);
        }
      } catch (error) {
        failConnection("elevenlabs", generation, error);
      }
    },
    [activateProvider, failConnection],
  );

  const initializeGroq = useCallback(
    async (apiKey: string) => {
      const initial = useAiTtsStore.getState();
      if (initial.connections.groq.status === "connecting") return;
      const generation = initial.beginProviderOperation("groq");
      if (!initial.initialized) initial.setPlaybackState("loading");
      try {
        const result = await commands.aiTtsInitGroq(apiKey);
        if (result.status === "error") throw new Error(result.error);
        useAiTtsStore.getState().setConnectionStatus("groq", "connected", {
          error: null,
          supportsWordTimings: result.data.supportsWordTimings,
          maxTextUtf8Bytes: result.data.maxTextUtf8Bytes,
        });
        if (useAiTtsStore.getState().isCurrentProviderOperation(generation)) {
          await activateProvider("groq", generation);
        }
      } catch (error) {
        failConnection("groq", generation, error);
      }
    },
    [activateProvider, failConnection],
  );

  const initializeLocal = useCallback(async () => {
    const initial = useAiTtsStore.getState();
    if (initial.connections.local.status === "connecting") return;
    const generation = initial.beginProviderOperation("local");
    if (!initial.initialized) initial.setPlaybackState("loading");
    try {
      const result = await commands.aiTtsInitLocal();
      if (result.status === "error") throw new Error(result.error);
      useAiTtsStore.getState().setConnectionStatus("local", "connected", {
        error: null,
        destination: result.data.destination,
        supportsWordTimings: result.data.supportsWordTimings,
        maxTextUtf8Bytes: result.data.maxTextUtf8Bytes,
      });
      if (useAiTtsStore.getState().isCurrentProviderOperation(generation)) {
        await activateProvider("local", generation);
      }
    } catch (error) {
      failConnection("local", generation, error);
    }
  }, [activateProvider, failConnection]);

  // Native config selects the startup provider; cloud providers connect only
  // after an explicit key submission in the current process.
  useEffect(() => {
    const currentConnection = store.connections[store.provider];
    if (
      store.provider === "local" &&
      store.localUrl &&
      !store.initialized &&
      !store.initError &&
      currentConnection.status === "setup"
    ) {
      void initializeLocal();
    } else if (
      store.provider === "elevenlabs" &&
      store.apiKey &&
      !store.initialized &&
      !store.initError &&
      currentConnection.status === "setup"
    ) {
      void initialize(store.apiKey);
    }
  }, [
    store.provider,
    store.localUrl,
    store.apiKey,
    store.initialized,
    store.initError,
    store.connections,
    initialize,
    initializeLocal,
  ]);

  // Subscribe to TTS events
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    let mounted = true;

    // Setup event listeners
    const setupListeners = async () => {
      try {
        const unsub1 = await onAiTtsStarted((event) => {
          if (mounted) {
            console.debug(
              "[TTS] State transition: -> playing (started event)",
              { text: event.text.substring(0, 50) },
            );
            useAiTtsStore.getState().setPlaybackState("playing");
            useAiTtsStore.getState().setCurrentText(event.text);
          }
        });
        if (mounted) unsubscribers.push(unsub1);

        const unsub2 = await onAiTtsPlaybackStarting((event) => {
          if (mounted) {
            useAiTtsStore
              .getState()
              .setBackendPlaybackGeneration(event.generation);
          }
        });
        if (mounted) unsubscribers.push(unsub2);

        const unsub3 = await onAiTtsFinished((event) => {
          if (
            mounted &&
            typeof event?.generation === "number" &&
            useAiTtsStore.getState().consumeBackendCompletion(event.generation)
          ) {
            console.debug("[TTS] State transition: -> idle (finished event)");
          }
        });
        if (mounted) unsubscribers.push(unsub3);

        const unsub4 = await onAiTtsStopped((event) => {
          if (!mounted) return;
          const currentGeneration =
            useAiTtsStore.getState().backendPlaybackGeneration;
          if (
            currentGeneration !== null &&
            event.generation <= currentGeneration
          ) {
            console.debug("[TTS] Ignoring stale stopped event", {
              stoppedGeneration: event.generation,
              currentGeneration,
            });
            return;
          }
          console.debug("[TTS] State transition: -> idle (stopped event)");
          useTtsHighlightStore.getState().stopHighlighting();
          const current = useAiTtsStore.getState();
          current.setPlaybackState("idle");
          current.setCurrentText(null);
          current.setBackendPlaybackGeneration(null);
        });
        if (mounted) unsubscribers.push(unsub4);

        const unsub5 = await onAiTtsPaused(() => {
          if (mounted) {
            console.debug("[TTS] State transition: -> paused (paused event)");
            useAiTtsStore.getState().setPlaybackState("paused");
          }
        });
        if (mounted) unsubscribers.push(unsub5);

        const unsub6 = await onAiTtsResumed(() => {
          if (mounted) {
            console.debug("[TTS] State transition: -> playing (resumed event)");
            useAiTtsStore.getState().setPlaybackState("playing");
          }
        });
        if (mounted) unsubscribers.push(unsub6);

        const unsub7 = await onAiTtsError((event) => {
          if (mounted) {
            console.debug("[TTS] State transition: -> error (error event)", {
              error: event.error,
            });
            const current = useAiTtsStore.getState();
            current.setError(event.error);
            current.setPlaybackState("error");
          }
        });
        if (mounted) unsubscribers.push(unsub7);
      } catch (error) {
        console.error("Failed to setup TTS event listeners:", error);
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
          console.error("Error unsubscribing from TTS event:", error);
        }
      });
    };
  }, []);

  // Speak text
  const speak = useCallback(
    async (text: string) => {
      if (!store.initialized) {
        console.warn("AI TTS not initialized");
        return;
      }

      store.setPlaybackState("loading");
      store.setError(null);

      try {
        await aiTtsSpeak(text, store.selectedVoiceId ?? undefined);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("TTS_CANCELLED:")) {
          store.setError(null);
          store.setPlaybackState("idle");
          return;
        }
        console.debug("[TTS] State transition: -> error (speak failed)", {
          error: message,
        });
        store.setError(message);
        store.setPlaybackState("error");
      }
    },
    [store],
  );

  // Stop playback
  const stop = useCallback(async () => {
    try {
      await aiTtsStop();
      store.setBackendPlaybackGeneration(null);
      store.setPlaybackState("idle");
    } catch (error) {
      console.error("Failed to stop TTS:", error);
    }
  }, [store]);

  // Pause playback
  const pause = useCallback(async () => {
    try {
      console.debug("[TTS] Pause requested");
      await aiTtsPause();
      // State will be set by the ai-tts:paused event listener
    } catch (error) {
      console.error("Failed to pause TTS:", error);
    }
  }, []);

  // Resume playback
  const resume = useCallback(async () => {
    try {
      console.debug("[TTS] Resume requested");
      await aiTtsResume();
      // State will be set by the ai-tts:resumed event listener
    } catch (error) {
      console.error("Failed to resume TTS:", error);
    }
  }, []);

  // Toggle play/pause
  const togglePlayback = useCallback(async () => {
    if (store.playbackState === "playing") {
      await pause();
    } else if (store.playbackState === "paused") {
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
        console.error("Failed to set voice:", error);
      }
    },
    [store],
  );

  // Set speed
  const setSpeed = useCallback(
    async (speed: number) => {
      try {
        await aiTtsSetSpeed(speed);
        store.setSpeed(speed);
      } catch (error) {
        console.error("Failed to set speed:", error);
      }
    },
    [store],
  );

  // Refresh state from backend
  const refreshState = useCallback(async () => {
    try {
      const state = await aiTtsGetState();
      store.updateFromBackend(state);
    } catch (error) {
      console.error("Failed to refresh TTS state:", error);
    }
  }, [store]);

  // Clear error and reset to idle state (T025)
  const clearError = useCallback(() => {
    console.debug("[TTS] Clearing error state");
    store.clearError();
  }, [store]);

  return {
    // State
    initialized: store.initialized,
    apiKey: store.apiKey,
    playbackState: store.playbackState,
    currentText: store.currentText,
    error: store.error,
    initError: store.initError,
    provider: store.provider,
    localUrl: store.localUrl,
    supportsWordTimings: store.supportsWordTimings,
    maxTextUtf8Bytes: store.maxTextUtf8Bytes,
    connections: store.connections,
    connectedProviders: (
      Object.keys(store.connections) as AiTtsProvider[]
    ).filter((provider) => store.connections[provider].status === "connected"),
    switchingProvider: store.switchingProvider,
    voices: store.voices,
    selectedVoiceId: store.selectedVoiceId,
    speed: store.speed,
    needsApiKey:
      (store.provider === "elevenlabs" || store.provider === "groq") &&
      !store.apiKey &&
      store.connections[store.provider].status !== "connected",

    // Actions
    initialize,
    initializeGroq,
    initializeLocal,
    switchProvider: activateProvider,
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
