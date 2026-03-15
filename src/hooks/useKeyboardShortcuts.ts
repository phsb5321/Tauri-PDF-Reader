import { useEffect, useCallback } from "react";
import { useFileDialog, FILE_FILTERS } from "./useFileDialog";
import { useDocumentStore } from "../stores/document-store";
import { pdfService } from "../services/pdf-service";
import { libraryService } from "../services/library-service";

export interface KeyboardShortcutHandlers {
  /** Open file dialog */
  onOpenFile?: () => void;
  /** Toggle settings panel */
  onToggleSettings?: () => void;
  /** Toggle highlights panel */
  onToggleHighlights?: () => void;
  /** Toggle library/sidebar */
  onToggleLibrary?: () => void;
  /** Close modal or panel */
  onEscape?: () => void;
  /** Open search/find */
  onSearch?: () => void;
  /** Navigate to next page */
  onNextPage?: () => void;
  /** Navigate to previous page */
  onPreviousPage?: () => void;
  /** Toggle TTS play/pause */
  onTogglePlayback?: () => void;
}

/**
 * Global keyboard shortcuts handler
 * Implements standard document reader shortcuts per UI_RESEARCH.md
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers = {}) {
  const { setDocument, setPdfDocument, setLoading, setError, setCurrentPage } =
    useDocumentStore();
  const { openFile } = useFileDialog();

  // Default open file handler
  const handleOpenFile = useCallback(async () => {
    if (handlers.onOpenFile) {
      handlers.onOpenFile();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const selected = await openFile({
        multiple: false,
        filters: [FILE_FILTERS.PDF],
      });

      if (!selected) {
        setLoading(false);
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
    handlers,
    setDocument,
    setPdfDocument,
    setLoading,
    setError,
    setCurrentPage,
    openFile,
  ]);

  // Default toggle settings handler
  const handleToggleSettings = useCallback(() => {
    handlers.onToggleSettings?.();
  }, [handlers]);

  // Default escape handler
  const handleEscape = useCallback(() => {
    handlers.onEscape?.();
  }, [handlers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Ctrl+O: Open file
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        handleOpenFile();
        return;
      }

      // Ctrl+,: Open settings
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        handleToggleSettings();
        return;
      }

      // Ctrl+H: Toggle highlights panel
      if (e.ctrlKey && e.key === "h") {
        e.preventDefault();
        handlers.onToggleHighlights?.();
        return;
      }

      // Ctrl+B: Toggle library/sidebar
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        handlers.onToggleLibrary?.();
        return;
      }

      // Escape: Close modals/panels
      if (e.key === "Escape") {
        e.preventDefault();
        handleEscape();
        return;
      }

      // Space: Toggle TTS play/pause (only when not in input)
      if (e.key === " " && !isInput) {
        e.preventDefault();
        handlers.onTogglePlayback?.();
        return;
      }

      // Ctrl+F: Search/Find
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        handlers.onSearch?.();
        return;
      }

      // PageDown: Next page (only when not in input)
      if (e.key === "PageDown" && !isInput) {
        e.preventDefault();
        handlers.onNextPage?.();
        return;
      }

      // PageUp: Previous page (only when not in input)
      if (e.key === "PageUp" && !isInput) {
        e.preventDefault();
        handlers.onPreviousPage?.();
        return;
      }

      // Arrow Right: Next page (only when not in input)
      if (e.key === "ArrowRight" && !isInput) {
        e.preventDefault();
        handlers.onNextPage?.();
        return;
      }

      // Arrow Left: Previous page (only when not in input)
      if (e.key === "ArrowLeft" && !isInput) {
        e.preventDefault();
        handlers.onPreviousPage?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenFile, handleToggleSettings, handleEscape, handlers]);

  return {
    openFile: handleOpenFile,
    toggleSettings: handleToggleSettings,
    escape: handleEscape,
  };
}

/**
 * Keyboard shortcut definitions for documentation
 */
export const KEYBOARD_SHORTCUTS = [
  { keys: ["Ctrl", "O"], description: "Open file", category: "File" },
  { keys: ["Ctrl", "F"], description: "Search / Find", category: "File" },
  { keys: ["Ctrl", ","], description: "Open settings", category: "Navigation" },
  {
    keys: ["Ctrl", "H"],
    description: "Toggle highlights panel",
    category: "Navigation",
  },
  {
    keys: ["Ctrl", "B"],
    description: "Toggle library sidebar",
    category: "Navigation",
  },
  {
    keys: ["Escape"],
    description: "Close modal/panel",
    category: "Navigation",
  },
  { keys: ["Space"], description: "Play/Pause TTS", category: "Playback" },
  { keys: ["←", "→"], description: "Previous/Next page", category: "Document" },
  { keys: ["Page Up"], description: "Previous page", category: "Document" },
  { keys: ["Page Down"], description: "Next page", category: "Document" },
  { keys: ["Ctrl", "+"], description: "Zoom in", category: "View" },
  { keys: ["Ctrl", "-"], description: "Zoom out", category: "View" },
] as const;
