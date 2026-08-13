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
import { pdfService } from "../services/pdf-service";
import {
  libraryAddDocument,
  libraryGetDocumentByPath,
  libraryOpenDocument,
  libraryRelocateDocument,
} from "../lib/tauri-invoke";
import type { Document } from "../lib/schemas";

/**
 * plugin-fs v2 rejects reads outside the capability scope with this message.
 * A library book whose dialog grant never existed (pre-persisted-scope
 * sessions) or lapsed fails exactly here — the reauthorization trigger.
 */
function isScopeDenial(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not allowed on the configured scope/i.test(message);
}

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
      const relocated = await libraryRelocateDocument(document.id, path).catch(
        (error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.includes("HASH_MISMATCH")) {
            setError(
              "WRONG_DOCUMENT: The selected file is not this book — the library was not changed.",
            );
          } else {
            setError(`Reauthorization failed: ${message}`);
          }
          return null;
        },
      );
      if (!relocated) return null;

      // Bind the opened bytes to the verified fingerprint: the row id is the
      // file's SHA-256 (relocate re-verified it above), so the read is
      // refused if the path's content was swapped in between.
      const pdf = await pdfService.loadDocument(relocated.filePath, {
        expectedSha256: document.id,
      });
      return { pdf, document: relocated };
    },
    [openFile, setError],
  );

  /**
   * Pick a PDF from disk and open it, registering it in the library the first
   * time it is seen.
   *
   * @returns `true` once a document is showing in the reader; `false` if the
   * dialog was cancelled or the open failed.
   */
  const openPdf = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const selected = await openFile({
        multiple: false,
        filters: [FILE_FILTERS.PDF],
      });

      // User cancelled the dialog.
      if (!selected) {
        return false;
      }

      const filePath = selected as string;
      const pdf = await pdfService.loadDocument(filePath);

      const known = await libraryGetDocumentByPath(filePath);
      const document = known
        ? await libraryOpenDocument(known.id)
        : await libraryAddDocument(filePath, undefined, pdf.numPages);

      showInReader(pdf, document);
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
  }, [openFile, setLoading, setError, showInReader]);

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
          pdf = await pdfService.loadDocument(document.filePath);

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
          if (!isScopeDenial(error)) throw error;

          // The stored path lost its fs grant (issue #120): reauthorize via
          // the native dialog, verify content, relocate, retry.
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

  return { openPdf, resumeDocument };
}
