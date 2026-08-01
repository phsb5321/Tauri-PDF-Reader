/**
 * The two ways a document reaches the reader.
 *
 * `resumeDocument` is the one the reading home exists for: picking a book off
 * the Continue-reading shelf lands the reader on the page that book was left
 * on. `openPdf` is the file dialog, and it makes the same promise — opening a
 * book you have read before through Ctrl+O must not restart it at page one.
 *
 * The oracle is the document store — the state the reader renders from — not
 * anything on screen.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { mockInvoke } from "../../tests/setup";
import { useOpenPdf } from "./useOpenPdf";
import { useDocumentStore } from "../stores/document-store";
import type { Document } from "../lib/schemas";

vi.mock("../services/pdf-service", () => ({
  pdfService: { loadDocument: vi.fn() },
}));

vi.mock("../adapters/tauri/file-dialog.adapter", () => ({
  fileDialog: { open: vi.fn(), save: vi.fn() },
}));

const { pdfService } = await import("../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);
const { fileDialog } = await import("../adapters/tauri/file-dialog.adapter");
const openDialog = vi.mocked(fileDialog.open);

const pdf = (numPages: number) => ({ numPages }) as unknown as PDFDocumentProxy;

const doc = (over: Partial<Document> = {}): Document =>
  ({
    id: "doc-1",
    filePath: "/books/one.pdf",
    title: "One",
    pageCount: 300,
    currentPage: 1,
    scrollPosition: 0,
    lastTtsChunkId: null,
    lastOpenedAt: null,
    fileHash: null,
    createdAt: "2026-07-01T00:00:00Z",
    ...over,
  }) as Document;

beforeEach(() => {
  useDocumentStore.getState().reset();
  loadDocument.mockReset();
  openDialog.mockReset();
});

/**
 * Answer the library commands by name, so a test says what the library knows
 * rather than what order the hook happens to call it in.
 */
function library({ known }: { known: Document | null }) {
  mockInvoke.mockImplementation((command: string) => {
    switch (command) {
      case "library_get_document_by_path":
        return Promise.resolve(known);
      case "library_add_document":
      case "library_open_document":
        return Promise.resolve(known ?? doc({ currentPage: 1 }));
      default:
        return Promise.resolve(null);
    }
  });
}

describe("resumeDocument", () => {
  it("lands on the page the document was left on", async () => {
    const stored = doc({ currentPage: 142 });
    loadDocument.mockResolvedValue(pdf(300));
    mockInvoke.mockResolvedValue(stored);

    const { result } = renderHook(() => useOpenPdf());
    let resumed: boolean | undefined;
    await act(async () => {
      resumed = await result.current.resumeDocument(stored);
    });

    expect(resumed).toBe(true);
    expect(loadDocument).toHaveBeenCalledWith("/books/one.pdf");
    const state = useDocumentStore.getState();
    expect(state.currentPage).toBe(142);
    expect(state.currentDocument?.id).toBe("doc-1");
    expect(state.totalPages).toBe(300);
  });

  it("clamps a stored page the file can no longer reach", async () => {
    // The row says page 142; the file on disk now has 40 pages, because it was
    // replaced. Resuming must not land on a page that does not exist.
    const stored = doc({ currentPage: 142 });
    loadDocument.mockResolvedValue(pdf(40));
    mockInvoke.mockResolvedValue(stored);

    const { result } = renderHook(() => useOpenPdf());
    await act(async () => {
      await result.current.resumeDocument(stored);
    });

    expect(useDocumentStore.getState().currentPage).toBe(40);
  });

  it("opens the book even when the last-opened stamp fails", async () => {
    const stored = doc({ currentPage: 7 });
    loadDocument.mockResolvedValue(pdf(300));
    mockInvoke.mockRejectedValue(new Error("database is locked"));

    const { result } = renderHook(() => useOpenPdf());
    let resumed: boolean | undefined;
    await act(async () => {
      resumed = await result.current.resumeDocument(stored);
    });

    expect(resumed).toBe(true);
    expect(useDocumentStore.getState().currentPage).toBe(7);
  });

  it("reports failure and shows nothing when the file will not load", async () => {
    loadDocument.mockRejectedValue(new Error("No such file"));

    const { result } = renderHook(() => useOpenPdf());
    let resumed: boolean | undefined;
    await act(async () => {
      resumed = await result.current.resumeDocument(doc({ currentPage: 12 }));
    });

    expect(resumed).toBe(false);
    const state = useDocumentStore.getState();
    expect(state.pdfDocument).toBeNull();
    expect(state.error).toBe("No such file");
  });
});

describe("openPdf", () => {
  it("registers a file the library has never seen", async () => {
    openDialog.mockResolvedValue("/books/new.pdf");
    loadDocument.mockResolvedValue(pdf(30));
    library({ known: null });

    const { result } = renderHook(() => useOpenPdf());
    let opened: boolean | undefined;
    await act(async () => {
      opened = await result.current.openPdf();
    });

    expect(opened).toBe(true);
    // tauri-specta generates camelCase argument keys (src/lib/bindings.ts) and
    // Tauri converts them to the command's snake_case Rust parameters. Sending
    // snake_case from here would reach the backend with its arguments missing —
    // a runtime-only failure that mocked IPC cannot surface on its own, so the
    // key names are pinned here instead.
    expect(mockInvoke).toHaveBeenCalledWith("library_add_document", {
      filePath: "/books/new.pdf",
      title: undefined,
      pageCount: 30,
    });
    expect(useDocumentStore.getState().totalPages).toBe(30);
  });

  it("reopens a book the library already holds at its stored page", async () => {
    openDialog.mockResolvedValue("/books/one.pdf");
    loadDocument.mockResolvedValue(pdf(300));
    library({ known: doc({ currentPage: 88 }) });

    const { result } = renderHook(() => useOpenPdf());
    await act(async () => {
      await result.current.openPdf();
    });

    expect(mockInvoke).toHaveBeenCalledWith("library_get_document_by_path", {
      filePath: "/books/one.pdf",
    });
    // Registering it a second time would reset the reader to page one, which is
    // the whole of what the reading home is for.
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "library_add_document",
      expect.anything(),
    );
    expect(useDocumentStore.getState().currentPage).toBe(88);
  });

  it("leaves the reader alone when the dialog is cancelled", async () => {
    openDialog.mockResolvedValue(null);

    const { result } = renderHook(() => useOpenPdf());
    let opened: boolean | undefined;
    await act(async () => {
      opened = await result.current.openPdf();
    });

    expect(opened).toBe(false);
    const state = useDocumentStore.getState();
    expect(state.pdfDocument).toBeNull();
    expect(state.currentDocument).toBeNull();
    expect(loadDocument).not.toHaveBeenCalled();
  });
});
