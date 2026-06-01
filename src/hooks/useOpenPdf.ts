/**
 * useOpenPdf Hook
 *
 * The open-a-PDF flow as a reusable hook: pick a file, load it, register or
 * refresh it in the library, and push it into the document store. Shared so the
 * toolbar button and the native File -> Open menu item trigger identical
 * behavior. Mirrors the flow in `Toolbar` / `useKeyboardShortcuts`.
 *
 * @module hooks/useOpenPdf
 */

import { useCallback } from "react";
import { useFileDialog, FILE_FILTERS } from "./useFileDialog";
import { useDocumentStore } from "../stores/document-store";
import { pdfService } from "../services/pdf-service";
import { libraryService } from "../services/library-service";

/** Provides `openPdf`, the shared open-document action. */
export function useOpenPdf() {
  const { openFile } = useFileDialog();
  const { setDocument, setPdfDocument, setLoading, setError, setCurrentPage } =
    useDocumentStore();

  const openPdf = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const selected = await openFile({
        multiple: false,
        filters: [FILE_FILTERS.PDF],
      });

      // User cancelled the dialog.
      if (!selected) {
        return;
      }

      const filePath = selected as string;
      const pdf = await pdfService.loadDocument(filePath);
      setPdfDocument(pdf);

      let document = await libraryService.getDocumentByPath(filePath);
      if (document) {
        document = await libraryService.openDocument(document.id);
        setCurrentPage(document.currentPage);
      } else {
        document = await libraryService.addDocument({
          filePath,
          pageCount: pdf.numPages,
        });
      }

      setDocument(document);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to open PDF";
      setError(message);
      console.error("Error opening PDF:", error);
    } finally {
      setLoading(false);
    }
  }, [
    openFile,
    setDocument,
    setPdfDocument,
    setLoading,
    setError,
    setCurrentPage,
  ]);

  return { openPdf };
}
