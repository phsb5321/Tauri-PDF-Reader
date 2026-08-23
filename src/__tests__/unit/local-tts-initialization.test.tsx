import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initLocal: vi.fn(),
  listVoices: vi.fn(),
  setVoice: vi.fn(),
  setSpeed: vi.fn(),
  listen: vi.fn(async () => () => {}),
}));

vi.mock("../../lib/bindings", () => ({
  commands: { aiTtsInitLocal: mocks.initLocal },
}));

vi.mock("../../lib/tauri-invoke", () => ({
  aiTtsInit: vi.fn(),
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
  onAiTtsStopped: mocks.listen,
  onAiTtsPaused: mocks.listen,
  onAiTtsResumed: mocks.listen,
  onAiTtsError: mocks.listen,
}));

import { useAiTts } from "../../hooks/useAiTts";
import { useAiTtsStore } from "../../stores/ai-tts-store";

describe("local TTS initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAiTtsStore.setState({
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      supportsWordTimings: false,
      apiKey: null,
      initialized: false,
      initError: null,
      playbackState: "idle",
      voices: [],
      selectedVoiceId: "F1-pt",
      speed: 1,
    });
    mocks.initLocal.mockResolvedValue({
      status: "ok",
      data: {
        success: true,
        voicesCount: 1,
        provider: "local",
        supportsWordTimings: false,
        destination: "http://127.0.0.1:5301",
      },
    });
    mocks.listVoices.mockResolvedValue({
      voices: [
        {
          id: "F1-pt",
          name: "F1-pt",
          provider: "local",
          previewUrl: null,
          labels: { markKinds: [] },
        },
      ],
    });
    mocks.setVoice.mockResolvedValue({ success: true });
    mocks.setSpeed.mockResolvedValue({ success: true });
  });

  it("auto-connects from native config without passing a URL or API key", async () => {
    renderHook(() => useAiTts());

    await waitFor(() => expect(mocks.initLocal).toHaveBeenCalledTimes(1));
    expect(mocks.initLocal).toHaveBeenCalledWith();
    await waitFor(() =>
      expect(useAiTtsStore.getState().initialized).toBe(true),
    );
    expect(useAiTtsStore.getState()).toMatchObject({
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      supportsWordTimings: false,
      apiKey: null,
      selectedVoiceId: "F1-pt",
    });
    expect(mocks.listVoices).toHaveBeenCalledTimes(1);
  });

  it("keeps the provider blocked when native initialization fails", async () => {
    mocks.initLocal.mockResolvedValue({
      status: "error",
      error: "LOCAL_TTS_UNREACHABLE",
    });

    renderHook(() => useAiTts());

    await waitFor(() =>
      expect(useAiTtsStore.getState().initError).toContain(
        "LOCAL_TTS_UNREACHABLE",
      ),
    );
    expect(useAiTtsStore.getState().initialized).toBe(false);
    expect(useAiTtsStore.getState().apiKey).toBeNull();
  });
});
