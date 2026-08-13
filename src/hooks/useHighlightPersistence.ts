import { useCallback, useRef, useEffect } from "react";
import {
  highlightsCreate,
  highlightsUpdate,
  highlightsDelete,
  highlightsListForDocument,
  highlightsListForPage,
  type CreateHighlightInput,
} from "../lib/tauri-invoke";
import type { Highlight } from "../lib/schemas";

interface UseHighlightPersistenceOptions {
  documentId: string | null;
  debounceMs?: number;
  onError?: (error: Error) => void;
}

interface PendingUpdate {
  highlight: Highlight;
  type: "create" | "update" | "delete";
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
  // The in-flight flush — a concurrent caller (the close flush) must JOIN it
  // rather than resolve while writes are still unlanded.
  const flushInFlightRef = useRef<Promise<void> | null>(null);

  /**
   * Flush every pending update. `propagateFailure` splits the semantics:
   * background flushes (debounce, navigation) re-queue failures for retry
   * and settle; the EXPLICIT close flush passes `true`, does NOT re-queue,
   * and THROWS — the close protocol must refuse to ack a flush that did
   * not land.
   */
  const flushUpdates = useCallback(
    (opts?: { propagateFailure?: boolean }): Promise<void> => {
      if (flushInFlightRef.current) {
        // Join the in-flight flush. A propagate caller must also learn its
        // outcome — the shared promise carries it.
        return flushInFlightRef.current;
      }
      const propagate = opts?.propagateFailure === true;
      const run = (async () => {
        if (pendingUpdatesRef.current.size === 0) return;
        isFlushing.current = true;
        const updates = new Map(pendingUpdatesRef.current);
        pendingUpdatesRef.current.clear();
        let firstError: unknown = null;

        for (const [id, pending] of updates) {
          try {
            switch (pending.type) {
              case "create":
                await highlightsCreate({
                  documentId: pending.highlight.documentId,
                  pageNumber: pending.highlight.pageNumber,
                  rects: pending.highlight.rects,
                  color: pending.highlight.color,
                  textContent: pending.highlight.textContent ?? undefined,
                } satisfies CreateHighlightInput);
                break;

              case "update":
                await highlightsUpdate(pending.highlight.id, {
                  color: pending.highlight.color,
                  note: pending.highlight.note,
                });
                break;

              case "delete":
                await highlightsDelete(pending.highlight.id);
                break;
            }
          } catch (error) {
            console.error(`Failed to ${pending.type} highlight:`, error);
            onError?.(
              error instanceof Error ? error : new Error(String(error)),
            );

            if (propagate) {
              // The close path: no re-queue — the window is going away.
              firstError ??= error;
            } else if (pending.type !== "delete") {
              // Background path: re-queue failed updates for retry.
              pendingUpdatesRef.current.set(id, pending);
            }
          }
        }

        isFlushing.current = false;

        // If there are re-queued updates, schedule another flush
        if (pendingUpdatesRef.current.size > 0) {
          scheduleFlush();
        }

        if (propagate && firstError) throw firstError;
      })();
      flushInFlightRef.current = run.finally(() => {
        flushInFlightRef.current = null;
      });
      return flushInFlightRef.current;
    },
    [onError],
  );

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
        type: "create",
        timestamp: Date.now(),
      });
      scheduleFlush();
    },
    [documentId, scheduleFlush],
  );

  // Update an existing highlight
  const updateHighlight = useCallback(
    (highlight: Highlight) => {
      if (!documentId) return;

      const existing = pendingUpdatesRef.current.get(highlight.id);

      // If there's a pending create, just update the highlight data
      if (existing?.type === "create") {
        pendingUpdatesRef.current.set(highlight.id, {
          highlight,
          type: "create",
          timestamp: Date.now(),
        });
      } else {
        pendingUpdatesRef.current.set(highlight.id, {
          highlight,
          type: "update",
          timestamp: Date.now(),
        });
      }
      scheduleFlush();
    },
    [documentId, scheduleFlush],
  );

  // Delete a highlight
  const deleteHighlight = useCallback(
    (highlight: Highlight) => {
      if (!documentId) return;

      const existing = pendingUpdatesRef.current.get(highlight.id);

      // If there's a pending create, just remove it (never persisted)
      if (existing?.type === "create") {
        pendingUpdatesRef.current.delete(highlight.id);
      } else {
        pendingUpdatesRef.current.set(highlight.id, {
          highlight,
          type: "delete",
          timestamp: Date.now(),
        });
      }
      scheduleFlush();
    },
    [documentId, scheduleFlush],
  );

  // Flush immediately (useful before navigation and on the close protocol)
  const flushImmediately = useCallback(
    async (opts?: { propagateFailure?: boolean }) => {
      if (flushTimeoutRef.current) {
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      // First pass joins any in-flight flush; a second pass drains anything
      // a concurrent enqueue added while the first was running.
      await flushUpdates(opts);
      await flushUpdates(opts);
    },
    [flushUpdates],
  );

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
    console.error("Failed to load highlights:", error);
    return [];
  }
}

/**
 * Load highlights for a specific page
 */
export async function loadHighlightsForPage(
  documentId: string,
  pageNumber: number,
): Promise<Highlight[]> {
  try {
    const response = await highlightsListForPage(documentId, pageNumber);
    return response.highlights;
  } catch (error) {
    console.error("Failed to load highlights for page:", error);
    return [];
  }
}
