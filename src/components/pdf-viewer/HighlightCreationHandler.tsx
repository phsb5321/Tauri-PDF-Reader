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
 * Note the shortcut is registered HERE rather than in the global chord table
 * (`useCommandKeys`): it needs the pending selection, which lives in this
 * hook's state and which a window-level listener cannot see.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
 * The highlight-creation hook.
 *
 * One live mount: `PdfViewer.tsx:90`, reached by `App` -> `ReaderView` ->
 * `PdfViewer`. `PdfPage.tsx:64` also calls it, but `<PdfPage` has no render
 * site anywhere in `src/` and never has (`git log -S`), so it is dead code.
 *
 * That matters for the duplicate-commit latch below: it is per-instance. If
 * `PdfPage` is ever wired up for continuous scroll while `PdfViewer` still
 * mounts the hook itself, both instances would hold the same selection and one
 * Ctrl+Shift+H would produce two highlights, which no per-instance latch can
 * see. Whoever wires it up owns the selection in ONE place.
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
  // The selection already committed, so a burst cannot commit it twice. See
  // the note in `handleHighlight`.
  const committedSelectionRef = useRef<TextSelection | null>(null);

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

      // `setPendingSelection(null)` below does not take effect until React
      // flushes, which it cannot do until the current task yields. So every
      // event in a burst — an auto-repeat of Ctrl+Shift+H, or a double-fire of
      // the toolbar button — still sees the selection set and creates its own
      // highlight. Measured before this latch: holding the chord produced 5.
      //
      // The latch is a ref because it has to be readable and writable in the
      // same synchronous turn, which state is not. Comparing the selection
      // OBJECT means a genuinely new selection is never suppressed, so it
      // needs no reset.
      if (committedSelectionRef.current === pendingSelection) return;
      committedSelectionRef.current = pendingSelection;

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

      // Persist to backend (async, with retry). The flush is awaited BEFORE
      // the success UX: "Highlight created" must never precede the write
      // attempt (exact-head codex review, MAJOR). The promise settles when
      // the attempt finishes (background semantics — a failure re-queues and
      // surfaces via onError, it does not throw), so under a hard teardown
      // that kills the write mid-flight the toast is never shown.
      const persist = createHighlight(highlight);
      const succeed = (): void => {
        onSuccess?.(highlight);
        toastSuccess("Highlight created");
      };
      if (persist) {
        void persist.then(succeed);
      } else {
        succeed();
      }

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
