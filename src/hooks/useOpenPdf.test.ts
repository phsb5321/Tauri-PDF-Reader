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
  pdfService: { loadDocument: vi.fn(), loadDocumentBound: vi.fn() },
  isScopeDenial: (e: unknown) =>
    /not allowed on the configured scope|forbidden path: .*not allowed on the scope/i.test(
      e instanceof Error ? e.message : String(e),
    ),
}));

vi.mock("../adapters/tauri/file-dialog.adapter", () => ({
  fileDialog: { open: vi.fn(), save: vi.fn() },
}));

const { pdfService } = await import("../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);
// `openPdf` reads through the bound variant, which also reports the
// fingerprint of the bytes it opened; `resumeDocument` already has a row id
// to check against and stays on `loadDocument`.
const loadDocumentBound = vi.mocked(pdfService.loadDocumentBound);
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
  loadDocumentBound.mockReset();
  openDialog.mockReset();
});

/** Bytes that hash to `sha256` — by default the id the library hands back. */
const bytesOf = (proxy: PDFDocumentProxy, sha256 = "doc-1") => ({
  pdf: proxy,
  sha256,
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
    expect(loadDocument).toHaveBeenCalledWith("/books/one.pdf", {
      expectedSha256: "doc-1",
    });
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

describe("openDroppedPdf", () => {
  it("does not race another open already using the shared document store", async () => {
    useDocumentStore.setState({ isLoading: true });
    const { result } = renderHook(() => useOpenPdf());

    let opened: Document | null | undefined;
    await act(async () => {
      opened = await result.current.openDroppedPdf("/drop/new.pdf");
    });

    expect(opened).toBeNull();
    expect(loadDocumentBound).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().error).toContain("OPEN_BUSY");
  });

  it("uses the native-authorized path, runs the bound import, and returns its row", async () => {
    loadDocumentBound.mockResolvedValue(bytesOf(pdf(30)));
    loadDocument.mockResolvedValue(pdf(30));
    library({ known: null });

    const { result } = renderHook(() => useOpenPdf());
    let opened: Document | null = null;
    await act(async () => {
      opened = await result.current.openDroppedPdf("/drop/new.pdf");
    });

    expect(loadDocumentBound).toHaveBeenCalledWith("/drop/new.pdf", undefined);
    expect(opened?.id).toBe("doc-1");
    expect(useDocumentStore.getState().currentDocument?.id).toBe("doc-1");
  });

  it("reuses a known row and its saved page instead of duplicating it", async () => {
    const known = doc({ currentPage: 88 });
    loadDocumentBound.mockResolvedValue(bytesOf(pdf(300)));
    library({ known });

    const { result } = renderHook(() => useOpenPdf());
    await act(async () => {
      await result.current.openDroppedPdf("/books/one.pdf");
    });

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "library_add_document",
      expect.anything(),
    );
    expect(useDocumentStore.getState().currentPage).toBe(88);
  });

  it("returns null and creates no row for a non-PDF drop", async () => {
    const { result } = renderHook(() => useOpenPdf());
    let opened: Document | null | undefined;
    await act(async () => {
      opened = await result.current.openDroppedPdf("/drop/notes.txt");
    });

    expect(opened).toBeNull();
    expect(loadDocumentBound).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument).toBeNull();
    expect(useDocumentStore.getState().error).toContain("DROP_INVALID");
  });
});

describe("openPdf", () => {
  it("registers a file the library has never seen", async () => {
    openDialog.mockResolvedValue("/books/new.pdf");
    loadDocumentBound.mockResolvedValue(bytesOf(pdf(30)));
    loadDocument.mockResolvedValue(pdf(30)); // final post-add bound read
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
      expectedSha256: "doc-1",
    });
    expect(useDocumentStore.getState().totalPages).toBe(30);
  });

  it("reopens a book the library already holds at its stored page", async () => {
    openDialog.mockResolvedValue("/books/one.pdf");
    loadDocumentBound.mockResolvedValue(bytesOf(pdf(300)));
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
    expect(loadDocumentBound).not.toHaveBeenCalled();
  });

  it("refuses a fresh import whose file changed while it was being added", async () => {
    // The bytes on screen hash to A; by the time the backend hashed the file
    // to create the row, the path held B. Binding one book's pages to the
    // other's row would file its progress, highlights and audio against the
    // wrong document — so nothing is shown.
    openDialog.mockResolvedValue("/books/new.pdf");
    loadDocumentBound.mockResolvedValue(bytesOf(pdf(30), "hash-of-A"));
    library({ known: null }); // library_add_document answers with id doc-1 (B)

    const { result } = renderHook(() => useOpenPdf());
    let opened: boolean | undefined;
    await act(async () => {
      opened = await result.current.openPdf();
    });

    expect(opened).toBe(false);
    const state = useDocumentStore.getState();
    expect(state.error).toContain("PDF_HASH_MISMATCH");
    expect(state.pdfDocument).toBeNull();
    expect(state.currentDocument).toBeNull();
  });
});

const scopeDenial = new Error(
  "forbidden path: /books/one.pdf, maybe it is not allowed on the scope for `allow-read-file` permission in your capability file",
);

describe("resumeDocument reauthorization rung (issue #120)", () => {
  it("scope-denied book reauthorizes through the dialog and lands in the reader", async () => {
    const stored = doc({ currentPage: 42 });
    const relocated = doc({
      filePath: "/books/moved/one.pdf",
      currentPage: 42,
    });

    loadDocument
      .mockRejectedValueOnce(scopeDenial) // stored path: grant gone
      .mockResolvedValueOnce(pdf(300)) // picked path: pre-mutation check
      .mockResolvedValueOnce(pdf(300)); // picked path: final bound display read
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
    expect(loadDocument).toHaveBeenNthCalledWith(1, "/books/one.pdf", {
      expectedSha256: "doc-1",
    });
    // The retry binds the opened bytes to the row id (the verified SHA-256).
    expect(loadDocument).toHaveBeenNthCalledWith(2, "/books/moved/one.pdf", {
      expectedSha256: "doc-1",
    });
    const state = useDocumentStore.getState();
    expect(state.currentDocument?.filePath).toBe("/books/moved/one.pdf");
    expect(state.currentPage).toBe(42);
    expect(state.pdfDocument).not.toBeNull();
  });

  it("a wrong file cannot substitute or be read — the row stays untouched", async () => {
    const stored = doc({ currentPage: 42 });

    loadDocument
      .mockRejectedValueOnce(scopeDenial)
      .mockRejectedValueOnce(
        new Error(
          "PDF_HASH_MISMATCH: File content changed after verification — the book was not opened.",
        ),
      );
    openDialog.mockResolvedValue("/books/evil-impostor.pdf");
    mockInvoke.mockResolvedValue(stored);

    const { result } = renderHook(() => useOpenPdf());
    let resumed: boolean | undefined;
    await act(async () => {
      resumed = await result.current.resumeDocument(stored);
    });

    expect(resumed).toBe(false);
    const state = useDocumentStore.getState();
    expect(state.error).toContain("WRONG_DOCUMENT");
    expect(state.error).toContain("evil-impostor.pdf");
    expect(state.pdfDocument).toBeNull();
    // Verify the selected bytes BEFORE any row mutation. The impostor is read
    // only under the expected row hash and fails closed.
    expect(loadDocument).toHaveBeenNthCalledWith(
      2,
      "/books/evil-impostor.pdf",
      { expectedSha256: "doc-1" },
    );
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "library_relocate_document",
      expect.anything(),
    );
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

describe("every known-row open binds the bytes to the row hash (Codex exact-head)", () => {
  it("a failed reauth retry does not disable verification on a later resume", async () => {
    // First resume: the stored path lost its grant; reauthorization picks a
    // WRONG file -> refused. The row stays at the old path.
    const stored = doc({ currentPage: 42 });
    loadDocument
      .mockRejectedValueOnce(scopeDenial) // stored path: grant gone
      .mockResolvedValueOnce(pdf(300)); // (unreachable — wrong file refuses)
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
    await act(async () => {
      await result.current.resumeDocument(stored);
    });
    expect(useDocumentStore.getState().error).toContain("WRONG_DOCUMENT");

    // Second resume (e.g. the user retries after fixing the file): the read
    // must STILL carry the row-hash binding.
    loadDocument.mockReset();
    loadDocument.mockResolvedValue(pdf(300));
    let resumed: boolean | undefined;
    await act(async () => {
      resumed = await result.current.resumeDocument(stored);
    });

    expect(resumed).toBe(true);
    expect(loadDocument).toHaveBeenCalledWith("/books/one.pdf", {
      expectedSha256: "doc-1",
    });
  });

  it("openPdf binds the bytes when the picked file is already a library row", async () => {
    const known = doc({ currentPage: 7 });
    openDialog.mockResolvedValue("/books/one.pdf");
    loadDocumentBound.mockResolvedValue(bytesOf(pdf(300)));
    mockInvoke.mockImplementation((command: string) => {
      if (command === "library_get_document_by_path") {
        return Promise.resolve(known);
      }
      if (command === "library_open_document") return Promise.resolve(known);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useOpenPdf());
    let opened: boolean | undefined;
    await act(async () => {
      opened = await result.current.openPdf();
    });

    expect(opened).toBe(true);
    expect(loadDocumentBound).toHaveBeenCalledWith("/books/one.pdf", {
      expectedSha256: "doc-1",
    });
  });

  it("a row whose external path changed can reauthorize instead of staying broken", async () => {
    const stored = doc({ currentPage: 42 });
    const repaired = doc({
      currentPage: 42,
      filePath: "/books/restored/one.pdf",
    });
    loadDocument
      .mockRejectedValueOnce(
        new Error(
          "PDF_HASH_MISMATCH: File content changed after verification — the book was not opened.",
        ),
      )
      .mockResolvedValueOnce(pdf(300)) // pre-relocate verification
      .mockResolvedValueOnce(pdf(300)); // final post-relocate display read
    openDialog.mockResolvedValue("/books/restored/one.pdf");
    mockInvoke.mockImplementation((command: string) =>
      Promise.resolve(
        command === "library_relocate_document" ||
          command === "library_open_document"
          ? repaired
          : null,
      ),
    );

    const { result } = renderHook(() => useOpenPdf());
    let resumed: boolean | undefined;
    await act(async () => {
      resumed = await result.current.resumeDocument(stored);
    });

    expect(resumed).toBe(true);
    expect(openDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Reauthorize"),
      }),
    );
    expect(useDocumentStore.getState().currentDocument?.filePath).toBe(
      "/books/restored/one.pdf",
    );
    expect(useDocumentStore.getState().currentPage).toBe(42);
  });
});
