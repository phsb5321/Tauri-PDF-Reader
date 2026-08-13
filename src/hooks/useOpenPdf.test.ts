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

describe("resumeDocument reauthorization rung (issue #120)", () => {
  const scopeDenial = new Error(
    "path not allowed on the configured scope: /books/one.pdf",
  );

  it("scope-denied book reauthorizes through the dialog and lands in the reader", async () => {
    const stored = doc({ currentPage: 42 });
    const relocated = doc({
      filePath: "/books/moved/one.pdf",
      currentPage: 42,
    });

    loadDocument
      .mockRejectedValueOnce(scopeDenial) // stored path: grant gone
      .mockResolvedValueOnce(pdf(300)); // picked path: fresh dialog grant
    openDialog.mockResolvedValue("/books/moved/one.pdf");
    mockInvoke.mockImplementation((command: string) => {
      switch (command) {
        case "library_relocate_document":
          return Promise.resolve(relocated);
        case "library_open_document":
          return Promise.resolve(relocated);
        default:
          return Promise.resolve(null);
      }
    });

    const { result } = renderHook(() => useOpenPdf());
    let resumed: boolean | undefined;
    await act(async () => {
      resumed = await result.current.resumeDocument(stored);
    });

    expect(resumed).toBe(true);
    // The dialog explains the reauthorization, not a bare file picker.
    expect(openDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Reauthorize"),
      }),
    );
    // The row is relocated only after the backend verified the hash.
    expect(mockInvoke).toHaveBeenCalledWith("library_relocate_document", {
      id: "doc-1",
      newFilePath: "/books/moved/one.pdf",
    });
    expect(loadDocument).toHaveBeenNthCalledWith(1, "/books/one.pdf");
    expect(loadDocument).toHaveBeenNthCalledWith(2, "/books/moved/one.pdf");
    const state = useDocumentStore.getState();
    expect(state.currentDocument?.filePath).toBe("/books/moved/one.pdf");
    expect(state.currentPage).toBe(42);
    expect(state.pdfDocument).not.toBeNull();
  });

  it("a wrong file cannot substitute or be read — the row stays untouched", async () => {
    const stored = doc({ currentPage: 42 });

    loadDocument.mockRejectedValue(scopeDenial);
    openDialog.mockResolvedValue("/books/evil-impostor.pdf");
    mockInvoke.mockImplementation((command: string) => {
      if (command === "library_relocate_document") {
        return Promise.reject(
          "HASH_MISMATCH: File at new path has different content",
        );
      }
      return Promise.resolve(stored);
    });

    const { result } = renderHook(() => useOpenPdf());
    let resumed: boolean | undefined;
    await act(async () => {
      resumed = await result.current.resumeDocument(stored);
    });

    expect(resumed).toBe(false);
    const state = useDocumentStore.getState();
    expect(state.error).toContain("WRONG_DOCUMENT");
    expect(state.pdfDocument).toBeNull();
    // The impostor's bytes were never read.
    expect(loadDocument).toHaveBeenCalledTimes(1);
    expect(loadDocument).not.toHaveBeenCalledWith("/books/evil-impostor.pdf");
  });

  it("cancelling the reauthorization leaves the library with an actionable error", async () => {
    const stored = doc({ currentPage: 42 });

    loadDocument.mockRejectedValue(scopeDenial);
    openDialog.mockResolvedValue(null);

    const { result } = renderHook(() => useOpenPdf());
    let resumed: boolean | undefined;
    await act(async () => {
      resumed = await result.current.resumeDocument(stored);
    });

    expect(resumed).toBe(false);
    const state = useDocumentStore.getState();
    expect(state.error).toContain("OPEN_CANCELLED");
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "library_relocate_document",
      expect.anything(),
    );
    expect(state.pdfDocument).toBeNull();
  });

  it("a granted path opens without any dialog", async () => {
    const stored = doc({ currentPage: 12 });
    loadDocument.mockResolvedValue(pdf(300));
    mockInvoke.mockResolvedValue(stored);

    const { result } = renderHook(() => useOpenPdf());
    let resumed: boolean | undefined;
    await act(async () => {
      resumed = await result.current.resumeDocument(stored);
    });

    expect(resumed).toBe(true);
    expect(openDialog).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "library_relocate_document",
      expect.anything(),
    );
  });
});
