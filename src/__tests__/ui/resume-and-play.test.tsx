/**
 * "Resume and play" — the catch-up shelf's opt-in narration action.
 *
 * Lectrice reads aloud; today resuming a book lands on the page and stops,
 * leaving Play as a separate act. This is the secondary, explicit action that
 * does both in one: land on the stored page AND start narrating — while the
 * PLAIN resume (the row's main click) stays exactly as it was, so a reader
 * who wants to read silently is never ambushed by audio.
 *
 * Mounts the real shell end to end: `ReaderView`, the real `ResumeSection`
 * row, and the real `AiPlaybackBar` (unlike `reading-home.test.tsx`, which
 * stubs it — the claim here is specifically that the TTS state machine
 * leaves `idle`, which a stub can't prove). Only the Tauri IPC boundary and
 * `pdf-service` are mocked.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
  act,
} from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { listen } from "@tauri-apps/api/event";
import { mockInvoke } from "../../../tests/setup";
import { ReaderView } from "../../components/reader/ReaderView";
import { useDocumentStore } from "../../stores/document-store";
import { useLibraryStore } from "../../stores/library-store";
import { useCollectionsStore } from "../../stores/collections-store";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import { useTtsHighlightStore } from "../../stores/tts-highlight-store";
import type { Document } from "../../lib/schemas";

vi.mock("../../services/pdf-service", () => ({
  pdfService: {
    loadDocument: vi.fn(),
    getPage: vi.fn().mockResolvedValue({
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: "It was the best of times." }],
      }),
    }),
  },
}));
vi.mock("../../components/PdfViewer", () => ({
  PdfViewer: ({
    onReadFromHere,
  }: {
    onReadFromHere?: (text: string, baseOffset: number) => void;
  }) => (
    <div data-testid="pdf-viewer">
      <button
        type="button"
        onClick={() =>
          onReadFromHere?.("Selected tail starts exactly here.", 37)
        }
      >
        Read from here
      </button>
      <button
        type="button"
        onClick={() => onReadFromHere?.("Latest selection wins here.", 73)}
      >
        Read latest selection
      </button>
      <button
        type="button"
        onClick={() => onReadFromHere?.("In 2022, 91,000 readers.", 100)}
      >
        Read numbered selection
      </button>
    </div>
  ),
}));

const { pdfService } = await import("../../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);

const IN_FLIGHT: Document = {
  id: "doc-1",
  filePath: "/books/moby-dick.pdf",
  title: "Moby-Dick",
  pageCount: 585,
  currentPage: 213,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: "2026-07-30T10:00:00Z",
  fileHash: null,
  createdAt: "2026-07-01T00:00:00Z",
} as Document;

function invokeFixture(command: string) {
  switch (command) {
    case "library_list_documents":
      return Promise.resolve([IN_FLIGHT]);
    case "collections_list":
    case "collections_list_memberships":
      return Promise.resolve([]);
    case "library_heal_document":
    case "library_open_document":
      return Promise.resolve(IN_FLIGHT);
    case "ai_tts_speak_with_timestamps":
      return Promise.resolve({
        success: true,
        wordTimings: [],
        totalDuration: 2.4,
      });
    case "ai_tts_get_state":
      return Promise.resolve({
        initialized: true,
        isPlaying: false,
        isPaused: false,
        currentVoiceId: null,
      });
    default:
      return Promise.resolve(null);
  }
}

beforeEach(() => {
  useDocumentStore.getState().reset();
  useLibraryStore.getState().reset();
  useCollectionsStore.getState().reset();
  useAiTtsStore.getState().reset();
  useTtsHighlightStore.getState().reset();
  useAiTtsStore.setState({
    provider: "elevenlabs",
    localUrl: null,
    supportsWordTimings: true,
  });
  loadDocument.mockReset();
  loadDocument.mockResolvedValue({
    numPages: 585,
  } as unknown as PDFDocumentProxy);

  mockInvoke.mockImplementation(invokeFixture);
});

async function shelf() {
  return screen.findByRole("region", { name: "Continue reading" });
}

function emitStopped(generation = 1): void {
  for (const [event, callback] of [...vi.mocked(listen).mock.calls]) {
    if (event === "ai-tts:stopped") {
      callback({ event, id: 0, payload: generation });
    }
  }
}

describe("resume and play", () => {
  it("builds a duration-bound read-along for a keyless local provider", async () => {
    useAiTtsStore.setState({
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      supportsWordTimings: false,
      apiKey: null,
      initialized: true,
      selectedVoiceId: "F1-pt",
    });

    render(<ReaderView />);
    const row = await within(await shelf()).findByRole("button", {
      name: /Resume Moby-Dick and start reading aloud/,
    });
    fireEvent.click(row);

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("ai_tts_speak_with_timestamps", {
        text: "It was the best of times.",
        voiceId: "F1-pt",
        boundaryAfter: "sentence",
      }),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "ai_tts_speak",
      expect.anything(),
    );
    await waitFor(() =>
      expect(useTtsHighlightStore.getState().wordTimings).toHaveLength(6),
    );
    expect(useTtsHighlightStore.getState().totalDuration).toBe(2.4);
    expect(useAiTtsStore.getState().playbackState).not.toBe("idle");
    expect(
      screen.queryByText(/AI TTS requires an ElevenLabs API key/),
    ).toBeNull();
  });

  it("plays once from the shelf and cannot replay after plain remount", async () => {
    // A key is already connected this session (session-only per #73) — the
    // realistic case this action is for.
    useAiTtsStore.setState({ apiKey: "test-key", initialized: true });

    render(<ReaderView />);
    const row = await within(await shelf()).findByRole("button", {
      name: /Resume Moby-Dick and start reading aloud/,
    });
    fireEvent.click(row);

    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    expect(useDocumentStore.getState().currentPage).toBe(213);

    await waitFor(() =>
      expect(useAiTtsStore.getState().playbackState).not.toBe("idle"),
    );
    expect(useAiTtsStore.getState().playbackState).toBe("playing");

    fireEvent.click(screen.getByTitle("Stop (Esc)"));
    await waitFor(() =>
      expect(useAiTtsStore.getState().playbackState).toBe("idle"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Back to library" }));
    await shelf();

    mockInvoke.mockClear();
    const plainResume = await within(await shelf()).findByRole("button", {
      name: /^Resume Moby-Dick, page 213 of 585, 36%/,
    });
    fireEvent.click(plainResume);
    await screen.findByTestId("pdf-viewer");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "ai_tts_speak_with_timestamps",
      expect.anything(),
    );
    expect(useAiTtsStore.getState().playbackState).toBe("idle");
  });

  it("Read from here replaces paused narration instead of resuming it", async () => {
    useAiTtsStore.setState({
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      supportsWordTimings: false,
      apiKey: null,
      initialized: true,
      selectedVoiceId: "F1-pt",
    });

    render(<ReaderView />);
    const plainResume = await within(await shelf()).findByRole("button", {
      name: /^Resume Moby-Dick, page 213 of 585, 36%/,
    });
    fireEvent.click(plainResume);
    await screen.findByTestId("pdf-viewer");

    useTtsHighlightStore.getState().startHighlighting(
      "Old narration remains paused.",
      [
        {
          word: "Old",
          startTime: 0,
          endTime: 1,
          charStart: 0,
          charEnd: 3,
        },
      ],
      4,
      213,
    );
    useTtsHighlightStore.getState().pauseHighlighting();
    useAiTtsStore.setState({ playbackState: "paused" });
    mockInvoke.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Read from here" }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("ai_tts_speak_with_timestamps", {
        text: "Selected tail starts exactly here.",
        voiceId: "F1-pt",
        boundaryAfter: "sentence",
      }),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith("ai_tts_resume");
    await waitFor(() =>
      expect(useTtsHighlightStore.getState().wordTimings[0]?.charStart).toBe(
        37,
      ),
    );
  });

  it("binds rapid replacement to the latest selection while Stop is in flight", async () => {
    useAiTtsStore.setState({
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      supportsWordTimings: false,
      apiKey: null,
      initialized: true,
      selectedVoiceId: "F1-pt",
    });

    render(<ReaderView />);
    const plainResume = await within(await shelf()).findByRole("button", {
      name: /^Resume Moby-Dick, page 213 of 585, 36%/,
    });
    fireEvent.click(plainResume);
    await screen.findByTestId("pdf-viewer");

    let releaseStop: (() => void) | undefined;
    const stopGate = new Promise<void>((resolve) => {
      releaseStop = resolve;
    });
    mockInvoke.mockClear();
    mockInvoke.mockImplementation((command: string) =>
      command === "ai_tts_stop" ? stopGate : invokeFixture(command),
    );

    fireEvent.click(screen.getByRole("button", { name: "Read from here" }));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("ai_tts_stop"));
    fireEvent.click(
      screen.getByRole("button", { name: "Read latest selection" }),
    );
    await waitFor(
      () =>
        expect(
          mockInvoke.mock.calls.filter(
            ([command]) => command === "ai_tts_stop",
          ),
        ).toHaveLength(2),
      { timeout: 2_000 },
    );

    await act(async () => releaseStop?.());
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "ai_tts_speak_with_timestamps",
        expect.objectContaining({ text: "Latest selection wins here." }),
      ),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "ai_tts_speak_with_timestamps",
      expect.objectContaining({ text: "Selected tail starts exactly here." }),
    );
    await waitFor(() =>
      expect(useTtsHighlightStore.getState().wordTimings[0]?.charStart).toBe(
        73,
      ),
    );
  });

  it("cancels an in-flight selection replacement when the page changes", async () => {
    useAiTtsStore.setState({
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      supportsWordTimings: false,
      apiKey: null,
      initialized: true,
      selectedVoiceId: "F1-pt",
    });

    render(<ReaderView />);
    const plainResume = await within(await shelf()).findByRole("button", {
      name: /^Resume Moby-Dick, page 213 of 585, 36%/,
    });
    fireEvent.click(plainResume);
    await screen.findByTestId("pdf-viewer");

    let releaseStop: (() => void) | undefined;
    const stopGate = new Promise<void>((resolve) => {
      releaseStop = resolve;
    });
    mockInvoke.mockClear();
    mockInvoke.mockImplementation((command: string) =>
      command === "ai_tts_stop" ? stopGate : invokeFixture(command),
    );

    fireEvent.click(screen.getByRole("button", { name: "Read from here" }));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("ai_tts_stop"));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(214),
    );
    await act(async () => releaseStop?.());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "ai_tts_speak_with_timestamps",
      expect.anything(),
    );
  });

  it("normalizes selected numbers while preserving their source offset", async () => {
    useAiTtsStore.setState({
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      supportsWordTimings: false,
      apiKey: null,
      initialized: true,
      selectedVoiceId: "John-en",
      narrationLanguage: "auto",
      numberNormalizationEnabled: true,
    });

    render(<ReaderView />);
    const plainResume = await within(await shelf()).findByRole("button", {
      name: /^Resume Moby-Dick, page 213 of 585, 36%/,
    });
    fireEvent.click(plainResume);
    await screen.findByTestId("pdf-viewer");
    mockInvoke.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: "Read numbered selection" }),
    );

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "ai_tts_speak_with_timestamps",
        expect.objectContaining({
          text: "In two thousand twenty-two, ninety-one thousand readers.",
        }),
      ),
    );
    await waitFor(() => {
      const two = useTtsHighlightStore
        .getState()
        .wordTimings.find((timing) => timing.word === "two");
      expect(two).toMatchObject({ charStart: 103, charEnd: 107 });
    });
  });

  it("ordinary footer Play still resumes paused narration", async () => {
    useAiTtsStore.setState({
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      supportsWordTimings: false,
      apiKey: null,
      initialized: true,
      selectedVoiceId: "F1-pt",
    });

    render(<ReaderView />);
    const plainResume = await within(await shelf()).findByRole("button", {
      name: /^Resume Moby-Dick, page 213 of 585, 36%/,
    });
    fireEvent.click(plainResume);
    await screen.findByTestId("pdf-viewer");

    useTtsHighlightStore.getState().startHighlighting(
      "Old narration remains paused.",
      [
        {
          word: "Old",
          startTime: 0,
          endTime: 1,
          charStart: 0,
          charEnd: 3,
        },
      ],
      4,
      213,
    );
    useTtsHighlightStore.getState().pauseHighlighting();
    useAiTtsStore.setState({ playbackState: "paused" });
    mockInvoke.mockClear();

    fireEvent.click(await screen.findByTitle("Resume (Ctrl+Space)"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("ai_tts_resume"),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "ai_tts_speak_with_timestamps",
      expect.anything(),
    );
  });

  it("Read from here starts after Stop and cannot replay after remount", async () => {
    useAiTtsStore.setState({
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      supportsWordTimings: false,
      apiKey: null,
      initialized: true,
      selectedVoiceId: "F1-pt",
    });

    render(<ReaderView />);
    const plainResume = await within(await shelf()).findByRole("button", {
      name: /^Resume Moby-Dick, page 213 of 585, 36%/,
    });
    fireEvent.click(plainResume);
    await screen.findByTestId("pdf-viewer");

    const readFromHere = screen.getByRole("button", {
      name: "Read from here",
    });
    fireEvent.click(readFromHere);
    await waitFor(() =>
      expect(useAiTtsStore.getState().playbackState).toBe("playing"),
    );
    fireEvent.click(screen.getByTitle("Stop (Esc)"));
    await waitFor(() =>
      expect(useAiTtsStore.getState().playbackState).toBe("idle"),
    );

    mockInvoke.mockClear();
    fireEvent.click(readFromHere);
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "ai_tts_speak_with_timestamps",
        expect.objectContaining({ text: "Selected tail starts exactly here." }),
      ),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith("ai_tts_resume");

    await waitFor(() =>
      expect(useAiTtsStore.getState().playbackState).toBe("playing"),
    );
    fireEvent.click(screen.getByTitle("Stop (Esc)"));
    await waitFor(() =>
      expect(useAiTtsStore.getState().playbackState).toBe("idle"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Back to library" }));
    await shelf();

    mockInvoke.mockClear();
    const resumeAfterRemount = await within(await shelf()).findByRole(
      "button",
      { name: /^Resume Moby-Dick, page 213 of 585, 36%/ },
    );
    fireEvent.click(resumeAfterRemount);
    await screen.findByTestId("pdf-viewer");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "ai_tts_speak_with_timestamps",
      expect.anything(),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith("ai_tts_resume");
    expect(useAiTtsStore.getState().playbackState).toBe("idle");
  });

  it("makes fresh Play immediately available after a manual next page", async () => {
    useAiTtsStore.setState({
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      supportsWordTimings: false,
      apiKey: null,
      initialized: true,
      selectedVoiceId: "F1-pt",
    });

    render(<ReaderView />);
    const plainResume = await within(await shelf()).findByRole("button", {
      name: /^Resume Moby-Dick, page 213 of 585, 36%/,
    });
    fireEvent.click(plainResume);
    await screen.findByTestId("pdf-viewer");
    fireEvent.click(screen.getByRole("button", { name: "Read from here" }));
    await waitFor(() =>
      expect(useAiTtsStore.getState().playbackState).toBe("playing"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(214),
    );
    act(() => emitStopped());
    await waitFor(() =>
      expect(useAiTtsStore.getState().playbackState).toBe("idle"),
    );
    expect(useTtsHighlightStore.getState().isActive).toBe(false);

    const play = await screen.findByTitle("Play (Ctrl+Space)");
    expect(play).toBeEnabled();
    mockInvoke.mockClear();
    fireEvent.click(play);
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "ai_tts_speak_with_timestamps",
        expect.objectContaining({ text: "It was the best of times." }),
      ),
    );
  });

  it("the plain resume click still does NOT start playback", async () => {
    useAiTtsStore.setState({ apiKey: "test-key", initialized: true });

    render(<ReaderView />);
    const plainResume = await within(await shelf()).findByRole("button", {
      name: /^Resume Moby-Dick, page 213 of 585, 36%/,
    });
    fireEvent.click(plainResume);

    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    // Give any (wrongly) triggered playback a tick to start, then assert it
    // never did — this is the regression that would hurt most.
    await new Promise((r) => setTimeout(r, 50));
    expect(useAiTtsStore.getState().playbackState).toBe("idle");
  });

  it("degrades honestly with no API key: still resumes, never starts audio", async () => {
    // Fresh launch — no key (session-only, #73).
    render(<ReaderView />);
    const row = await within(await shelf()).findByRole("button", {
      name: /Resume Moby-Dick and start reading aloud/,
    });
    fireEvent.click(row);

    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    expect(useDocumentStore.getState().currentPage).toBe(213);
    // No crash, and playback never starts without a key.
    expect(useAiTtsStore.getState().playbackState).toBe("idle");
    // The existing, truthful setup prompt is what the reader sees instead of
    // a silent no-op — not a new affordance invented for this slice.
    expect(
      await screen.findByText(/AI TTS requires an ElevenLabs API key/),
    ).toBeInTheDocument();
  });
});
