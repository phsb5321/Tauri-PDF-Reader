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
let flushInFlight: Promise<{ failed: boolean; error?: unknown }> | null = null;
let flushTimer: number | null = null;
/** The flush attempt whose pass failed, bound to ITS OWN promise. A close
 * flush may only surface a failure it actually JOINED, and only that joiner
 * may consume it — identity, never a shared boolean an interleaved retry
 * pass could clear first (exact-head Codex review, MAJOR). The record may
 * be retained across mounts until a matching joiner consumes it or another
 * failure overwrites it: it is INERT for any non-matching caller (the join
 * check requires lastFlushFailed.flush === joinedFlush, and a completed
 * flush is never joined again), so the retention is one bounded object, not
 * a poison (exact-head Codex review, MINOR — accepted, documented). */
let lastFlushFailed: {
  flush: Promise<{ failed: boolean; error?: unknown }>;
  error: unknown;
} | null = null;

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
 * A propagate caller that JOINED an in-flight flush surfaces the joined
 * flush's failure by identity (flushImmediately), so a failed in-flight
 * delete cannot be acknowledged as success.
 *
 * NOT an async function: the resolved value must be the pass's OWN outcome
 * object. An async function would wrap the return value in its own promise,
 * and `await` would unwrap it (a returned promise resolves to its value) —
 * the caller's quiescence break compares the OUTCOME, never a promise
 * identity, so the pass's flush wrapper and its outcome are kept distinct:
 * the wrapper carries the identity (for the joiner's match), the outcome
 * carries the result (for the caller's loop).
 */
function flushPendingUpdates(opts?: {
  propagateFailure?: boolean;
}): Promise<{ failed: boolean; error?: unknown }> {
  if (flushInFlight) {
    // Join the in-flight flush, then run our own pass. The resolved value
    // is OUR pass's outcome; the joined flush's outcome, if any, is handled
    // by the joiner's identity check in flushImmediately.
    const joined = flushInFlight;
    return joined.catch(() => undefined).then(() => flushPendingUpdates(opts));
  }
  if (pendingUpdates.size === 0) {
    // Nothing to land. The failure record is NOT consulted here — a stale
    // failure from a PREVIOUS flush (e.g. a dropped delete) must not make an
    // unrelated later close flush reject; the join-failure semantics live in
    // flushImmediately, which knows whether THIS call actually joined a
    // failing in-flight flush.
    return Promise.resolve({ failed: false });
  }
  const propagate = opts?.propagateFailure === true;
  // Declared before the run so its closure can bind the wrapper's identity.
  // The closure only READS it after the first await, by which time it has
  // been reassigned to the real wrapper below — the placeholder never
  // escapes this function (initialized here so TS's closure analysis and
  // eslint's prefer-const both hold).
  let flush: Promise<{ failed: boolean; error?: unknown }> = Promise.resolve({
    failed: false,
  });
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
          // Background path: re-queue failed updates for retry — but never
          // over a NEWER entry for the same id. The queue is cleared at pass
          // start, so an entry enqueued WHILE this write was in flight is the
          // user's latest intent (e.g. a delete superseding a failing
          // create); the stale retry must not clobber it (codex review,
          // MAJOR). The CAS token is the entry OBJECT, not its timestamp: a
          // same-millisecond enqueue is a different object, so the stale
          // retry can never be confused with the newer intent (exact-head
          // codex review, MINOR).
          const current = pendingUpdates.get(id);
          if (current === undefined || current === pending) {
            pendingUpdates.set(id, pending);
          }
        }
        // The close path (propagate) never re-queues — the window is going
        // away and the failure must surface, not retry.
      }
    }

    if (failed) {
      // Bind the failure to THIS pass's promise — the joiner that awaits
      // flushInFlight is the only caller allowed to surface it, and it can
      // only match by identity: a later retry pass binding its own record
      // can never clear the joined flush's failure before the joiner reads
      // it (exact-head codex review, MAJOR).
      lastFlushFailed = { flush, error: firstError };
    }

    if (pendingUpdates.size > 0 && !propagate) {
      scheduleFlush(500);
    }

    // A failed write must surface on the close path; leftover pending
    // items are the quiescence loop's business (the caller drains them in
    // the next pass), not a failure.
    if (propagate && failed) {
      throw firstError ?? new Error("highlight flush did not land");
    }

    // The pass outcome: the flush wrapper (identity) and the outcome
    // (result) travel as distinct values.
    return { failed, error: firstError };
  })();
  // The flush wrapper carries the identity for the joiner's match; the run
  // resolves to the OUTCOME object, so `flush` does too (.finally preserves
  // the resolution value).
  flush = run.finally(() => {
    flushInFlight = null;
  });
  flushInFlight = flush;
  return flush;
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
    (highlight: Highlight): Promise<{ failed: boolean; error?: unknown }> | undefined => {
      if (!documentId) return undefined;

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
      //
      // The flush is RETURNED so the caller can gate its success UX on the
      // write attempt completing — the "Highlight created" toast must never
      // precede the write (exact-head codex review, MAJOR). Background
      // semantics still hold: the promise settles when the ATTEMPT finishes
      // (failures re-queue for the retry path), it does not throw.
      return flushPendingUpdates();
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
  // so a success resolution means the queue really is empty. The loop never
  // hot-spins on a failing item: a background pass that failed (re-queued)
  // breaks the loop and the re-queued entry retries through the debounced
  // timer.
  const flushImmediately = useCallback(
    async (opts?: { propagateFailure?: boolean }) => {
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
        flushTimer = null;
      }
      // Join an in-flight flush FIRST — a close flush must not resolve (and
      // let the protocol ack) while a write is still mid-IPC; the empty-
      // queue check below must never run past a live flush.
      const joinedFlush = flushInFlight;
      if (joinedFlush) {
        await joinedFlush.catch(() => undefined);
      }
      if (
        opts?.propagateFailure &&
        joinedFlush !== null &&
        lastFlushFailed?.flush === joinedFlush
      ) {
        // The flush we JOINED failed and left nothing pending for us to
        // drain (e.g. a dropped delete): surface its outcome exactly once,
        // bound to the promise we joined. Identity — not a shared boolean —
        // so an interleaved retry pass binding its own record can never
        // consume the joined failure first, and a stale failure from an
        // unjoined flush can never match (exact-head codex review, MAJOR).
        const failure =
          lastFlushFailed.error ?? new Error("highlight flush failed");
        lastFlushFailed = null;
        throw failure;
      }
      // No unconditional record reset: each pass binds its own outcome, and
      // only a joiner that matches by identity consumes it.
      while (pendingUpdates.size > 0) {
        const before = pendingUpdates.size;
        // The pass OUTCOME drives the quiescence break: a background pass
        // that failed re-queued (size >= before) must stop the loop — the
        // re-queued entry retries through the debounced timer. A propagate
        // pass that failed THREW already (the close flush must reject).
        const outcome = await flushPendingUpdates(opts);
        if (pendingUpdates.size >= before && outcome.failed) break;
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
