import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const mocks = vi.hoisted(() => ({
  initElevenLabs: vi.fn(),
  initGroq: vi.fn(),
  switchProvider: vi.fn(),
  listVoices: vi.fn(),
  setVoice: vi.fn(async () => ({ success: true })),
  setSpeed: vi.fn(async () => ({ success: true })),
  listen: vi.fn(async () => () => {}),
}));

vi.mock("../../lib/bindings", () => ({
  commands: {
    aiTtsInitGroq: mocks.initGroq,
    aiTtsSwitchProvider: mocks.switchProvider,
    aiTtsInitLocal: vi.fn(),
  },
}));

vi.mock("../../lib/tauri-invoke", () => ({
  aiTtsInit: mocks.initElevenLabs,
  aiTtsListVoices: mocks.listVoices,
  aiTtsSpeak: vi.fn(),
  aiTtsStop: vi.fn(),
  aiTtsPause: vi.fn(),
  aiTtsResume: vi.fn(),
  aiTtsSetVoice: mocks.setVoice,
  aiTtsSetSpeed: mocks.setSpeed,
  aiTtsGetState: vi.fn(),
  onAiTtsStarted: mocks.listen,
  onAiTtsFinished: mocks.listen,
  onAiTtsPlaybackStarting: mocks.listen,
  onAiTtsStopped: mocks.listen,
  onAiTtsPaused: mocks.listen,
  onAiTtsResumed: mocks.listen,
  onAiTtsError: mocks.listen,
}));

import { useAiTts } from "../../hooks/useAiTts";
import { useAiTtsStore } from "../../stores/ai-tts-store";

beforeEach(() => {
  vi.clearAllMocks();
  const current = useAiTtsStore.getState();
  useAiTtsStore.setState({
    provider: "elevenlabs",
    initialized: false,
    apiKey: null,
    initError: null,
    error: null,
    playbackState: "idle",
    voices: [],
    providerOperationGeneration: 0,
    switchingProvider: null,
    connections: {
      elevenlabs: {
        ...current.connections.elevenlabs,
        status: "setup",
        error: null,
      },
      local: { ...current.connections.local, status: "setup", error: null },
      groq: { ...current.connections.groq, status: "setup", error: null },
    },
  });
  mocks.switchProvider.mockImplementation(async (provider: string) => ({
    status: "ok",
    data: {
      success: true,
      provider,
      voicesCount: provider === "groq" ? 6 : 1,
      supportsWordTimings: provider === "elevenlabs",
      maxTextUtf8Bytes: provider === "groq" ? 200 : 10_000,
    },
  }));
  mocks.listVoices.mockResolvedValue({
    voices: [
      {
        id: "autumn",
        name: "Autumn",
        provider: "groq",
        previewUrl: null,
        labels: null,
      },
    ],
  });
});

describe("provider connection races", () => {
  it("does not let stale activation finalization clear the newer loading operation", async () => {
    const current = useAiTtsStore.getState();
    current.setConnectionStatus("elevenlabs", "connected");
    current.setConnectionStatus("groq", "connected");
    current.setInitialized(true);
    const older = deferred<unknown>();
    const newer = deferred<unknown>();
    mocks.switchProvider
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const { result } = renderHook(() => useAiTts());
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.switchProvider("elevenlabs");
      second = result.current.switchProvider("groq");
    });
    const response = {
      status: "ok",
      data: {
        success: true,
        provider: "groq",
        voicesCount: 1,
        supportsWordTimings: false,
        maxTextUtf8Bytes: 200,
      },
    };
    await act(async () => {
      older.resolve({
        ...response,
        data: { ...response.data, provider: "elevenlabs" },
      });
      expect(await first).toBe(false);
    });
    expect(useAiTtsStore.getState()).toMatchObject({
      switchingProvider: "groq",
      playbackState: "loading",
    });
    await act(async () => {
      newer.resolve(response);
      expect(await second).toBe(true);
    });
    expect(useAiTtsStore.getState()).toMatchObject({
      switchingProvider: null,
      playbackState: "idle",
      provider: "groq",
    });
  });

  it("retires a failed current activation without masking its error", async () => {
    useAiTtsStore.getState().setConnectionStatus("groq", "connected");
    mocks.switchProvider.mockResolvedValueOnce({
      status: "error",
      error: "synthetic switch failure",
    });
    const { result } = renderHook(() => useAiTts());
    await act(async () => {
      expect(await result.current.switchProvider("groq")).toBe(false);
    });
    expect(useAiTtsStore.getState()).toMatchObject({
      switchingProvider: null,
      playbackState: "error",
      error: "synthetic switch failure",
    });
  });

  it("keeps a failed reconnect ready on its previously validated client", async () => {
    useAiTtsStore.setState({
      provider: "local",
      initialized: true,
      connections: {
        ...useAiTtsStore.getState().connections,
        local: {
          ...useAiTtsStore.getState().connections.local,
          status: "connected",
        },
        groq: {
          ...useAiTtsStore.getState().connections.groq,
          status: "connected",
        },
      },
    });
    mocks.initGroq.mockResolvedValue({
      status: "error",
      error: "GROQ_AUTH: rejected",
    });
    const { result } = renderHook(() => useAiTts());

    await act(async () => {
      await result.current.initializeGroq("replacement-key");
    });

    expect(useAiTtsStore.getState().connections.groq).toMatchObject({
      status: "connected",
      error: "GROQ_AUTH: rejected",
    });
    expect(useAiTtsStore.getState().provider).toBe("local");
    expect(useAiTtsStore.getState().initialized).toBe(true);
  });

  it("keeps a slow older connection ready without stealing activation", async () => {
    const eleven = deferred<{
      success: boolean;
      voicesCount: number;
      provider: "elevenlabs";
      supportsWordTimings: boolean;
      maxTextUtf8Bytes: number;
    }>();
    const groq = deferred<{
      status: "ok";
      data: {
        success: boolean;
        voicesCount: number;
        provider: "groq";
        supportsWordTimings: boolean;
        maxTextUtf8Bytes: number;
      };
    }>();
    mocks.initElevenLabs.mockReturnValue(eleven.promise);
    mocks.initGroq.mockReturnValue(groq.promise);
    const { result } = renderHook(() => useAiTts());

    let slow!: Promise<void>;
    let latest!: Promise<void>;
    act(() => {
      slow = result.current.initialize("elevenlabs-fixture-key");
      latest = result.current.initializeGroq("groq-fixture-key");
    });
    await act(async () => {
      groq.resolve({
        status: "ok",
        data: {
          success: true,
          voicesCount: 6,
          provider: "groq",
          supportsWordTimings: false,
          maxTextUtf8Bytes: 200,
        },
      });
      await latest;
    });
    await act(async () => {
      eleven.resolve({
        success: true,
        voicesCount: 1,
        provider: "elevenlabs",
        supportsWordTimings: true,
        maxTextUtf8Bytes: 10_000,
      });
      await slow;
    });

    expect(useAiTtsStore.getState().provider).toBe("groq");
    expect(useAiTtsStore.getState().connections.groq.status).toBe("connected");
    expect(useAiTtsStore.getState().connections.elevenlabs.status).toBe(
      "connected",
    );
    expect(mocks.switchProvider).toHaveBeenCalledTimes(1);
    expect(mocks.switchProvider).toHaveBeenCalledWith("groq");
  });
});
