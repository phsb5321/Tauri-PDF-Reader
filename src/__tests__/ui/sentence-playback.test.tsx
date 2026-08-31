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
import {
  markPdfPageReady,
  resetPdfPageReadyForTests,
} from "../../lib/pdf-page-ready";

const h = vi.hoisted(() => ({
  complete: null as (() => void) | null,
  maxTextUtf8Bytes: 8192,
  playbackState: "idle" as "idle" | "playing",
  announce: vi.fn(),
  speakWithHighlight: vi.fn(() => Promise.resolve(true)),
  stop: vi.fn(() => Promise.resolve()),
  getPage: vi.fn(() =>
    Promise.resolve({
      getTextContent: () =>
        Promise.resolve({ items: [{ str: "Page two sentence." }] }),
    }),
  ),
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
    playbackState: h.playbackState,
    needsApiKey: false,
    error: null,
    speak: vi.fn(),
    stop: h.stop,
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
vi.mock("../../services/pdf-service", () => ({
  pdfService: { getPage: h.getPage },
}));
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
  h.playbackState = "idle";
  resetPdfPageReadyForTests();
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
    performanceProfile: "balanced",
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
        [
          {
            spokenStart: 0,
            spokenEnd: 15,
            sourceStart: 0,
            sourceEnd: 15,
            kind: "copy",
          },
        ],
        "sentence",
      ),
    );
    expect(h.prebuffer).toHaveBeenCalledWith(
      "Second sentence.",
      "F1-en",
      "sentence",
    );

    await act(async () => h.complete?.());
    await waitFor(() =>
      expect(h.speakWithHighlight).toHaveBeenLastCalledWith(
        "Second sentence.",
        1,
        "F1-en",
        16,
        [
          {
            spokenStart: 0,
            spokenEnd: 16,
            sourceStart: 0,
            sourceEnd: 16,
            kind: "copy",
          },
        ],
        "sentence",
      ),
    );
    expect(h.speakWithHighlight).toHaveBeenCalledTimes(2);
    expect(h.announce).not.toHaveBeenCalledWith("stopped");

    await act(async () => h.complete?.());
    await waitFor(() => expect(h.announce).toHaveBeenCalledWith("stopped"));
  });

  it("keeps first audio short and prefetches later sentences in one context", async () => {
    render(
      <AiPlaybackBar
        getText={() =>
          Promise.resolve("First sentence is long enough. Second. Third.")
        }
      />,
    );

    fireEvent.click(screen.getByTitle("Play (Ctrl+Space)"));
    await waitFor(() =>
      expect(h.speakWithHighlight).toHaveBeenCalledWith(
        "First sentence is long enough.",
        1,
        "F1-en",
        0,
        expect.any(Array),
        "sentence",
      ),
    );
    expect(h.prebuffer).toHaveBeenCalledWith(
      "Second. Third.",
      "F1-en",
      "sentence",
    );

    await act(async () => h.complete?.());
    await waitFor(() =>
      expect(h.speakWithHighlight).toHaveBeenLastCalledWith(
        "Second. Third.",
        1,
        "F1-en",
        31,
        expect.any(Array),
        "sentence",
      ),
    );
  });

  it("queues two Continuous look-ahead units sequentially", async () => {
    let releaseFirst: (() => void) | undefined;
    h.prebuffer.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = () =>
            resolve({
              success: true,
              cached: false,
              wordCount: 0,
              totalDuration: 8,
            });
        }),
    );
    useAiTtsStore.setState({ performanceProfile: "continuous" });
    const unit = (label: string) =>
      `${label} ${"bounded context ".repeat(11)}ends.`;
    const text = [unit("One"), unit("Two"), unit("Three"), unit("Four")].join(
      " ",
    );
    render(<AiPlaybackBar getText={() => Promise.resolve(text)} />);

    fireEvent.click(screen.getByTitle("Play (Ctrl+Space)"));
    await waitFor(() => expect(h.prebuffer).toHaveBeenCalledTimes(1));
    expect(h.prebuffer.mock.calls[0]?.[0]).toMatch(/^Two /u);

    await act(async () => releaseFirst?.());
    await waitFor(() => expect(h.prebuffer).toHaveBeenCalledTimes(2));
    expect(h.prebuffer.mock.calls[1]?.[0]).toMatch(/^Three /u);
  });

  it("invalidates queued and future prefetch work on a reader page turn", async () => {
    h.playbackState = "playing";
    let releaseFirst: (() => void) | undefined;
    h.prebuffer.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = () =>
            resolve({
              success: true,
              cached: false,
              wordCount: 0,
              totalDuration: 8,
            });
        }),
    );
    useAiTtsStore.setState({ performanceProfile: "continuous" });
    const unit = (label: string) =>
      `${label} ${"bounded context ".repeat(11)}ends.`;
    render(
      <AiPlaybackBar
        getText={() =>
          Promise.resolve(
            [unit("One"), unit("Two"), unit("Three"), unit("Four")].join(" "),
          )
        }
      />,
    );

    fireEvent.click(screen.getByTitle("Play (Ctrl+Space)"));
    await waitFor(() => expect(h.prebuffer).toHaveBeenCalledTimes(1));
    act(() => useDocumentStore.getState().setCurrentPage(2));
    await waitFor(() => expect(h.stop).toHaveBeenCalledTimes(1));
    await act(async () => releaseFirst?.());
    await act(async () => h.complete?.());

    expect(h.prebuffer).toHaveBeenCalledTimes(1);
    expect(h.speakWithHighlight).toHaveBeenCalledTimes(1);
  });

  it("continues exactly once only after the next page render is ready", async () => {
    useAiTtsStore.setState({ autoPageEnabled: true });
    render(<AiPlaybackBar getText={() => Promise.resolve("Page one.")} />);

    fireEvent.click(screen.getByTitle("Play (Ctrl+Space)"));
    await waitFor(() => expect(h.speakWithHighlight).toHaveBeenCalledTimes(1));
    await act(async () => h.complete?.());
    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(2),
    );
    expect(h.getPage).not.toHaveBeenCalled();
    expect(h.speakWithHighlight).toHaveBeenCalledTimes(1);

    act(() => {
      markPdfPageReady(2);
    });
    await waitFor(() =>
      expect(h.speakWithHighlight).toHaveBeenLastCalledWith(
        "Page two sentence.",
        2,
        "F1-en",
        0,
        expect.any(Array),
        "sentence",
      ),
    );
    expect(h.speakWithHighlight).toHaveBeenCalledTimes(2);

    act(() => {
      markPdfPageReady(2);
    });
    await act(async () => Promise.resolve());
    expect(h.speakWithHighlight).toHaveBeenCalledTimes(2);
  });

  it("surfaces TTS_PAGE_NOT_READY instead of silently freezing", async () => {
    vi.useFakeTimers();
    try {
      useAiTtsStore.setState({ autoPageEnabled: true });
      render(<AiPlaybackBar getText={() => Promise.resolve("Page one.")} />);

      fireEvent.click(screen.getByTitle("Play (Ctrl+Space)"));
      await act(async () => Promise.resolve());
      expect(h.speakWithHighlight).toHaveBeenCalledTimes(1);
      await act(async () => h.complete?.());
      expect(useDocumentStore.getState().currentPage).toBe(2);

      await act(async () => vi.advanceTimersByTimeAsync(8_000));
      expect(useAiTtsStore.getState().error).toBe(
        "TTS_PAGE_NOT_READY: Page 2 did not finish rendering",
      );
      expect(h.speakWithHighlight).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps Stop operable while the next page render is pending", async () => {
    useAiTtsStore.setState({ autoPageEnabled: true });
    render(<AiPlaybackBar getText={() => Promise.resolve("Page one.")} />);

    fireEvent.click(screen.getByTitle("Play (Ctrl+Space)"));
    await waitFor(() => expect(h.speakWithHighlight).toHaveBeenCalledTimes(1));
    await act(async () => h.complete?.());
    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(2),
    );

    const stop = screen.getByTitle("Stop (Esc)");
    expect(stop).toBeEnabled();
    fireEvent.click(stop);
    act(() => markPdfPageReady(2));
    await act(async () => Promise.resolve());

    expect(h.speakWithHighlight).toHaveBeenCalledTimes(1);
    expect(useAiTtsStore.getState().error).toBeNull();
  });

  it("cancels a pending page handoff when navigation moves elsewhere", async () => {
    h.playbackState = "playing";
    useAiTtsStore.setState({ autoPageEnabled: true });
    useDocumentStore.setState({ totalPages: 3 });
    render(<AiPlaybackBar getText={() => Promise.resolve("Page one.")} />);

    fireEvent.click(screen.getByTitle("Play (Ctrl+Space)"));
    await waitFor(() => expect(h.speakWithHighlight).toHaveBeenCalledTimes(1));
    await act(async () => h.complete?.());
    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(2),
    );

    act(() => useDocumentStore.getState().setCurrentPage(3));
    act(() => {
      markPdfPageReady(2);
    });
    await act(async () => Promise.resolve());

    expect(h.speakWithHighlight).toHaveBeenCalledTimes(1);
    expect(h.getPage).not.toHaveBeenCalled();
  });

  it("synthesizes a spoken-only period while retaining source queue offsets", async () => {
    const text =
      "storage, ingestion, transformation, and serving Since the dawn";
    render(<AiPlaybackBar getText={() => Promise.resolve(text)} />);

    fireEvent.click(screen.getByTitle("Play (Ctrl+Space)"));
    await waitFor(() =>
      expect(h.speakWithHighlight).toHaveBeenCalledWith(
        "storage, ingestion, transformation, and serving.",
        1,
        "F1-en",
        0,
        expect.arrayContaining([
          expect.objectContaining({
            kind: "insert",
            sourceStart: null,
            sourceEnd: null,
          }),
        ]),
        "sentence",
      ),
    );

    await act(async () => h.complete?.());
    await waitFor(() =>
      expect(h.speakWithHighlight).toHaveBeenLastCalledWith(
        "Since the dawn",
        1,
        "F1-en",
        48,
        expect.any(Array),
        "clause",
      ),
    );
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
