import { beforeEach, describe, expect, it } from "vitest";
import {
  selectConnectedProviders,
  selectNeedsApiKey,
  useAiTtsStore,
} from "../../stores/ai-tts-store";

beforeEach(() => {
  const current = useAiTtsStore.getState();
  useAiTtsStore.setState({
    provider: "elevenlabs",
    initialized: false,
    apiKey: null,
    initError: null,
    voices: [],
    selectedVoiceId: "21m00Tcm4TlvDq8ikWAM",
    providerVoiceIds: {
      elevenlabs: "21m00Tcm4TlvDq8ikWAM",
      local: null,
      groq: "autumn",
    },
    providerOperationGeneration: 0,
    switchingProvider: null,
    connections: {
      elevenlabs: {
        ...current.connections.elevenlabs,
        status: "setup",
        error: null,
      },
      local: {
        ...current.connections.local,
        status: "setup",
        error: null,
      },
      groq: {
        ...current.connections.groq,
        status: "setup",
        error: null,
      },
    },
  });
});

describe("AI TTS connection registry", () => {
  it("keeps independent ready states while selecting one active provider", () => {
    const store = useAiTtsStore.getState();
    store.setConnectionStatus("local", "connected");
    store.setConnectionStatus("elevenlabs", "connected");
    store.setConnectionStatus("groq", "connected");
    store.setProviderConfig("groq", null, false, 200);
    store.setInitialized(true);

    expect(selectConnectedProviders(useAiTtsStore.getState())).toEqual([
      "local",
      "elevenlabs",
      "groq",
    ]);
    expect(useAiTtsStore.getState()).toMatchObject({
      provider: "groq",
      initialized: true,
      maxTextUtf8Bytes: 200,
    });
    expect(selectNeedsApiKey(useAiTtsStore.getState())).toBe(false);
  });

  it("restores a provider-specific voice without overwriting another provider", () => {
    const store = useAiTtsStore.getState();
    store.setProviderConfig("local", "http://127.0.0.1:5301", false, 8192);
    store.setVoices([
      {
        id: "F1-en",
        name: "F1-en",
        provider: "local",
        previewUrl: null,
        labels: null,
      },
    ]);
    store.setSelectedVoice("F1-en");
    store.setProviderConfig("groq", null, false, 200);
    store.setVoices([
      {
        id: "autumn",
        name: "Autumn",
        provider: "groq",
        previewUrl: null,
        labels: null,
      },
      {
        id: "troy",
        name: "Troy",
        provider: "groq",
        previewUrl: null,
        labels: null,
      },
    ]);
    store.setSelectedVoice("troy");
    store.setProviderConfig("local", "http://127.0.0.1:5301", false, 8192);
    store.setVoices([
      {
        id: "F1-en",
        name: "F1-en",
        provider: "local",
        previewUrl: null,
        labels: null,
      },
    ]);

    expect(useAiTtsStore.getState().selectedVoiceId).toBe("F1-en");
    expect(useAiTtsStore.getState().providerVoiceIds).toMatchObject({
      local: "F1-en",
      groq: "troy",
    });
  });

  it("consumes a native finish once and ignores stale provider generations", () => {
    useAiTtsStore.setState({
      backendPlaybackGeneration: 12,
      naturalCompletionCount: 0,
      playbackState: "playing",
      currentText: "new provider clip",
    });

    expect(useAiTtsStore.getState().consumeBackendCompletion(11)).toBe(false);
    expect(useAiTtsStore.getState()).toMatchObject({
      backendPlaybackGeneration: 12,
      naturalCompletionCount: 0,
      playbackState: "playing",
      currentText: "new provider clip",
    });
    expect(useAiTtsStore.getState().consumeBackendCompletion(12)).toBe(true);
    expect(useAiTtsStore.getState().consumeBackendCompletion(12)).toBe(false);
    expect(useAiTtsStore.getState()).toMatchObject({
      backendPlaybackGeneration: null,
      naturalCompletionCount: 1,
      playbackState: "idle",
      currentText: null,
    });
  });

  it("ages out stale async provider operations and clears an older switch", () => {
    useAiTtsStore.getState().setSwitchingProvider("local");
    const first = useAiTtsStore.getState().beginProviderOperation("elevenlabs");
    const second = useAiTtsStore.getState().beginProviderOperation("groq");

    expect(first).toBe(1);
    expect(useAiTtsStore.getState().switchingProvider).toBeNull();
    expect(second).toBe(2);
    expect(useAiTtsStore.getState().isCurrentProviderOperation(first)).toBe(
      false,
    );
    expect(useAiTtsStore.getState().isCurrentProviderOperation(second)).toBe(
      true,
    );
  });
});
