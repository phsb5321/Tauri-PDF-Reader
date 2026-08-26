import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiPlaybackBar } from "../../components/playback-bar/AiPlaybackBar";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import { useDocumentStore } from "../../stores/document-store";

const h = vi.hoisted(() => ({
  complete: null as (() => void) | null,
  maxTextUtf8Bytes: 8192,
  announce: vi.fn(),
  speakWithHighlight: vi.fn(() => Promise.resolve(true)),
  prebuffer: vi.fn(() =>
    Promise.resolve({
      success: true,
      cached: true,
      wordCount: 0,
      totalDuration: 1,
    }),
  ),
}));

vi.mock("../../hooks/useAiTts", () => ({
  useAiTts: () => ({
    initialized: true,
    playbackState: "idle",
    needsApiKey: false,
    error: null,
    speak: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    clearError: vi.fn(),
    supportsWordTimings: false,
    maxTextUtf8Bytes: h.maxTextUtf8Bytes,
    connectedProviders: ["local"],
    switchingProvider: null,
  }),
}));
vi.mock("../../hooks/useTtsWordHighlight", () => ({
  useTtsWordHighlight: (options: { onComplete?: () => void }) => {
    h.complete = options.onComplete ?? null;
    return {
      isActive: false,
      isPaused: false,
      speakWithHighlight: h.speakWithHighlight,
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      currentWordIndex: -1,
      wordTimings: [],
    };
  },
}));
vi.mock("../../hooks/useAudioCache", () => ({ useAudioCache: vi.fn() }));
vi.mock("../../hooks/useAnnounce", () => ({
  useAnnounce: () => ({ announce: h.announce }),
  ANNOUNCEMENTS: {
    ttsPlaying: () => "playing",
    ttsPaused: () => "paused",
    ttsStopped: () => "stopped",
  },
}));
vi.mock("../../lib/api/ai-tts", () => ({ aiTtsPrebuffer: h.prebuffer }));
vi.mock("../../components/playback-bar/AiVoiceSelector", () => ({
  AiVoiceSelector: () => null,
}));
vi.mock("../../components/playback-bar/AiSpeedSlider", () => ({
  AiSpeedSlider: () => null,
}));
vi.mock("../../components/audio-progress/AudioCacheProgress", () => ({
  AudioCacheProgress: () => null,
}));
vi.mock("../../components/export-dialog/AudioExportDialog", () => ({
  AudioExportDialog: () => null,
}));
vi.mock("../../components/playback-bar/AiTtsSettings", () => ({
  AiTtsSettings: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  h.complete = null;
  h.maxTextUtf8Bytes = 8192;
  useAiTtsStore.setState({
    provider: "local",
    supportsWordTimings: false,
    maxTextUtf8Bytes: 8192,
    selectedVoiceId: "F1-en",
    providerVoiceIds: {
      ...useAiTtsStore.getState().providerVoiceIds,
      local: "F1-en",
    },
    autoPageEnabled: false,
    naturalCompletionCount: 0,
    error: null,
  });
  useDocumentStore.setState({
    currentPage: 1,
    totalPages: 2,
    currentDocument: { id: "doc" } as never,
    pdfDocument: {} as never,
  });
});

describe("local sentence playback", () => {
  it("starts sentence zero, prefetches one ahead, then advances in order", async () => {
    render(
      <AiPlaybackBar
        getText={() => Promise.resolve("First sentence. Second sentence.")}
      />,
    );

    fireEvent.click(screen.getByTitle("Play (Ctrl+Space)"));
    await waitFor(() =>
      expect(h.speakWithHighlight).toHaveBeenCalledWith(
        "First sentence.",
        1,
        "F1-en",
        0,
      ),
    );
    expect(h.prebuffer).toHaveBeenCalledWith("Second sentence.", "F1-en");

    await act(async () => h.complete?.());
    await waitFor(() =>
      expect(h.speakWithHighlight).toHaveBeenLastCalledWith(
        "Second sentence.",
        1,
        "F1-en",
        16,
      ),
    );
    expect(h.speakWithHighlight).toHaveBeenCalledTimes(2);
    expect(h.announce).not.toHaveBeenCalledWith("stopped");

    await act(async () => h.complete?.());
    await waitFor(() => expect(h.announce).toHaveBeenCalledWith("stopped"));
  });

  it("surfaces a provider-bound error when one grapheme cannot be split", async () => {
    h.maxTextUtf8Bytes = 3;
    render(<AiPlaybackBar getText={() => Promise.resolve("😀")} />);

    fireEvent.click(screen.getByTitle("Play (Ctrl+Space)"));
    await waitFor(() =>
      expect(useAiTtsStore.getState().error).toContain("TTS_TEXT_BOUND"),
    );
    expect(h.speakWithHighlight).not.toHaveBeenCalled();
  });
});
