import { useState, useRef } from "react";
import { useFileDialog, FILE_FILTERS } from "../hooks/useFileDialog";
import { useDocumentStore } from "../stores/document-store";
import { pdfService } from "../services/pdf-service";
import { commands } from "../lib/bindings";
import { useRovingTabindex } from "../hooks/useRovingTabindex";
import { PageNavigation } from "./PageNavigation";
import { ZoomControls } from "./ZoomControls";
import { SessionMenu } from "./session-menu/SessionMenu";
import "./Toolbar.css";

export function Toolbar() {
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
  const { openFile } = useFileDialog();
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Roving tabindex for keyboard navigation within the toolbar
  const { getItemProps } = useRovingTabindex({
    containerRef: toolbarRef,
    itemSelector: "button:not([disabled])",
    orientation: "horizontal",
    loop: true,
  });

  const {
    currentDocument,
    pdfDocument,
    isLoading,
    setDocument,
    setPdfDocument,
    setLoading,
    setError,
    setCurrentPage,
  } = useDocumentStore();

  const handleOpenFile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Open file dialog for PDF selection
      const selected = await openFile({
        multiple: false,
        filters: [FILE_FILTERS.PDF],
      });

      if (!selected) {
        setLoading(false);
        return;
      }

      const filePath = selected as string;

      // Load the PDF document
      const pdf = await pdfService.loadDocument(filePath);
      setPdfDocument(pdf);

      // Check if document exists in library (using tauri-specta generated bindings)
      const existingResult = await commands.libraryGetDocumentByPath(filePath);
      let document =
        existingResult.status === "ok" ? existingResult.data : null;

      if (document) {
        // Document exists, mark as opened and restore progress
        const openResult = await commands.libraryOpenDocument(document.id);
        if (openResult.status === "ok") {
          document = openResult.data;
          setCurrentPage(document.currentPage);
        }
      } else {
        // New document, add to library
        const addResult = await commands.libraryAddDocument(
          filePath,
          null,
          pdf.numPages,
        );
        if (addResult.status === "error") {
          throw new Error(addResult.error);
        }
        document = addResult.data;
      }

      // Update page count if it wasn't set
      if (!document.pageCount) {
        await commands.libraryUpdateDocument(
          document.id,
          null,
          pdf.numPages,
          null,
        );
        document = { ...document, pageCount: pdf.numPages };
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
  };

  const handleSessionRestored = () => {
    // Close the session menu after restoring
    setIsSessionMenuOpen(false);
    // TODO: Open documents from the restored session
  };

  return (
    <>
      <div
        className="toolbar"
        ref={toolbarRef}
        role="toolbar"
        aria-label="Document toolbar"
      >
        <div className="toolbar-section toolbar-left">
          <button
            type="button"
            className="toolbar-button sessions-button"
            onClick={() => setIsSessionMenuOpen((open) => !open)}
            title="Reading Sessions"
            aria-pressed={isSessionMenuOpen}
            {...getItemProps(0)}
          >
            <svg
              viewBox="0 0 24 24"
              className="toolbar-icon"
              aria-hidden="true"
            >
              <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
              <path d="M4 9h16" />
              <path d="M9 4v5" />
            </svg>
            <span className="button-text">Sessions</span>
          </button>

          <button
            type="button"
            className="toolbar-button open-button"
            onClick={handleOpenFile}
            disabled={isLoading}
            title="Open PDF file"
            {...(isLoading ? {} : getItemProps(1))}
          >
            <svg
              viewBox="0 0 24 24"
              className="toolbar-icon"
              aria-hidden="true"
            >
              <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2z" />
            </svg>
            <span className="button-text">Open</span>
          </button>

          {currentDocument && (
            <span className="document-title" title={currentDocument.filePath}>
              {currentDocument.title || "Untitled"}
            </span>
          )}
        </div>

        <div className="toolbar-section toolbar-center">
          {pdfDocument && <PageNavigation />}
        </div>

        <div className="toolbar-section toolbar-right">
          {pdfDocument && <ZoomControls />}
        </div>
      </div>

      {/* Session Menu Panel (T073) */}
      <SessionMenu
        isOpen={isSessionMenuOpen}
        onClose={() => setIsSessionMenuOpen(false)}
        onSessionRestored={handleSessionRestored}
      />
    </>
  );
}
