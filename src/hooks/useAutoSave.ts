import { useEffect, useRef, useCallback } from "react";
import { libraryUpdateProgress } from "../lib/tauri-invoke";

interface UseAutoSaveOptions {
  documentId: string | null;
  currentPage: number;
  scrollPosition?: number;
  lastTtsChunkId?: string | null;
  enabled?: boolean;
  intervalMs?: number;
}

/** A point-in-time copy of what one document's progress was. */
interface Snapshot {
  documentId: string;
  currentPage: number;
  scrollPosition: number;
  lastTtsChunkId: string | null;
  /** When the backend acknowledged this snapshot (0 = never sent). */
  timestamp: number;
}

/**
 * The APP-WIDE progress-write chain. Every write to the documents row —
 * the autosave drain AND PageNavigation's direct navigation write — must
 * serialize through this single FIFO queue. Without it, a delayed direct
 * write could land AFTER the close flush and revert the row (the western
 * review's interleaving finding: PageNavigation wrote the row outside the
 * hook's chain).
 */
const progressWriteChainRef: { current: Promise<void> } = {
  current: Promise.resolve(),
};

/** Enqueue a progress write; returns the task's real outcome. */
export function enqueueProgressWrite(task: () => Promise<void>): Promise<void> {
  const run = progressWriteChainRef.current.then(() => task());
  progressWriteChainRef.current = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Hook for auto-saving reading progress.
 *
 * Correctness contract (the D1 rework, after three races were found in the
 * first ref-based patch):
 *
 *  1. A write sends a SNAPSHOT taken before the await, and the
 *     "last saved" bookkeeping is marked from that snapshot — never from the
 *     live refs after the await. A page change during the in-flight write
 *     keeps the new page dirty and triggers a follow-up write (the drain).
 *  2. Every write is serialized through one FIFO chain — at most one IPC
 *     write in flight, no interleaving, no lost wakeups. `flushProgress`
 *     (the close protocol) awaits the chain: an in-flight write finishes
 *     first, then the latest dirty snapshot is drained. It never returns
 *     early because a write was in flight.
 *  3. Document switches flush the LEAVING document's own last-known values
 *     (a per-document map), so a switch can never write the new document's
 *     page under the old id — and the leave-flush effect is keyed on
 *     documentId only, so value-only re-renders never churn writes at all
 *     (the original D1 bug: the cleanup ran on every render with the
 *     previous render's closure and wrote the OLD page back over the new
 *     one, reverting the direct navigation write on a fast close).
 */
export function useAutoSave({
  documentId,
  currentPage,
  scrollPosition = 0,
  lastTtsChunkId,
  enabled = true,
  intervalMs = 30000, // 30 seconds default
}: UseAutoSaveOptions) {
  const liveRef = useRef<Snapshot>({
    documentId: documentId ?? "",
    currentPage,
    scrollPosition,
    lastTtsChunkId: lastTtsChunkId ?? null,
    timestamp: 0,
  });
  // Live values, updated every render — the "what is dirty right now" truth.
  liveRef.current = {
    documentId: documentId ?? "",
    currentPage,
    scrollPosition,
    lastTtsChunkId: lastTtsChunkId ?? null,
    timestamp: 0,
  };

  // Latest values per document — the leave-flush source (case 3).
  const latestByDocRef = useRef(new Map<string, Snapshot>());
  if (liveRef.current.documentId) {
    latestByDocRef.current.set(liveRef.current.documentId, {
      ...liveRef.current,
    });
  }

  // What the backend last acknowledged. Initialized to the mount snapshot so
  // a mount never writes a clean state. Always a SNAPSHOT that was sent.
  const lastSavedRef = useRef<Snapshot>({ ...liveRef.current });

  const saveTimeoutRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // The serialized write chain: every write (debounce, interval, flush,
  // document-leave) runs FIFO through this promise.
  // Delegated to the app-wide chain: the autosave's writes and the direct
  // navigation write serialize together, so neither can revert the other.
  const enqueue = useCallback((task: () => Promise<void>): Promise<void> => {
    return enqueueProgressWrite(task);
  }, []);

  const isDirty = useCallback((): boolean => {
    const live = liveRef.current;
    if (!live.documentId || !enabledRef.current) return false;
    const last = lastSavedRef.current;
    return (
      last.documentId !== live.documentId ||
      last.currentPage !== live.currentPage ||
      Math.abs(last.scrollPosition - live.scrollPosition) > 0.05 ||
      last.lastTtsChunkId !== live.lastTtsChunkId
    );
  }, []);

  /**
   * Send ONE explicit snapshot; mark saved from THAT snapshot (case 1).
   * `force` writes the exact snapshot even when the 0.05 scroll epsilon
   * would call it clean — the close flush must sync EXACT values.
   */
  const sendSnapshot = useCallback(
    async (snapshot: Snapshot, force = false): Promise<void> => {
      if (!snapshot.documentId || !enabledRef.current) return;
      const last = lastSavedRef.current;
      if (
        !force &&
        last.documentId === snapshot.documentId &&
        last.currentPage === snapshot.currentPage &&
        Math.abs(last.scrollPosition - snapshot.scrollPosition) <= 0.05 &&
        last.lastTtsChunkId === snapshot.lastTtsChunkId
      ) {
        return; // already acknowledged
      }
      // No catch here: the caller must know whether the write landed, so a
      // failure can STOP the drain instead of hot-retrying forever.
      await libraryUpdateProgress(
        snapshot.documentId,
        snapshot.currentPage,
        snapshot.scrollPosition,
        snapshot.lastTtsChunkId ?? undefined,
      );
      // Marked from the snapshot — a change that landed during the await
      // keeps the live values dirty for the next drain pass.
      lastSavedRef.current = { ...snapshot, timestamp: Date.now() };
    },
    [],
  );

  /**
   * Enqueue a full drain of the current document.
   *
   * `propagateFailure` splits the semantics: background saves (debounce,
   * interval, saveNow) log and settle — a transient backend failure must
   * not unhandled-reject a timer — while the EXPLICIT close flush passes
   * `true` and REJECTS, so the close protocol can refuse to ack a flush
   * that did not land. `force` (the close flush) writes the exact live
   * snapshot once even when the 0.05 scroll epsilon would call it clean —
   * the close must sync EXACT values, not an epsilon-fuzzed approximation.
   */
  const drainNow = useCallback(
    (opts?: { propagateFailure?: boolean; force?: boolean }): Promise<void> => {
      const propagate = opts?.propagateFailure === true;
      let force = opts?.force === true;
      return enqueue(async () => {
        // One attempt per observed revision. A failed write leaves the
        // state dirty — without the revision guard this loop would
        // hot-retry the same snapshot forever. A NEW revision (the live
        // values moved) is a legitimate next attempt; the same revision is
        // not.
        let lastAttempted: Snapshot | null = null;
        while (force || isDirty()) {
          const current = { ...liveRef.current };
          if (
            lastAttempted &&
            lastAttempted.documentId === current.documentId &&
            lastAttempted.currentPage === current.currentPage &&
            lastAttempted.scrollPosition === current.scrollPosition &&
            lastAttempted.lastTtsChunkId === current.lastTtsChunkId
          ) {
            break; // already attempted this revision — stop, next save retries
          }
          lastAttempted = current;
          try {
            await sendSnapshot(current, force);
          } catch (error) {
            console.error("Failed to save progress:", error);
            if (propagate) throw error;
            return; // background: settle; the next explicit save retries
          }
          force = false;
        }
      });
    },
    [enqueue, isDirty, sendSnapshot],
  );

  /**
   * The close-protocol flush: await the whole chain — any in-flight write
   * completes first, then the latest dirty snapshot is drained. Never
   * returns early because a write was in flight (case 2).
   */
  const flushProgress = useCallback(async (): Promise<void> => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    // The close protocol must know whether the write landed: reject on
    // failure — the caller refuses to ack, the backend's 3s timeout
    // destroys the window either way.
    await drainNow({ propagateFailure: true, force: true });
  }, [drainNow]);

  // Debounced save for frequent updates
  const scheduleSave = useCallback(
    (delayMs = 1000) => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        void drainNow();
      }, delayMs);
    },
    [drainNow],
  );

  // Save on page change (short debounce — the page is what a close must
  // never lose; the drain + flush close the race the 500ms window created).
  useEffect(() => {
    if (!enabled || !documentId) return;
    scheduleSave(500);
  }, [currentPage, documentId, enabled, scheduleSave]);

  // Save on TTS chunk change
  useEffect(() => {
    if (!enabled || !documentId || !lastTtsChunkId) return;
    scheduleSave(2000);
  }, [lastTtsChunkId, documentId, enabled, scheduleSave]);

  // Periodic save interval
  useEffect(() => {
    if (!enabled || !documentId) return;
    const interval = setInterval(() => {
      void drainNow();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, documentId, intervalMs, drainNow]);

  // Save the LEAVING document when the id changes (or the hook unmounts).
  // Keyed on documentId only — value-only re-renders never churn this, and
  // the snapshot comes from the per-document map, so the old id can never
  // receive the new document's values (case 3).
  useEffect(() => {
    // Copy the ref inside the effect so the cleanup reads a stable map
    // (the react-hooks rule; the map object itself is stable across
    // renders — only its entries grow).
    const latestByDoc = latestByDocRef.current;
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (!documentId) return;
      const leaving = latestByDoc.get(documentId);
      if (leaving) {
        // Prune the entry: the snapshot is captured, the map must not grow
        // with every document the session visited.
        latestByDoc.delete(documentId);
        void enqueue(async () => {
          await sendSnapshot(leaving);
        });
      }
    };
  }, [documentId, enqueue, sendSnapshot]);

  // Save before window unload (localStorage fallback — unchanged; the real
  // close path is the flush protocol above).
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      const live = liveRef.current;
      if (live.documentId) {
        try {
          localStorage.setItem(
            `pdf-reader-unsaved-${live.documentId}`,
            JSON.stringify({
              page: live.currentPage,
              scroll: live.scrollPosition,
              ttsChunk: live.lastTtsChunkId,
              timestamp: Date.now(),
            }),
          );
        } catch {
          // Ignore localStorage errors
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);

  return {
    saveNow: drainNow,
    lastSaved: lastSavedRef.current.timestamp,
    flushProgress,
  };
}

/**
 * Check for unsaved progress from a previous session
 */
export function checkUnsavedProgress(documentId: string): {
  page: number;
  scroll: number;
  ttsChunk: string | null;
  timestamp: number;
} | null {
  try {
    const key = `pdf-reader-unsaved-${documentId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      // One-shot recovery: the fallback is consumed on read, so a stale
      // entry can never replay into every later launch.
      localStorage.removeItem(key);
      const parsed = JSON.parse(saved) as {
        page: number;
        scroll: number;
        ttsChunk: string | null;
        timestamp: number;
      };
      return {
        page: parsed.page,
        scroll: parsed.scroll,
        ttsChunk: parsed.ttsChunk,
        timestamp: parsed.timestamp,
      };
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}
