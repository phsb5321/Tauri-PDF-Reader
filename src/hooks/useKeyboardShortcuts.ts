import { useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useDocumentStore } from '../stores/document-store';
import { pdfService } from '../services/pdf-service';
import { libraryService } from '../services/library-service';

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
}

/**
 * Global keyboard shortcuts handler
 * Implements standard document reader shortcuts per UI_RESEARCH.md
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers = {}) {
  const {
    setDocument,
    setPdfDocument,
    setLoading,
    setError,
    setCurrentPage
  } = useDocumentStore();

  // Default open file handler
  const handleOpenFile = useCallback(async () => {
    if (handlers.onOpenFile) {
      handlers.onOpenFile();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'PDF Documents',
            extensions: ['pdf'],
          },
        ],
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
      const message = error instanceof Error ? error.message : 'Failed to open PDF';
      setError(message);
      console.error('Error opening PDF:', error);
    } finally {
      setLoading(false);
    }
  }, [handlers, setDocument, setPdfDocument, setLoading, setError, setCurrentPage]);

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
      const isInput = target.tagName === 'INPUT' ||
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable;

      // Ctrl+O: Open file
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        handleOpenFile();
        return;
      }

      // Ctrl+,: Open settings
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        handleToggleSettings();
        return;
      }

      // Ctrl+H: Toggle highlights panel
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        handlers.onToggleHighlights?.();
        return;
      }

      // Ctrl+B: Toggle library/sidebar
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        handlers.onToggleLibrary?.();
        return;
      }

      // Escape: Close modals/panels
      if (e.key === 'Escape') {
        e.preventDefault();
        handleEscape();
        return;
      }

      // Space: Toggle TTS play/pause (only when not in input)
      if (e.key === ' ' && !isInput) {
        // TTS play/pause handled by playback bar component
        // This is a placeholder for future integration
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
  { keys: ['Ctrl', 'O'], description: 'Open file', category: 'File' },
  { keys: ['Ctrl', ','], description: 'Open settings', category: 'Navigation' },
  { keys: ['Ctrl', 'H'], description: 'Toggle highlights panel', category: 'Navigation' },
  { keys: ['Ctrl', 'B'], description: 'Toggle library sidebar', category: 'Navigation' },
  { keys: ['Escape'], description: 'Close modal/panel', category: 'Navigation' },
  { keys: ['Space'], description: 'Play/Pause TTS', category: 'Playback' },
  { keys: ['←', '→'], description: 'Previous/Next page', category: 'Document' },
  { keys: ['Ctrl', '+'], description: 'Zoom in', category: 'View' },
  { keys: ['Ctrl', '-'], description: 'Zoom out', category: 'View' },
] as const;
