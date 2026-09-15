/**
 * Slice 109 — the four release blockers, jsdom half.
 *
 * B1  Toolbar Open loads the book but never shows the reader (the native
 *     File->Open menu is hidden on packaged Linux, so the toolbar button is
 *     the ONLY visible open path).
 * B2  A wrong ElevenLabs key fails silently — the dialog closes on failure
 *     and initError has no UI consumer.
 * B3  Settings -> Text-to-Speech is a dead legacy panel that can only ever
 *     say "not available".
 * B4  A failed open (corrupt/password PDF) is silent on the library surface.
 *
 * The packaged half lives in e2e/critical-loop.e2e.mjs (B1) — this file
 * pins the wiring; the lane proves it in the built app.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { mockInvoke } from "../../../tests/setup";
import { ReaderView } from "../../components/reader/ReaderView";
import { useDocumentStore } from "../../stores/document-store";
import { useLibraryStore } from "../../stores/library-store";
import { useCollectionsStore } from "../../stores/collections-store";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import { AiTtsSettings } from "../../components/playback-bar/AiTtsSettings";
import { SettingsPanel } from "../../components/settings/SettingsPanel";
import type { Document } from "../../lib/schemas";

vi.mock("../../services/pdf-service", () => ({
  pdfService: {
    loadDocument: vi.fn(),
    loadDocumentBound: vi.fn(),
    getPage: vi.fn(),
  },
}));
vi.mock("../../adapters/tauri/file-dialog.adapter", () => ({
  fileDialog: { open: vi.fn(), save: vi.fn() },
}));
vi.mock("../../components/PdfViewer", () => ({
  PdfViewer: () => <div data-testid="pdf-viewer" />,
}));
vi.mock("../../components/playback-bar/AiPlaybackBar", () => ({
  AiPlaybackBar: () => <div data-testid="playback-bar" />,
}));

const { pdfService } = await import("../../services/pdf-service");
// The Open button goes through `openPdf`, which reads via the bound variant
// so it can check the bytes it opened against the row the library returns.
const loadDocument = vi.mocked(pdfService.loadDocumentBound);
const { fileDialog } = await import("../../adapters/tauri/file-dialog.adapter");

const DOC: Document = {
  id: "doc-1",
  filePath: "/books/ddd.pdf",
  title: "Domain-Driven Design",
  pageCount: 529,
  currentPage: 1,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: "2026-08-05T10:00:00Z",
  fileHash: null,
  createdAt: "2026-08-01T00:00:00Z",
} as Document;

beforeEach(() => {
  useDocumentStore.getState().reset();
  useLibraryStore.getState().reset();
  useCollectionsStore.getState().reset();
  useAiTtsStore.getState().reset();
  loadDocument.mockReset();
  loadDocument.mockResolvedValue({
    pdf: { numPages: 529 } as unknown as PDFDocumentProxy,
    // The library answers with DOC, whose id IS the file fingerprint.
    sha256: DOC.id,
  });
  vi.mocked(fileDialog.open).mockReset();
  vi.mocked(fileDialog.open).mockResolvedValue("/books/ddd.pdf" as never);

  mockInvoke.mockImplementation((command: string) => {
    switch (command) {
      case "library_list_documents":
        return Promise.resolve([DOC]);
      case "collections_list":
      case "collections_list_memberships":
        return Promise.resolve([]);
      case "library_heal_document":
      case "library_open_document":
      case "library_get_document_by_path":
        return Promise.resolve(DOC);
      case "library_add_document":
        return Promise.resolve(DOC);
      case "highlights_list_for_document":
      case "highlights_list_for_page":
        return Promise.resolve({ highlights: [] });
      case "settings_get_all_v2":
        return Promise.resolve({ settings: {} });
      default:
        return Promise.resolve(null);
    }
  });
});

describe("release blockers (109)", () => {
  it("B1: the toolbar Open button leaves the library and shows the reader", async () => {
    render(<ReaderView />);

    // The reading home is showing.
    expect(
      await screen.findByRole("heading", { name: "Library" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open PDF" }));

    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("heading", { name: "Library" }),
    ).not.toBeInTheDocument();
    expect(loadDocument).toHaveBeenCalledWith("/books/ddd.pdf", {
      expectedSha256: DOC.id,
    });
  });

  it("B2: a wrong key does not close the settings dialog and shows the error", async () => {
    // initialize fails: mock ai_tts_init -> backend error.
    mockInvoke.mockImplementation((command: string) => {
      if (command === "ai_tts_init")
        return Promise.reject(new Error("Invalid API key"));
      return Promise.resolve(null);
    });

    const onClose = vi.fn();
    render(<AiTtsSettings onClose={onClose} />);

    const input = screen.getByLabelText("ElevenLabs API Key");
    fireEvent.change(input, { target: { value: "sk-wrong-key" } });
    fireEvent.click(screen.getByRole("button", { name: /Connect/ }));

    await waitFor(() =>
      expect(screen.getByText(/Invalid API key/)).toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("B3: Settings -> Text-to-Speech renders the AI-TTS settings, not a dead panel", () => {
    render(<SettingsPanel isOpen onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Text-to-Speech" }));

    // The dead legacy panel said "not available on this system" forever;
    // the AI-TTS settings form (API key + cache) is now the section.
    expect(
      screen.queryByText(/not available on this system/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("AI TTS Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("ElevenLabs API Key")).toBeInTheDocument();
  });

  it("B3 (112): a fresh install has a path to Settings — the empty library offers it", async () => {
    // No documents at all: the first-launch surface. Before 112 there was no
    // path to Settings (no in-flight books -> no ResumeSection, no document
    // -> no playback bar, native menu hidden on packaged Linux).
    mockInvoke.mockImplementation((command: string) => {
      if (command === "library_list_documents") return Promise.resolve([]);
      if (
        command === "collections_list" ||
        command === "collections_list_memberships"
      )
        return Promise.resolve([]);
      return Promise.resolve(null);
    });
    render(<ReaderView />);

    expect(
      await screen.findByRole("heading", { name: "Library" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));

    expect(
      await screen.findByRole("dialog", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  it("B4: a failed open surfaces the error on the library surface", async () => {
    loadDocument.mockRejectedValue(
      new Error("PDF_INVALID: The file is not a valid PDF"),
    );
    render(<ReaderView />);
    await screen.findByRole("heading", { name: "Library" });

    fireEvent.click(screen.getByRole("button", { name: "Open PDF" }));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(/PDF_INVALID/);
    // Still on the library — never stranded on a blank reader.
    expect(
      screen.getByRole("heading", { name: "Library" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
  });
});
