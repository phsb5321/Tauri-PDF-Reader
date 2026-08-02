import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const INVALID_API_KEY_CANARY =
  "INVALID-077-CANARY-DO-NOT-USE-PLAINTEXT-API-KEY";
const STORAGE_KEY = "ai-tts-storage";

const mocks = vi.hoisted(() => {
  const sqlExecute = vi.fn();
  const sqlSelect = vi.fn();

  return {
    aiTtsInit: vi.fn(async () => ({ success: false, voicesCount: 0 })),
    aiTtsListVoices: vi.fn(async () => ({ voices: [] })),
    aiTtsSetVoice: vi.fn(async () => ({ success: true })),
    aiTtsSetSpeed: vi.fn(async () => ({ success: true })),
    settingsSet: vi.fn(),
    settingsSetBatch: vi.fn(),
    sqlExecute,
    sqlSelect,
    sqlLoad: vi.fn(async () => ({ execute: sqlExecute, select: sqlSelect })),
    listen: vi.fn(async () => vi.fn()),
  };
});

vi.mock("../../lib/tauri-invoke", () => ({
  aiTtsInit: mocks.aiTtsInit,
  aiTtsListVoices: mocks.aiTtsListVoices,
  aiTtsSpeak: vi.fn(async () => ({ success: true })),
  aiTtsStop: vi.fn(async () => ({ success: true })),
  aiTtsPause: vi.fn(async () => ({ success: true })),
  aiTtsResume: vi.fn(async () => ({ success: true })),
  aiTtsSetVoice: mocks.aiTtsSetVoice,
  aiTtsSetSpeed: mocks.aiTtsSetSpeed,
  aiTtsGetState: vi.fn(async () => ({
    initialized: false,
    isPlaying: false,
    isPaused: false,
    currentVoiceId: null,
  })),
  onAiTtsStarted: mocks.listen,
  onAiTtsFinished: mocks.listen,
  onAiTtsStopped: mocks.listen,
  onAiTtsPaused: mocks.listen,
  onAiTtsResumed: mocks.listen,
  onAiTtsError: mocks.listen,
  settingsSet: mocks.settingsSet,
  settingsSetBatch: mocks.settingsSetBatch,
}));

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: mocks.sqlLoad },
  Database: { load: mocks.sqlLoad },
}));

import { useAiTts } from "../../hooks/useAiTts";
import { useAiTtsStore } from "../../stores/ai-tts-store";

function seedStorage(
  version: number | undefined,
  selectedVoiceId: string,
): void {
  const payload: {
    state: {
      apiKey: string;
      selectedVoiceId: string;
      speed: number;
      autoPageEnabled: boolean;
    };
    version?: number;
  } = {
    state: {
      apiKey: INVALID_API_KEY_CANARY,
      selectedVoiceId,
      speed: 1.75,
      autoPageEnabled: false,
    },
  };

  if (version !== undefined) payload.version = version;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function seedVersionZeroStorage(): void {
  seedStorage(0, "safe-legacy-voice");
}

function storageEntries(storage: Storage): Record<string, string | null> {
  return Object.fromEntries(
    Array.from({ length: storage.length }, (_, index) => {
      const key = storage.key(index);
      return [key ?? `missing-${index}`, key ? storage.getItem(key) : null];
    }),
  );
}

function persistenceEvidence(): string {
  return JSON.stringify({
    localStorage: storageEntries(localStorage),
    sessionStorage: storageEntries(sessionStorage),
    settingsSet: mocks.settingsSet.mock.calls,
    settingsSetBatch: mocks.settingsSetBatch.mock.calls,
    sqliteLoad: mocks.sqlLoad.mock.calls,
    sqliteExecute: mocks.sqlExecute.mock.calls,
    sqliteSelect: mocks.sqlSelect.mock.calls,
  });
}

function clearInMemorySession(): void {
  useAiTtsStore.setState({
    initialized: false,
    apiKey: null,
    initError: null,
    playbackState: "idle",
    currentText: null,
    error: null,
    voices: [],
    selectedVoiceId: "21m00Tcm4TlvDq8ikWAM",
    speed: 1,
    autoPageEnabled: true,
    cacheCoverage: null,
  });
}

async function expectNoAutomaticInitialization(): Promise<void> {
  const { unmount } = renderHook(() => useAiTts());
  await act(async () => undefined);
  expect(mocks.aiTtsInit).not.toHaveBeenCalled();
  unmount();
}

describe("AI TTS session-secret persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    clearInMemorySession();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("drops a version-0 plaintext key while preserving safe preferences", async () => {
    seedVersionZeroStorage();

    await act(async () => {
      await useAiTtsStore.persist.rehydrate();
    });

    expect(useAiTtsStore.getState()).toMatchObject({
      apiKey: null,
      selectedVoiceId: "safe-legacy-voice",
      speed: 1.75,
      autoPageEnabled: false,
    });
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").state,
    ).not.toHaveProperty("apiKey");
    expect(persistenceEvidence()).not.toContain(INVALID_API_KEY_CANARY);
  });

  it("does not auto-initialize the provider from a legacy plaintext key", async () => {
    seedVersionZeroStorage();
    await act(async () => {
      await useAiTtsStore.persist.rehydrate();
    });

    await expectNoAutomaticInitialization();
  });

  it.each([
    { label: "no version", version: undefined, voice: "safe-no-version-voice" },
    { label: "current version 1", version: 1, voice: "safe-version-one-voice" },
  ])(
    "canonicalizes raw storage after hydrating a $label payload with an extra key",
    async ({ version, voice }) => {
      seedStorage(version, voice);

      await act(async () => {
        await useAiTtsStore.persist.rehydrate();
      });
      await expectNoAutomaticInitialization();

      expect(useAiTtsStore.getState()).toMatchObject({
        apiKey: null,
        selectedVoiceId: voice,
        speed: 1.75,
        autoPageEnabled: false,
      });
      const rawStorage = localStorage.getItem(STORAGE_KEY);
      expect(rawStorage).not.toContain(INVALID_API_KEY_CANARY);
      expect(JSON.parse(rawStorage ?? "{}")).toMatchObject({
        state: {
          selectedVoiceId: voice,
          speed: 1.75,
          autoPageEnabled: false,
        },
        version: 1,
      });
      expect(persistenceEvidence()).not.toContain(INVALID_API_KEY_CANARY);
    },
  );

  it("removes malformed persisted bytes containing a plaintext key", async () => {
    const malformedStorage = `{"state":{"apiKey":"${INVALID_API_KEY_CANARY}","selectedVoiceId":"unterminated`;
    localStorage.setItem(STORAGE_KEY, malformedStorage);

    await act(async () => {
      await useAiTtsStore.persist.rehydrate();
    });
    await expectNoAutomaticInitialization();

    expect(useAiTtsStore.getState()).toMatchObject({
      apiKey: null,
      selectedVoiceId: "21m00Tcm4TlvDq8ikWAM",
      speed: 1,
      autoPageEnabled: true,
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(persistenceEvidence()).not.toContain(INVALID_API_KEY_CANARY);
  });

  it("serializes only safe preferences after a key is set", () => {
    act(() => {
      useAiTtsStore.getState().setSelectedVoice("safe-current-voice");
      useAiTtsStore.getState().setSpeed(2.25);
      useAiTtsStore.getState().setAutoPageEnabled(false);
      useAiTtsStore.getState().setApiKey(INVALID_API_KEY_CANARY);
    });

    const persistedPayload = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "{}",
    );
    expect(persistedPayload).toMatchObject({
      state: {
        selectedVoiceId: "safe-current-voice",
        speed: 2.25,
        autoPageEnabled: false,
      },
      version: 1,
    });
    expect(persistedPayload.state).not.toHaveProperty("apiKey");
    expect(persistenceEvidence()).not.toContain(INVALID_API_KEY_CANARY);
    expect(mocks.settingsSet).not.toHaveBeenCalled();
    expect(mocks.settingsSetBatch).not.toHaveBeenCalled();
    expect(mocks.sqlLoad).not.toHaveBeenCalled();
    expect(mocks.sqlExecute).not.toHaveBeenCalled();
    expect(mocks.sqlSelect).not.toHaveBeenCalled();
  });

  it("clears the in-memory key on a normal reset", () => {
    act(() => {
      useAiTtsStore.getState().setApiKey(INVALID_API_KEY_CANARY);
      useAiTtsStore.getState().reset();
    });

    expect(useAiTtsStore.getState().apiKey).toBeNull();
  });

  it("requires key re-entry after a fresh production-store hydration", async () => {
    act(() => {
      useAiTtsStore.getState().setSelectedVoice("safe-fresh-voice");
      useAiTtsStore.getState().setApiKey(INVALID_API_KEY_CANARY);
    });

    vi.resetModules();
    const [
      { useAiTtsStore: freshStore },
      { useAiTts: useFreshAiTts },
      { AiTtsSettings },
    ] = await Promise.all([
      import("../../stores/ai-tts-store"),
      import("../../hooks/useAiTts"),
      import("../../components/playback-bar/AiTtsSettings"),
    ]);

    await act(async () => {
      await freshStore.persist.rehydrate();
    });
    const hook = renderHook(() => useFreshAiTts());
    const view = render(<AiTtsSettings />);
    await act(async () => undefined);

    expect(freshStore.getState().apiKey).toBeNull();
    expect(mocks.aiTtsInit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("ElevenLabs API Key")).toHaveValue("");
    expect(screen.getByText("API key required")).toBeVisible();
    expect(persistenceEvidence()).not.toContain(INVALID_API_KEY_CANARY);

    hook.unmount();
    view.unmount();
  });
});
