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
} from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
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
  PdfViewer: () => <div data-testid="pdf-viewer" />,
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

  mockInvoke.mockImplementation((command: string) => {
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
  });
});

async function shelf() {
  return screen.findByRole("region", { name: "Continue reading" });
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

  it("opens the document at its saved page AND drives TTS out of idle", async () => {
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
