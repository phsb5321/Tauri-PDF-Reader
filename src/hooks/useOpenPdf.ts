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
    } catch (error) {
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
   * @returns `true` once the document is showing in the reader.
   */
  const resumeDocument = useCallback(
    async (document: Document): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        const pdf = await pdfService.loadDocument(document.filePath);

        // `last_opened_at` is bookkeeping for the home's ordering, and the row
        // we were handed already carries everything the reader needs. Stamp it,
        // but do not let a failed stamp stand between the reader and a book
        // whose file has already loaded.
        const opened = await libraryOpenDocument(document.id).catch((error) => {
          console.warn("Failed to stamp last-opened time:", error);
          return document;
        });

        showInReader(pdf, opened);
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to open document";
        setError(message);
        console.error("Error resuming document:", error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, showInReader],
  );

  return { openPdf, resumeDocument };
}
