import { useState, useCallback, useEffect, useRef } from 'react';
import type { Rect } from '../lib/schemas';

export interface TextSelection {
  text: string;
  rects: Rect[];
  pageNumber: number;
  anchorNode: Node | null;
  focusNode: Node | null;
}

interface UseTextSelectionOptions {
  containerRef: React.RefObject<HTMLElement>;
  pageNumber: number;
  scale: number;
  onSelectionChange?: (selection: TextSelection | null) => void;
  enabled?: boolean;
}

/**
 * Hook for capturing text selections within a PDF page
 * Converts browser selection coordinates to PDF page coordinates
 */
export function useTextSelection({
  containerRef,
  pageNumber,
  scale,
  onSelectionChange,
  enabled = true,
}: UseTextSelectionOptions) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionTimeoutRef = useRef<number | null>(null);

  // Get selection rectangles relative to the container
  const getSelectionRects = useCallback(
    (domSelection: Selection): Rect[] => {
      if (!containerRef.current || domSelection.rangeCount === 0) {
        return [];
      }

      const range = domSelection.getRangeAt(0);
      const clientRects = range.getClientRects();
      const containerRect = containerRef.current.getBoundingClientRect();

      const rects: Rect[] = [];

      for (let i = 0; i < clientRects.length; i++) {
        const rect = clientRects[i];

        // Skip very small rects (often artifacts)
        if (rect.width < 1 || rect.height < 1) continue;

        // Convert to PDF page coordinates (unscaled)
        rects.push({
          x: (rect.left - containerRect.left) / scale,
          y: (rect.top - containerRect.top) / scale,
          width: rect.width / scale,
          height: rect.height / scale,
        });
      }

      return mergeAdjacentRects(rects);
    },
    [containerRef, scale]
  );

  // Handle selection change
  const handleSelectionChange = useCallback(() => {
    if (!enabled || !containerRef.current) return;

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.isCollapsed) {
      // Clear selection after a short delay (allows for click handling)
      if (selectionTimeoutRef.current) {
        window.clearTimeout(selectionTimeoutRef.current);
      }
      selectionTimeoutRef.current = window.setTimeout(() => {
        setSelection(null);
        onSelectionChange?.(null);
      }, 100);
      return;
    }

    // Clear any pending clear timeout
    if (selectionTimeoutRef.current) {
      window.clearTimeout(selectionTimeoutRef.current);
      selectionTimeoutRef.current = null;
    }

    const selectedText = domSelection.toString().trim();
    if (!selectedText) {
      setSelection(null);
      onSelectionChange?.(null);
      return;
    }

    // Check if selection is within our container
    const anchorNode = domSelection.anchorNode;
    const focusNode = domSelection.focusNode;
    if (
      !anchorNode ||
      !focusNode ||
      !containerRef.current.contains(anchorNode) ||
      !containerRef.current.contains(focusNode)
    ) {
      return;
    }

    const rects = getSelectionRects(domSelection);
    if (rects.length === 0) return;

    const newSelection: TextSelection = {
      text: selectedText,
      rects,
      pageNumber,
      anchorNode,
      focusNode,
    };

    setSelection(newSelection);
    onSelectionChange?.(newSelection);
  }, [enabled, containerRef, pageNumber, getSelectionRects, onSelectionChange]);

  // Set up selection event listeners
  useEffect(() => {
    if (!enabled) return;

    const handleMouseDown = () => {
      setIsSelecting(true);
    };

    const handleMouseUp = () => {
      setIsSelecting(false);
      // Delay to allow selection to stabilize
      requestAnimationFrame(() => {
        handleSelectionChange();
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);

      if (selectionTimeoutRef.current) {
        window.clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, [enabled, handleSelectionChange]);

  // Clear selection
  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    onSelectionChange?.(null);
  }, [onSelectionChange]);

  return {
    selection,
    isSelecting,
    clearSelection,
    hasSelection: selection !== null && selection.rects.length > 0,
  };
}

/**
 * Merge adjacent rectangles that are on the same line
 */
function mergeAdjacentRects(rects: Rect[]): Rect[] {
  if (rects.length <= 1) return rects;

  // Sort by Y then X position
  const sorted = [...rects].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 2) return yDiff;
    return a.x - b.x;
  });

  const merged: Rect[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if on same line (within 2px tolerance) and adjacent
    const sameLine = Math.abs(current.y - next.y) <= 2;
    const adjacent = next.x <= current.x + current.width + 5;

    if (sameLine && adjacent) {
      // Merge rectangles
      const newRight = Math.max(current.x + current.width, next.x + next.width);
      current = {
        x: Math.min(current.x, next.x),
        y: Math.min(current.y, next.y),
        width: newRight - Math.min(current.x, next.x),
        height: Math.max(current.height, next.height),
      };
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}
