/**
 * Highlight creation workflow.
 *
 * 1. Receives text selection from TextLayer
 * 2. Shows HighlightToolbar at selection position
 * 3. On color pick — or on Ctrl+Shift+H, which skips the toolbar and uses the
 *    default colour — creates a Highlight, persists it, updates the store
 * 4. Clears selection after creation
 *
 * The keyboard path exists because the mouse path costs two deliberate acts per
 * highlight (drag to select, then click a colour). At the density this app is
 * actually used for — short, frequent highlights across a few hundred pages —
 * that second act is what stops the habit. Ctrl+Shift+H removes it, and makes
 * the whole flow reachable from the keyboard when the selection was made with
 * Shift+arrows.
 *
 * Note the shortcut is registered HERE rather than in `useKeyboardShortcuts`:
 * that hook has no call site anywhere in the app, and it has no access to the
 * pending selection, which lives in this hook's state.
 */

import { useCallback, useEffect, useState } from "react";
import { HighlightToolbar, calculateToolbarPosition } from "./HighlightToolbar";
import { useDocumentStore } from "../../stores/document-store";
import { useHighlightPersistence } from "../../hooks/useHighlightPersistence";
import { useToastStore } from "../../stores/toast-store";
import { useSettingsStore } from "../../stores/settings-store";
import type { TextSelection } from "../TextLayer";
import type { Highlight, Rect } from "../../lib/schemas";

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
 * The highlight-creation hook. Mounted per page by `PdfPage`, and by
 * `PdfViewer` for the single-page path.
 */
export function useHighlightCreation({
  documentId,
  scale,
  containerRef,
  onSuccess,
  onError,
}: Omit<HighlightCreationHandlerProps, "pageNumber">) {
  const [pendingSelection, setPendingSelection] =
    useState<TextSelection | null>(null);
  const { addHighlight } = useDocumentStore();
  const toastSuccess = useToastStore((s) => s.success);
  const defaultColor = useSettingsStore((s) => s.highlightDefaultColor);

  const { createHighlight } = useHighlightPersistence({
    documentId,
    onError: onError ? (err) => onError(err) : undefined,
  });

  // Handle text selection from TextLayer
  const handleTextSelect = useCallback((selection: TextSelection) => {
    setPendingSelection(selection);
  }, []);

  // Handle color selection from toolbar
  const handleHighlight = useCallback(
    (color: string) => {
      if (!pendingSelection || !documentId) {
        console.warn(
          "[useHighlightCreation] Cannot create highlight: missing selection or documentId",
        );
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

      // Add to store (immediate UI update)
      addHighlight(highlight);

      // Persist to backend (async, with retry)
      createHighlight(highlight);

      // Notify success callback
      onSuccess?.(highlight);
      toastSuccess("Highlight created");

      // Clear selection
      setPendingSelection(null);
      window.getSelection()?.removeAllRanges();
    },
    [
      pendingSelection,
      documentId,
      addHighlight,
      createHighlight,
      onSuccess,
      toastSuccess,
    ],
  );

  // Handle cancellation (click outside, Escape key)
  const handleCancel = useCallback(() => {
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Ctrl+Shift+H commits the pending selection with the default colour and
  // skips the toolbar. Bound only while a selection is actually pending, so the
  // shortcut is inert the rest of the time and cannot fire against a stale
  // selection. Ctrl+H is already taken (toggles the highlights panel).
  useEffect(() => {
    if (!pendingSelection) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // With Shift held the browser reports `key` as "H", so compare folded
      // rather than against one casing. Alt excluded so Ctrl+Alt+Shift+H (a
      // different chord, possibly a system one) does not silently highlight.
      if (
        !event.ctrlKey ||
        !event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== "h"
      ) {
        return;
      }
      event.preventDefault();
      handleHighlight(defaultColor);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pendingSelection, defaultColor, handleHighlight]);

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
