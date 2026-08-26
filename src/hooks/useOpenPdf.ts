/**
 * useOpenPdf Hook
 *
 * The two ways a document reaches the reader, sharing one landing step.
 * `openPdf` picks a file off disk; `resumeDocument` takes one the library
 * already knows about, which is how the reading home resumes a book. Both end
 * in `showInReader`, so a document opened from the home and the same document
 * opened through the file dialog arrive in identical state — including the page
 * it was last left on.
 *
 * The toolbar button, the native File -> Open menu item and Ctrl+O all call
 * `openPdf`, so those three entry points are one flow rather than three copies
 * of it.
 *
 * @module hooks/useOpenPdf
 */

import { useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useFileDialog, FILE_FILTERS } from "./useFileDialog";
import { useDocumentStore } from "../stores/document-store";
import { isScopeDenial, pdfService } from "../services/pdf-service";
import {
  libraryAddDocument,
  libraryGetDocumentByPath,
  libraryOpenDocument,
  libraryRelocateDocument,
} from "../lib/tauri-invoke";
import type { Document } from "../lib/schemas";

/** Provides the shared open-a-document actions. */
export function useOpenPdf() {
  const { openFile } = useFileDialog();
  const { setDocument, setPdfDocument, setLoading, setError, setCurrentPage } =
    useDocumentStore();

  /**
   * Put a loaded PDF and its library row into the reader.
   *
   * The order is load-bearing: `setPdfDocument` is what teaches the store the
   * real page count, and `setDocument` writes the stored page straight through
   * without clamping. Re-setting the page afterwards runs that clamp, so a
   * document whose file was replaced by a shorter one resumes on a page that
   * still exists rather than on a blank.
   */
  const showInReader = useCallback(
    (pdf: PDFDocumentProxy, document: Document) => {
      setPdfDocument(pdf);
      setDocument(document);
      setCurrentPage(document.currentPage);
    },
    [setDocument, setPdfDocument, setCurrentPage],
  );

  /**
   * Reauthorize a library book whose stored path lost its fs grant.
   *
   * Issue #120 (macOS): the reader reads bytes through `plugin-fs`, whose
   * capability scope only ever covers dialog-granted paths. A book picked in
   * a session before persisted grants existed (or whose grant lapsed) fails
   * the read with a scope denial and used to fail silently. This rung asks
   * the user to re-pick the book, then lets the backend verify the selection:
   * `library_relocate_document` re-hashes the picked file and compares it to
   * the row id (the id IS the content hash) — a different file is refused and
   * the row is left untouched. On a match the row is relocated to the picked
   * path and the read retries under the dialog's fresh grant, which the
   * persisted-scope plugin then keeps, so future opens need no dialog.
   *
   * @returns the loaded document pair, or `null` with the store error set
   * (cancel or wrong file).
   */
  const reauthorizeAccess = useCallback(
    async (
      document: Document,
    ): Promise<{ pdf: PDFDocumentProxy; document: Document } | null> => {
      const picked = await openFile({
        multiple: false,
        filters: [FILE_FILTERS.PDF],
        title: `Reauthorize access to "${document.title || document.filePath}"`,
      });

      if (!picked) {
        setError(
          "OPEN_CANCELLED: Access reauthorization was cancelled — the book was not opened.",
        );
        return null;
      }

      const path = picked as string;
      const pickedName = path.split(/[\\/]/).pop() || "selected file";
      try {
        // Verify and parse BEFORE relocating the row. The old order updated
        // file_path first, then read through plugin-fs; a swap between those
        // operations correctly refused the reader but left the row for book A
        // pointing at bytes B. No database mutation happens until the exact
        // bytes to be displayed are known to be this row's book.
        await pdfService.loadDocument(path, {
          expectedSha256: document.id,
        });
        // Hash again at the backend boundary immediately before the update.
        // If the path changed after the frontend read, relocate refuses.
        const relocated = await libraryRelocateDocument(document.id, path);
        // A mutable external path can change after ANY check. Read it once
        // more after the DB mutation and display only these final, hash-bound
        // bytes. If it changed, the row is still recoverable: ordinary resume
        // treats PDF_HASH_MISMATCH like a lost grant and asks for the book.
        const pdf = await pdfService.loadDocument(relocated.filePath, {
          expectedSha256: document.id,
        });
        return { pdf, document: relocated };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("HASH_MISMATCH")) {
          // Basename only: useful feedback + an observable retry transition,
          // without leaking a private absolute path into UI/log artifacts.
          setError(
            `WRONG_DOCUMENT: “${pickedName}” is not this book — the library was not changed.`,
          );
        } else {
          setError(`Reauthorization failed: ${message}`);
        }
        return null;
      }
    },
    [openFile, setError],
  );

  /**
   * Parse, register, bind, and display one already-authorized path.
   *
   * Dialog and native-drop entry points share this exact sequence so neither
   * can weaken the known-row hash check, fresh-row backend hash comparison, or
   * final post-registration read.
   */
  const openAuthorizedPath = useCallback(
    async (filePath: string): Promise<Document> => {
      const known = await libraryGetDocumentByPath(filePath);
      // Every open of a KNOWN row binds the bytes to the row's content hash
      // (the id): a file replaced at the same path is a different book and
      // refused rather than rendered under the old book's progress.
      const { pdf, sha256 } = await pdfService.loadDocumentBound(
        filePath,
        known ? { expectedSha256: known.id } : undefined,
      );

      const document = known
        ? await libraryOpenDocument(known.id)
        : await libraryAddDocument(
            filePath,
            undefined,
            pdf.numPages,
            // Bind the backend's DB mutation to the exact bytes parsed above.
            sha256,
          );

      // A fresh import is hashed twice: here, over the bytes actually opened,
      // and again in the backend when the row is created. A file swapped
      // between those reads must never put one book on screen under another
      // book's progress, highlights, audio, or session identity.
      if (document.id.toLowerCase() !== sha256) {
        throw new Error(
          "PDF_HASH_MISMATCH: File content changed while the book was being added — the book was not opened.",
        );
      }

      // Fresh imports mutate the row after the first read. Display a final
      // bound read so a post-hash path replacement is never rendered under
      // the row created for the earlier bytes. Known rows had no path mutation.
      const displayPdf = known
        ? pdf
        : await pdfService.loadDocument(filePath, {
            expectedSha256: document.id,
          });
      showInReader(displayPdf, document);
      return document;
    },
    [showInReader],
  );

  /** Pick a PDF through the native dialog and open it. */
  const openPdf = useCallback(async (): Promise<boolean> => {
    if (useDocumentStore.getState().isLoading) {
      setError("OPEN_BUSY: Wait for the current PDF to finish opening.");
      return false;
    }
    try {
      setLoading(true);
      setError(null);
      const selected = await openFile({
        multiple: false,
        filters: [FILE_FILTERS.PDF],
      });
      if (!selected) return false;

      await openAuthorizedPath(selected as string);
      return true;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to open PDF";
      setError(message);
      console.error("Error opening PDF:", error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [openAuthorizedPath, openFile, setError, setLoading]);

  /**
   * Open a path received from Tauri's native drop stream.
   *
   * Tauri's native drop pipeline grants plugin-fs access before emitting the
   * event. This entry point still rejects a non-PDF path before any read, then
   * reuses the same hash-bound import sequence as `openPdf`.
   */
  const openDroppedPdf = useCallback(
    async (filePath: string): Promise<Document | null> => {
      if (useDocumentStore.getState().isLoading) {
        setError("OPEN_BUSY: Wait for the current PDF to finish opening.");
        return null;
      }
      try {
        setLoading(true);
        setError(null);
        if (!/\.pdf$/i.test(filePath)) {
          throw new Error(
            "DROP_INVALID: Drop exactly one PDF to create a reading session.",
          );
        }
        return await openAuthorizedPath(filePath);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to open dropped PDF";
        setError(message);
        console.error("Error opening dropped PDF:", error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [openAuthorizedPath, setError, setLoading],
  );

  /**
   * Open a document the library already holds, at the page it was left on.
   *
   * This is the resume half of the reading home: the caller hands over a row
   * from the library (already relinked by `healDocument` if its file moved),
   * and the reader lands on that row's `currentPage`.
   *
   * When the stored path's fs grant is gone, the open falls through to the
   * reauthorization rung instead of failing silently.
   *
   * @returns `true` once the document is showing in the reader.
   */
  const resumeDocument = useCallback(
    async (document: Document): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        let pdf: PDFDocumentProxy;
        let opened: Document;
        try {
          // Every known-row open binds the bytes to the row's content hash
          // (the id), so a file replaced after a failed reauthorization (or
          // any other swap) cannot be rendered unverified on a later resume.
          pdf = await pdfService.loadDocument(document.filePath, {
            expectedSha256: document.id,
          });

          // `last_opened_at` is bookkeeping for the home's ordering, and the row
          // we were handed already carries everything the reader needs. Stamp it,
          // but do not let a failed stamp stand between the reader and a book
          // whose file has already loaded.
          opened = await libraryOpenDocument(document.id).catch(
            (error: unknown) => {
              console.warn("Failed to stamp last-opened time:", error);
              return document;
            },
          );
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          const needsReauthorization =
            isScopeDenial(error) || message.includes("PDF_HASH_MISMATCH");
          if (!needsReauthorization) throw error;

          // The stored path lost its fs grant OR its bytes no longer match the
          // row (a mutable external path changed after an earlier verified
          // open): reauthorize via the native dialog, verify content, relocate,
          // retry. Hash mismatch must be recoverable, not a permanently broken
          // row that can never reach the picker.

          const reauthorized = await reauthorizeAccess(document);
          if (!reauthorized) return false; // cancel/wrong file — error is set
          pdf = reauthorized.pdf;
          // Stamp the re-opened row like the ordinary path does; a failed
          // stamp must not strand a book that already reauthorized.
          opened = await libraryOpenDocument(reauthorized.document.id).catch(
            (error: unknown) => {
              console.warn(
                "Failed to stamp last-opened time after reauthorization:",
                error,
              );
              return reauthorized.document;
            },
          );
        }

        showInReader(pdf, opened);
        return true;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to open document";
        setError(message);
        console.error("Error resuming document:", error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, showInReader, reauthorizeAccess],
  );

  return { openPdf, openDroppedPdf, resumeDocument };
}
