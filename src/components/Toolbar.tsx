import { useState, useRef } from "react";
import { useDocumentStore } from "../stores/document-store";
import { useOpenPdf } from "../hooks/useOpenPdf";
import { useRovingTabindex } from "../hooks/useRovingTabindex";
import { PageNavigation } from "./PageNavigation";
import { ZoomControls } from "./ZoomControls";
import { SessionMenu } from "./session-menu/SessionMenu";
import "./Toolbar.css";

interface ToolbarProps {
  /**
   * Fired when a reading session is restored. Toolbar only owns the menu
   * surface; the shell (ReaderView) owns the document surface, so the open
   * lands there — same shape as `LibraryView onDocumentSelect`.
   */
  onSessionRestored?: (sessionId: string) => void;
  /**
   * Fired after the toolbar's Open button successfully loads a document.
   * Toolbar loads the file into the store; the shell owns the surface swap,
   * so it must be told to leave the library (slice 109 B1 — the book loaded
   * and the user kept staring at the library).
   */
  onOpen?: () => void;
  /** Opens the app-wide settings panel owned by the reader shell. */
  onSettings?: () => void;
}

export function Toolbar({
  onSessionRestored,
  onOpen,
  onSettings,
}: Readonly<ToolbarProps>) {
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
  const { openPdf } = useOpenPdf();
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Roving tabindex for keyboard navigation within the toolbar
  const { getItemProps } = useRovingTabindex({
    containerRef: toolbarRef,
    itemSelector: "button.toolbar-roving-item",
    orientation: "horizontal",
    loop: true,
  });

  const { currentDocument, pdfDocument, isLoading } = useDocumentStore();

  const handleOpenFile = async () => {
    if (isLoading) return;
    // Slice 112: collapse onto the shared useOpenPdf flow — Toolbar kept its
    // own copy of the open logic (dialog -> load -> library upsert -> store)
    // which had already diverged once. One copy now.
    if (await openPdf()) onOpen?.();
  };

  const handleSessionRestored = (sessionId: string) => {
    // Close the session menu after restoring; the shell opens the session's
    // document (restore previously closed the menu and opened nothing).
    setIsSessionMenuOpen(false);
    onSessionRestored?.(sessionId);
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
            className="toolbar-button toolbar-roving-item sessions-button"
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
            className="toolbar-button toolbar-roving-item open-button"
            onClick={handleOpenFile}
            aria-disabled={isLoading}
            title="Open PDF file"
            {...getItemProps(1)}
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
          <button
            type="button"
            className="toolbar-button toolbar-roving-item settings-button"
            onClick={onSettings}
            title="Settings"
            aria-label="Settings"
            {...getItemProps(2)}
          >
            <svg
              viewBox="0 0 24 24"
              className="toolbar-icon"
              aria-hidden="true"
            >
              <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
              <path d="M19.4 15a1.7 1.7 0 00.34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 00-1.88-.34 1.7 1.7 0 00-1.03 1.56V21h-4v-.09A1.7 1.7 0 009 19.35a1.7 1.7 0 00-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 004.63 15a1.7 1.7 0 00-1.56-1.03H3v-4h.09A1.7 1.7 0 004.65 9a1.7 1.7 0 00-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 009 4.63 1.7 1.7 0 0010.03 3.1V3h4v.09A1.7 1.7 0 0015 4.65a1.7 1.7 0 001.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0019.37 9a1.7 1.7 0 001.56 1.03H21v4h-.09A1.7 1.7 0 0019.4 15z" />
            </svg>
            <span className="button-text">Settings</span>
          </button>
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
