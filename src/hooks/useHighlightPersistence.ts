import { useCallback, useEffect } from "react";
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
  /** The enqueuing instance's error callback — per-ENTRY, so a stale
   * instance can never receive another document's failures. */
  onError?: (error: Error) => void;
}

// ── Module-level shared persistence state ────────────────────────────────
// The close protocol must flush EVERY debounced writer, regardless of which
// hook instance queued the write. The highlight path has TWO instances —
// ReaderView (delete + the close flush) and HighlightCreationHandler
// (create) — so the pending map, the in-flight flush, the debounce timer,
// and the failure record are SHARED module state, never per-instance refs.
// A just-created highlight must not be acknowledged as flushed by the other
// instance's empty queue (the western review's blocker).
const pendingUpdates = new Map<string, PendingUpdate>();
let flushInFlight: Promise<void> | null = null;
let flushTimer: number | null = null;
let lastFlushFailed = false;
let lastFlushFailure: unknown = null;

function scheduleFlush(delayMs: number): void {
  if (flushTimer !== null) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    void flushPendingUpdates();
  }, delayMs);
}

/**
 * Flush every pending update through the shared queue.
 *
 * `propagateFailure` splits the semantics: background flushes (debounce,
 * navigation) re-queue failures (except deletes) and settle; the EXPLICIT
 * close flush passes `true`, does NOT re-queue, records the failure, and
 * THROWS — the close protocol must refuse to ack a flush that did not land.
 * A propagate caller joining an in-flight background flush checks the
 * module failure record after the join, so a failed in-flight delete
 * cannot be acknowledged as success.
 */
async function flushPendingUpdates(opts?: {
  propagateFailure?: boolean;
}): Promise<void> {
  if (flushInFlight) {
    // Join the in-flight flush; its outcome is in the module failure refs.
    await flushInFlight.catch(() => undefined);
  }
  if (pendingUpdates.size === 0) {
    if (opts?.propagateFailure && lastFlushFailed) {
      throw lastFlushFailure ?? new Error("highlight flush failed");
    }
    return;
  }
  const propagate = opts?.propagateFailure === true;
  // A fresh attempt resets the failure record (the record is cross-call
  // module state; without the reset a previous call's failure leaks into
  // later flushes — the cross-test leakage the unit suite caught).
  lastFlushFailed = false;
  lastFlushFailure = null;
  const run = (async () => {
    const updates = new Map(pendingUpdates);
    pendingUpdates.clear();
    let failed = false;
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
        failed = true;
        firstError ??= error;
        pending.onError?.(
          error instanceof Error ? error : new Error(String(error)),
        );

        if (!propagate && pending.type !== "delete") {
          // Background path: re-queue failed updates for retry.
          pendingUpdates.set(id, pending);
        }
        // The close path (propagate) never re-queues — the window is going
        // away and the failure must surface, not retry.
      }
    }

    lastFlushFailed = failed;
    lastFlushFailure = firstError;

    if (pendingUpdates.size > 0 && !propagate) {
      scheduleFlush(500);
    }

    // A failed write must surface on the close path; leftover pending
    // items are the quiescence loop's business (the caller drains them in
    // the next pass), not a failure.
    if (propagate && failed) {
      throw firstError ?? new Error("highlight flush did not land");
    }
  })();
  flushInFlight = run.finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

/**
 * Hook for persisting highlights to the backend with debouncing.
 *
 * All instances share the module-level queue above: create/update/delete
 * enqueue into the same map, and any instance's flush — most importantly
 * the close protocol's flush through ReaderView — drains EVERYTHING.
 */
export function useHighlightPersistence({
  documentId,
  debounceMs = 500,
  onError,
}: UseHighlightPersistenceOptions) {
  // Create a new highlight
  const createHighlight = useCallback(
    (highlight: Highlight) => {
      if (!documentId) return;

      pendingUpdates.set(highlight.id, {
        highlight,
        type: "create",
        timestamp: Date.now(),
        onError,
      });
      // A highlight CREATE is a discrete user action — the batching that
      // justified the debounce does not exist for it (unlike drag-select
      // spam of update events). The debounce left the create racing the
      // window teardown on a fast close: the harness close bypasses
      // CloseRequested, so the webview dies ~300ms later and a 500ms
      // debounced create could be dropped even though the user was told it
      // saved. Flush immediately — the same un-debounced write principle
      // that fixed the DL-2 page position. The debounced schedule remains
      // for the requeued-retry path (background failures).
      void flushPendingUpdates();
    },
    [documentId, onError],
  );

  // Update an existing highlight
  const updateHighlight = useCallback(
    (highlight: Highlight) => {
      if (!documentId) return;

      const existing = pendingUpdates.get(highlight.id);

      // If there's a pending create, just update the highlight data
      if (existing?.type === "create") {
        pendingUpdates.set(highlight.id, {
          highlight,
          type: "create",
          timestamp: Date.now(),
          onError,
        });
      } else {
        pendingUpdates.set(highlight.id, {
          highlight,
          type: "update",
          timestamp: Date.now(),
          onError,
        });
      }
      scheduleFlush(debounceMs);
    },
    [documentId, debounceMs, onError],
  );

  // Delete a highlight
  const deleteHighlight = useCallback(
    (highlight: Highlight) => {
      if (!documentId) return;

      const existing = pendingUpdates.get(highlight.id);

      // If there's a pending create, just remove it (never persisted)
      if (existing?.type === "create") {
        pendingUpdates.delete(highlight.id);
      } else {
        pendingUpdates.set(highlight.id, {
          highlight,
          type: "delete",
          timestamp: Date.now(),
          onError,
        });
      }
      scheduleFlush(debounceMs);
    },
    [documentId, debounceMs, onError],
  );

  // Flush immediately (before navigation and on the close protocol).
  // Drains until quiescent: every pass either clears the queue or throws —
  // an update enqueued while a pass awaits IPC is caught by the next pass,
  // so a success resolution means the queue really is empty.
  const flushImmediately = useCallback(
    async (opts?: { propagateFailure?: boolean }) => {
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
        flushTimer = null;
      }
      while (pendingUpdates.size > 0) {
        await flushPendingUpdates(opts);
      }
      if (opts?.propagateFailure && lastFlushFailed) {
        throw lastFlushFailure ?? new Error("highlight flush failed");
      }
    },
    [],
  );

  // Flush when the document changes (background semantics).
  useEffect(() => {
    return () => {
      void flushImmediately();
    };
  }, [documentId, flushImmediately]);

  return {
    createHighlight,
    updateHighlight,
    deleteHighlight,
    flushImmediately,
    hasPendingUpdates: () => pendingUpdates.size > 0,
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
 * Load highlights for a specific page from the backend
 */
export async function loadHighlightsForPage(
  documentId: string,
  pageNumber: number,
): Promise<Highlight[]> {
  try {
    const response = await highlightsListForPage(documentId, pageNumber);
    return response.highlights;
  } catch (error) {
    console.error("Failed to load highlights:", error);
    return [];
  }
}
