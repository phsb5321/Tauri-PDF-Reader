/**
 * HighlightCreationHandler Component
 *
 * Orchestrates the highlight creation workflow:
 * 1. Receives text selection from TextLayer
 * 2. Shows HighlightToolbar at selection position
 * 3. On color pick: creates Highlight object, persists to backend, updates store
 * 4. Clears selection after creation
 */

import { useCallback, useState } from 'react';
import { HighlightToolbar, calculateToolbarPosition } from './HighlightToolbar';
import { useDocumentStore } from '../../stores/document-store';
import { useHighlightPersistence } from '../../hooks/useHighlightPersistence';
import type { TextSelection } from '../TextLayer';
import type { Highlight, Rect } from '../../lib/schemas';

/**
 * Generate a UUID v4 using the native crypto API
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

interface HighlightCreationHandlerProps {
  documentId: string | null;
  scale: number;
  containerRef: React.RefObject<HTMLElement>;
  onSuccess?: (highlight: Highlight) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook and component for handling highlight creation from text selections
 */
export function HighlightCreationHandler({
  documentId,
  scale,
  containerRef,
  onSuccess,
  onError,
}: HighlightCreationHandlerProps) {
  const [pendingSelection, setPendingSelection] = useState<TextSelection | null>(null);
  const { addHighlight } = useDocumentStore();

  const { createHighlight } = useHighlightPersistence({
    documentId,
    onError: onError ? (err) => onError(err) : undefined,
  });

  // Handle text selection from TextLayer
  const handleTextSelect = useCallback((selection: TextSelection) => {
    console.debug('[HighlightCreationHandler] Text selected:', {
      textLength: selection.text.length,
      rectsCount: selection.rects.length,
      pageNumber: selection.pageNumber,
    });
    setPendingSelection(selection);
  }, []);

  // Handle color selection from toolbar
  const handleHighlight = useCallback(
    (color: string) => {
      if (!pendingSelection || !documentId) {
        console.warn('[HighlightCreationHandler] Cannot create highlight: missing selection or documentId');
        return;
      }

      // Create highlight object with UUID
      const highlight: Highlight = {
        id: generateUUID(),
        documentId,
        pageNumber: pendingSelection.pageNumber,
        rects: pendingSelection.rects,
        color,
        textContent: pendingSelection.text,
        note: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

      console.debug('[HighlightCreationHandler] Creating highlight:', {
        id: highlight.id,
        color,
        pageNumber: highlight.pageNumber,
        rectsCount: highlight.rects.length,
      });

      // Add to store (immediate UI update)
      addHighlight(highlight);

      // Persist to backend (async, with retry)
      createHighlight(highlight);

      // Notify success callback
      onSuccess?.(highlight);

      // Clear selection
      setPendingSelection(null);
      window.getSelection()?.removeAllRanges();
    },
    [pendingSelection, documentId, addHighlight, createHighlight, onSuccess]
  );

  // Handle cancellation (click outside, Escape key)
  const handleCancel = useCallback(() => {
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Calculate toolbar position from selection rects
  const toolbarPosition = pendingSelection
    ? calculateToolbarPosition(pendingSelection.rects, scale)
    : null;

  // Scale rects for toolbar positioning
  const scaledRects: Rect[] = pendingSelection
    ? pendingSelection.rects.map((rect) => ({
        x: rect.x * scale,
        y: rect.y * scale,
        width: rect.width * scale,
        height: rect.height * scale,
      }))
    : [];

  return {
    handleTextSelect,
    toolbar: pendingSelection ? (
      <HighlightToolbar
        position={toolbarPosition}
        onHighlight={handleHighlight}
        onCancel={handleCancel}
        selectedRects={scaledRects}
        containerRef={containerRef}
      />
    ) : null,
  };
}

/**
 * Hook version for use with existing components
 */
export function useHighlightCreation({
  documentId,
  scale,
  containerRef,
  onSuccess,
  onError,
}: Omit<HighlightCreationHandlerProps, 'pageNumber'>) {
  const [pendingSelection, setPendingSelection] = useState<TextSelection | null>(null);
  const { addHighlight } = useDocumentStore();

  const { createHighlight } = useHighlightPersistence({
    documentId,
    onError: onError ? (err) => onError(err) : undefined,
  });

  // Handle text selection from TextLayer
  const handleTextSelect = useCallback((selection: TextSelection) => {
    console.debug('[useHighlightCreation] Text selected:', {
      textLength: selection.text.length,
      rectsCount: selection.rects.length,
      pageNumber: selection.pageNumber,
    });
    setPendingSelection(selection);
  }, []);

  // Handle color selection from toolbar
  const handleHighlight = useCallback(
    (color: string) => {
      if (!pendingSelection || !documentId) {
        console.warn('[useHighlightCreation] Cannot create highlight: missing selection or documentId');
        return;
      }

      // Create highlight object with UUID
      const highlight: Highlight = {
        id: generateUUID(),
        documentId,
        pageNumber: pendingSelection.pageNumber,
        rects: pendingSelection.rects,
        color,
        textContent: pendingSelection.text,
        note: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

      console.debug('[useHighlightCreation] Creating highlight:', {
        id: highlight.id,
        color,
        pageNumber: highlight.pageNumber,
        rectsCount: highlight.rects.length,
      });

      // Add to store (immediate UI update)
      addHighlight(highlight);

      // Persist to backend (async, with retry)
      createHighlight(highlight);

      // Notify success callback
      onSuccess?.(highlight);

      // Clear selection
      setPendingSelection(null);
      window.getSelection()?.removeAllRanges();
    },
    [pendingSelection, documentId, addHighlight, createHighlight, onSuccess]
  );

  // Handle cancellation (click outside, Escape key)
  const handleCancel = useCallback(() => {
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Calculate toolbar position from selection rects
  const toolbarPosition = pendingSelection
    ? calculateToolbarPosition(pendingSelection.rects, scale)
    : null;

  // Scale rects for toolbar positioning
  const scaledRects: Rect[] = pendingSelection
    ? pendingSelection.rects.map((rect) => ({
        x: rect.x * scale,
        y: rect.y * scale,
        width: rect.width * scale,
        height: rect.height * scale,
      }))
    : [];

  return {
    pendingSelection,
    handleTextSelect,
    handleHighlight,
    handleCancel,
    toolbarPosition,
    scaledRects,
    ToolbarComponent: pendingSelection ? (
      <HighlightToolbar
        position={toolbarPosition}
        onHighlight={handleHighlight}
        onCancel={handleCancel}
        selectedRects={scaledRects}
        containerRef={containerRef}
      />
    ) : null,
  };
}
