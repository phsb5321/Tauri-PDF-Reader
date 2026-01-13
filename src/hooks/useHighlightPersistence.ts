import { useCallback, useRef, useEffect } from 'react';
import {
  highlightsCreate,
  highlightsUpdate,
  highlightsDelete,
  highlightsListForDocument,
  highlightsListForPage,
  type CreateHighlightInput,
} from '../lib/tauri-invoke';
import type { Highlight } from '../lib/schemas';

interface UseHighlightPersistenceOptions {
  documentId: string | null;
  debounceMs?: number;
  onError?: (error: Error) => void;
}

interface PendingUpdate {
  highlight: Highlight;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
}

/**
 * Hook for persisting highlights to the backend with debouncing
 * Handles create, update, and delete operations with automatic retry
 */
export function useHighlightPersistence({
  documentId,
  debounceMs = 500,
  onError,
}: UseHighlightPersistenceOptions) {
  const pendingUpdatesRef = useRef<Map<string, PendingUpdate>>(new Map());
  const flushTimeoutRef = useRef<number | null>(null);
  const isFlushing = useRef(false);

  // Flush pending updates to backend
  const flushUpdates = useCallback(async () => {
    if (isFlushing.current || pendingUpdatesRef.current.size === 0) {
      return;
    }

    isFlushing.current = true;
    const updates = new Map(pendingUpdatesRef.current);
    pendingUpdatesRef.current.clear();

    for (const [id, pending] of updates) {
      try {
        switch (pending.type) {
          case 'create':
            await highlightsCreate({
              documentId: pending.highlight.documentId,
              pageNumber: pending.highlight.pageNumber,
              rects: pending.highlight.rects,
              color: pending.highlight.color,
              textContent: pending.highlight.textContent ?? undefined,
            } satisfies CreateHighlightInput);
            break;

          case 'update':
            await highlightsUpdate(pending.highlight.id, {
              color: pending.highlight.color,
              note: pending.highlight.note,
            });
            break;

          case 'delete':
            await highlightsDelete(pending.highlight.id);
            break;
        }
      } catch (error) {
        console.error(`Failed to ${pending.type} highlight:`, error);
        onError?.(error instanceof Error ? error : new Error(String(error)));

        // Re-queue failed updates for retry (except deletes)
        if (pending.type !== 'delete') {
          pendingUpdatesRef.current.set(id, pending);
        }
      }
    }

    isFlushing.current = false;

    // If there are re-queued updates, schedule another flush
    if (pendingUpdatesRef.current.size > 0) {
      scheduleFlush();
    }
  }, [onError]);

  // Schedule a debounced flush
  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) {
      window.clearTimeout(flushTimeoutRef.current);
    }
    flushTimeoutRef.current = window.setTimeout(flushUpdates, debounceMs);
  }, [flushUpdates, debounceMs]);

  // Create a new highlight
  const createHighlight = useCallback(
    (highlight: Highlight) => {
      if (!documentId) return;

      pendingUpdatesRef.current.set(highlight.id, {
        highlight,
        type: 'create',
        timestamp: Date.now(),
      });
      scheduleFlush();
    },
    [documentId, scheduleFlush]
  );

  // Update an existing highlight
  const updateHighlight = useCallback(
    (highlight: Highlight) => {
      if (!documentId) return;

      const existing = pendingUpdatesRef.current.get(highlight.id);

      // If there's a pending create, just update the highlight data
      if (existing?.type === 'create') {
        pendingUpdatesRef.current.set(highlight.id, {
          highlight,
          type: 'create',
          timestamp: Date.now(),
        });
      } else {
        pendingUpdatesRef.current.set(highlight.id, {
          highlight,
          type: 'update',
          timestamp: Date.now(),
        });
      }
      scheduleFlush();
    },
    [documentId, scheduleFlush]
  );

  // Delete a highlight
  const deleteHighlight = useCallback(
    (highlight: Highlight) => {
      if (!documentId) return;

      const existing = pendingUpdatesRef.current.get(highlight.id);

      // If there's a pending create, just remove it (never persisted)
      if (existing?.type === 'create') {
        pendingUpdatesRef.current.delete(highlight.id);
      } else {
        pendingUpdatesRef.current.set(highlight.id, {
          highlight,
          type: 'delete',
          timestamp: Date.now(),
        });
      }
      scheduleFlush();
    },
    [documentId, scheduleFlush]
  );

  // Flush immediately (useful before navigation)
  const flushImmediately = useCallback(async () => {
    if (flushTimeoutRef.current) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    await flushUpdates();
  }, [flushUpdates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        window.clearTimeout(flushTimeoutRef.current);
      }
      // Attempt to flush any pending updates
      if (pendingUpdatesRef.current.size > 0) {
        flushUpdates();
      }
    };
  }, [flushUpdates]);

  // Flush when document changes
  useEffect(() => {
    return () => {
      flushImmediately();
    };
  }, [documentId, flushImmediately]);

  return {
    createHighlight,
    updateHighlight,
    deleteHighlight,
    flushImmediately,
    hasPendingUpdates: () => pendingUpdatesRef.current.size > 0,
  };
}

/**
 * Load highlights for a document from the backend
 */
export async function loadHighlights(documentId: string): Promise<Highlight[]> {
  try {
    const response = await highlightsListForDocument(documentId);
    return response.highlights;
  } catch (error) {
    console.error('Failed to load highlights:', error);
    return [];
  }
}

/**
 * Load highlights for a specific page
 */
export async function loadHighlightsForPage(
  documentId: string,
  pageNumber: number
): Promise<Highlight[]> {
  try {
    const response = await highlightsListForPage(documentId, pageNumber);
    return response.highlights;
  } catch (error) {
    console.error('Failed to load highlights for page:', error);
    return [];
  }
}
