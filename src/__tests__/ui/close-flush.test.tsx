/**
 * Slice 112 DL-1/DL-2 — the close-flush protocol, jsdom half.
 *
 * The backend's CloseRequested handler prevents the close, emits
 * `app-close-requested`, waits for `app-close-ack` (3s timeout), then
 * destroys the window. The frontend must flush every debounced writer
 * (reading position at 500ms, highlights at 500ms) before acknowledging —
 * the user was told the write happened, so it must not be dropped by the
 * close. This test pins the protocol wiring; the packaged lane proves the
 * survival.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
  within,
} from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { mockInvoke } from "../../../tests/setup";
import { listen, emit } from "@tauri-apps/api/event";
import { ReaderView } from "../../components/reader/ReaderView";
import { useDocumentStore } from "../../stores/document-store";
import { useLibraryStore } from "../../stores/library-store";
import { useCollectionsStore } from "../../stores/collections-store";
import type { Document } from "../../lib/schemas";

vi.mock("../../services/pdf-service", () => ({
  pdfService: { loadDocument: vi.fn(), getPage: vi.fn() },
}));
vi.mock("../../components/PdfViewer", () => ({
  PdfViewer: () => <div data-testid="pdf-viewer" />,
}));
vi.mock("../../components/Toolbar", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));
vi.mock("../../components/playback-bar/AiPlaybackBar", () => ({
  AiPlaybackBar: () => <div data-testid="playback-bar" />,
}));

const { pdfService } = await import("../../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);

const IN_FLIGHT: Document = {
  id: "doc-1",
  filePath: "/books/ddd.pdf",
  title: "Domain-Driven Design",
  pageCount: 529,
  currentPage: 213,
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
  loadDocument.mockReset();
  loadDocument.mockResolvedValue({
    numPages: 529,
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
      case "highlights_list_for_document":
      case "highlights_list_for_page":
        return Promise.resolve({ highlights: [] });
      case "library_update_progress":
        return Promise.resolve(null);
      case "settings_get_all_v2":
        return Promise.resolve({ settings: {} });
      default:
        return Promise.resolve(null);
    }
  });
});

function closeRequestedListener(): (() => void) | undefined {
  // The listener re-registers when the effect's flush callbacks change (e.g.
  // on a page turn, which changes saveProgress's identity) — the CURRENT
  // registration is the last one.
  const registrations = vi
    .mocked(listen)
    .mock.calls.filter(([event]) => event === "app-close-requested");
  const registration = registrations.at(-1);
  return registration?.[1] as (() => void) | undefined;
}

describe("the close-flush protocol (112)", () => {
  it("flushes pending position and acknowledges before the close completes", async () => {
    render(<ReaderView />);

    const shelf = await screen.findByRole("region", {
      name: "Continue reading",
    });
    fireEvent.click(
      within(shelf).getByRole("button", {
        name: /^Resume Domain-Driven Design, page/,
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    await waitFor(() => expect(closeRequestedListener()).toBeDefined());

    // Turn a page — a 500ms-debounced position write is now pending.
    act(() => {
      fireEvent.keyDown(window, { key: "PageDown" });
    });
    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(214),
    );

    // The window closes before the debounce fires.
    act(() => {
      closeRequestedListener()?.();
    });

    // The pending position must be flushed synchronously on the close path.
    await waitFor(() => {
      const calls = vi
        .mocked(mockInvoke)
        .mock.calls.filter(([cmd]) => cmd === "library_update_progress");
      expect(calls.length).toBeGreaterThan(0);
    });
    await waitFor(() => expect(emit).toHaveBeenCalledWith("app-close-ack"));
  });

  it("does NOT acknowledge when the position flush rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ReaderView />);

    const shelf = await screen.findByRole("region", {
      name: "Continue reading",
    });
    fireEvent.click(
      within(shelf).getByRole("button", {
        name: /^Resume Domain-Driven Design, page/,
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    await waitFor(() => expect(closeRequestedListener()).toBeDefined());

    // Turn a page — a pending position write — and make the BACKEND write
    // fail, so the close flush rejects.
    act(() => {
      fireEvent.keyDown(window, { key: "PageDown" });
    });
    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(214),
    );
    mockInvoke.mockImplementation((command: string) => {
      if (command === "library_update_progress") {
        return Promise.reject(new Error("backend down"));
      }
      return Promise.resolve(null);
    });

    act(() => {
      closeRequestedListener()?.();
    });

    // First let the rejection path SETTLE — the failure is surfaced (the
    // catch logs it). Only then is the negative ack assertion meaningful:
    // asserting "not called" before the path settles can false-green.
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to flush on close:",
        expect.anything(),
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    // The flush rejected — the protocol must NOT have emitted the success
    // ack, even after the rejection fully settled.
    expect(vi.mocked(emit)).not.toHaveBeenCalledWith("app-close-ack");
    errorSpy.mockRestore();
  });
});
