import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("../lib/tauri-invoke", () => ({
  highlightsCreate: vi.fn().mockResolvedValue(undefined),
  highlightsUpdate: vi.fn().mockResolvedValue(undefined),
  highlightsDelete: vi.fn().mockResolvedValue(undefined),
  highlightsListForDocument: vi.fn().mockResolvedValue({ highlights: [] }),
  highlightsListForPage: vi.fn().mockResolvedValue({ highlights: [] }),
}));

import { useHighlightPersistence } from "./useHighlightPersistence";
import { highlightsCreate, highlightsDelete, highlightsUpdate } from "../lib/tauri-invoke";
import type { Highlight } from "../lib/schemas";

function fakeHighlight(id: string): Highlight {
  return {
    id,
    documentId: "doc-1",
    pageNumber: 2,
    rects: [{ x: 1, y: 2, width: 3, height: 4 }],
    color: "#ffff00",
    textContent: "fixture words",
    note: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: null,
  } as Highlight;
}

function deferred(): {
  promise: Promise<unknown>;
  resolve: () => void;
  reject: (e: Error) => void;
} {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<unknown>((r, j) => {
    resolve = () => r(undefined);
    reject = j;
  });
  return { promise, resolve, reject };
}

describe("useHighlightPersistence — the shared-queue close contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("one instance's close flush drains a create queued by the OTHER instance", async () => {
    // Instance A is the creation handler (HighlightCreationHandler); the
    // close flush runs in instance B (ReaderView). Pre-shared-queue, B's
    // empty pending map made the close ack a just-created highlight that
    // was never flushed.
    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    act(() => {
      a.result.current.createHighlight(fakeHighlight("h-1"));
    });

    const b = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    await act(async () => {
      await b.result.current.flushImmediately({ propagateFailure: true });
    });

    expect(highlightsCreate).toHaveBeenCalledTimes(1);
  });

  it("the shared queue drains fully — no cross-test or cross-document leakage", async () => {
    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-A" }),
    );
    act(() => {
      a.result.current.createHighlight(fakeHighlight("h-1"));
    });
    await act(async () => {
      await a.result.current.flushImmediately({ propagateFailure: true });
    });
    expect(a.result.current.hasPendingUpdates()).toBe(false);

    // A SECOND instance (a different document, e.g. the next test's render)
    // must see an empty queue — the coordinator does not carry stale items
    // across mounts.
    const b = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-B" }),
    );
    expect(b.result.current.hasPendingUpdates()).toBe(false);
    expect(highlightsCreate).toHaveBeenCalledTimes(1);
  });

  it("a close flush joining an in-flight flush that fails rejects", async () => {
    // The delete stays IN FLIGHT (deferred) when the close flush runs — the
    // close flush joins it and must REJECT: a failed in-flight write cannot
    // be acknowledged as success.
    const d = deferred();
    highlightsDelete.mockImplementationOnce(() => d.promise);

    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    act(() => {
      a.result.current.deleteHighlight(fakeHighlight("h-1"));
    });

    const bg = a.result.current.flushImmediately(); // stays in flight
    await waitFor(() => expect(highlightsDelete).toHaveBeenCalledTimes(1));

    let rejected = false;
    const closeFlush = a.result.current
      .flushImmediately({ propagateFailure: true })
      .then(
        () => undefined,
        () => {
          rejected = true;
        },
      );
    // The close flush must NOT have settled while the delete is in flight.
    await Promise.resolve();
    expect(rejected).toBe(false);

    d.reject(new Error("backend down"));
    await act(async () => {
      await bg;
      await closeFlush;
    });
    expect(rejected).toBe(true);
  });

  it("a completed failed background flush does NOT poison the next close flush", async () => {
    // The failed DELETE's flush completed BEFORE the close flush runs —
    // nothing is pending for the close flush to land, so it must RESOLVE.
    // The failure was already surfaced to the background caller; it must not
    // be resurrected to reject an unrelated later flush (the stale-flag
    // contamination the unit suite caught across instances).
    highlightsDelete.mockRejectedValueOnce(new Error("backend down"));

    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    act(() => {
      a.result.current.deleteHighlight(fakeHighlight("h-1"));
    });
    await act(async () => {
      await a.result.current.flushImmediately();
    });

    let rejected = false;
    await act(async () => {
      try {
        await a.result.current.flushImmediately({ propagateFailure: true });
      } catch {
        rejected = true;
      }
    });
    expect(rejected).toBe(false);
  });

  it("a permanently failing backend settles the background flush — no hot retry loop", async () => {
    // The unmount cleanup path (`void flushImmediately()`): a permanently
    // failing create is re-queued by the background path, so the quiescence
    // loop must break after one attempt and let the debounced timer retry —
    // never a busy loop that hangs teardown.
    highlightsCreate.mockRejectedValue(new Error("backend down"));

    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    act(() => {
      a.result.current.createHighlight(fakeHighlight("h-1"));
    });

    // createHighlight already flushed once (the un-debounced create); the
    // explicit flush makes exactly ONE more attempt, then settles.
    await act(async () => {
      await a.result.current.flushImmediately();
    });
    expect(highlightsCreate).toHaveBeenCalledTimes(2);
    // The failed create is re-queued (waiting for the debounced retry), not
    // dropped and not spinning.
    expect(a.result.current.hasPendingUpdates()).toBe(true);
    // Restore the module mock's default implementation — the persistent
    // rejection must not leak into the next test (clearAllMocks resets call
    // records, not implementations).
    highlightsCreate.mockResolvedValue(undefined);
  });

  it("the close flush drains an update enqueued while a pass awaits IPC", async () => {
    const first = deferred();
    let firstInvoked = false;
    highlightsCreate.mockImplementationOnce(() => {
      firstInvoked = true;
      return first.promise;
    });

    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    act(() => {
      a.result.current.createHighlight(fakeHighlight("h-1"));
    });
    const flush = a.result.current.flushImmediately({
      propagateFailure: true,
    });
    await waitFor(() => expect(firstInvoked).toBe(true));
    // Enqueued while the first create is in flight — the quiescence loop
    // must drain it before the flush resolves.
    act(() => {
      a.result.current.createHighlight(fakeHighlight("h-2"));
    });
    first.resolve();
    await act(async () => {
      await flush;
    });

    expect(highlightsCreate).toHaveBeenCalledTimes(2);
  });

  it("an interleaved BACKGROUND flush cannot consume the failure a close flush joined", async () => {
    // Three callers converge on ONE failing in-flight flush: a background
    // flushImmediately (non-propagating) joins it, THEN the close flush
    // joins the same flush. The background join must not clear the failure
    // record before the close flush reads it — a close flush that joined a
    // failing flush must still reject, whatever interleaved joins happened.
    // (Codex adversarial review, MAJOR: the pre-fix unconditional record
    // reset let the earlier-attached background join consume the failure.)
    const d = deferred();
    highlightsDelete.mockImplementationOnce(() => d.promise);

    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    act(() => {
      a.result.current.deleteHighlight(fakeHighlight("h-1"));
    });
    const bg = a.result.current.flushImmediately(); // starts the failing flush
    await waitFor(() => expect(highlightsDelete).toHaveBeenCalledTimes(1));

    // A non-propagating join (e.g. a navigation flush) attaches FIRST.
    const backgroundJoin = a.result.current.flushImmediately();
    let rejected = false;
    const closeFlush = a.result.current
      .flushImmediately({ propagateFailure: true })
      .then(
        () => undefined,
        () => {
          rejected = true;
        },
      );

    // Nothing has settled while the delete is in flight.
    await Promise.resolve();
    expect(rejected).toBe(false);

    d.reject(new Error("backend down"));
    await act(async () => {
      await Promise.allSettled([bg, backgroundJoin, closeFlush]);
    });
    // The close flush joined the SAME failing flush — it must reject even
    // though the background join ran first.
    expect(rejected).toBe(true);
  });

  it("a failed create's requeue does not overwrite a delete enqueued while it was in flight", async () => {
    // The create is IN FLIGHT (deferred); the user deletes the same
    // highlight before it resolves. When the create fails, the background
    // requeue must NOT clobber the newer delete — the delete is the user's
    // latest intent and must land. (Codex adversarial review, MAJOR.)
    const d = deferred();
    highlightsCreate.mockImplementationOnce(() => d.promise);

    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    act(() => {
      a.result.current.createHighlight(fakeHighlight("h-1"));
    });
    const bg = a.result.current.flushImmediately();
    await waitFor(() => expect(highlightsCreate).toHaveBeenCalledTimes(1));

    // While the create is in flight the queue was cleared at pass start, so
    // this lands as a fresh delete entry — the user's newest intent.
    act(() => {
      a.result.current.deleteHighlight(fakeHighlight("h-1"));
    });
    expect(a.result.current.hasPendingUpdates()).toBe(true);

    d.reject(new Error("backend down"));
    await act(async () => {
      await bg.catch(() => undefined);
    });
    // The delete was NOT clobbered by the stale create's requeue — it
    // survived and LANDED (bg's own drain flushed it after the join). The
    // stale create was never retried over it (asserted below).
    expect(highlightsDelete).toHaveBeenCalledTimes(1);

    await act(async () => {
      await a.result.current.flushImmediately({ propagateFailure: true });
    });
    // The delete landed; the stale create was NOT retried over it.
    expect(highlightsDelete).toHaveBeenCalledTimes(1);
    expect(highlightsCreate).toHaveBeenCalledTimes(1);
    expect(a.result.current.hasPendingUpdates()).toBe(false);
  });

  it("one instance's close flush JOINS the other instance's in-flight write, not just its queue", async () => {
    // Instance A's un-debounced create is mid-IPC (deferred). Instance B's
    // close flush must JOIN that flush — it must stay unsettled until A's
    // write lands, so the ack can never precede the write (the call-count
    // test above proves the drain, this proves the join).
    const d = deferred();
    highlightsCreate.mockImplementationOnce(() => d.promise);

    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    const b = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    act(() => {
      a.result.current.createHighlight(fakeHighlight("h-1"));
    });
    await waitFor(() => expect(highlightsCreate).toHaveBeenCalledTimes(1));

    let settled = false;
    const closeFlush = b.result.current
      .flushImmediately({ propagateFailure: true })
      .then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
    // B joined A's in-flight write — it must not settle while A's is up.
    await Promise.resolve();
    expect(settled).toBe(false);

    d.resolve();
    await act(async () => {
      await closeFlush;
    });
    expect(settled).toBe(true);
    expect(highlightsCreate).toHaveBeenCalledTimes(1);
  });

  it("a close flush joining a failed flush with a REQUEUED create rejects — the background retry cannot consume the failure", async () => {
    // The exact-head Codex review's MAJOR: a failed CREATE is re-queued
    // (unlike a delete), so a navigation join's RETRY pass starts while the
    // close flush is still joined to the ORIGINAL failed flush. The retry
    // must not clear the failure before the close flush reads it — the close
    // flush that joined the failing flush must still reject (identity-bound
    // record). Pre-fix (shared boolean + pass-start reset) the close flush
    // resolved while the retry was in flight and the protocol acked a write
    // that had not landed.
    const d = deferred();
    highlightsCreate.mockImplementationOnce(() => d.promise);

    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    act(() => {
      a.result.current.createHighlight(fakeHighlight("h-1"));
    });
    const bg = a.result.current.flushImmediately(); // F1 in flight
    await waitFor(() => expect(highlightsCreate).toHaveBeenCalledTimes(1));

    // A navigation flushImmediately attaches to the SAME failing flush.
    const navJoin = a.result.current.flushImmediately();
    let rejected = false;
    const closeFlush = a.result.current
      .flushImmediately({ propagateFailure: true })
      .then(
        () => undefined,
        () => {
          rejected = true;
        },
      );
    await Promise.resolve();
    expect(rejected).toBe(false); // still in flight, nothing settled

    d.reject(new Error("backend down")); // F1 fails; the create is re-queued
    await act(async () => {
      await Promise.allSettled([bg, navJoin, closeFlush]);
    });
    // The close flush joined the SAME failing flush — it must reject even
    // though the nav join's retry ran first.
    expect(rejected).toBe(true);
  });

  it("a failed create's requeue does not clobber a same-millisecond newer entry (object-identity CAS)", async () => {
    // The exact-head Codex review's MINOR: the CAS token must not be the
    // entry timestamp — a create and an update enqueued in the same
    // millisecond (frozen fake clock) are DIFFERENT entry objects, so the
    // stale create's requeue must not overwrite the newer update. Pre-fix
    // (timestamp CAS) the equal timestamps made the stale create clobber the
    // update and the update intent was lost.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const d = deferred();
      highlightsCreate.mockImplementationOnce(() => d.promise);

      const a = renderHook(() =>
        useHighlightPersistence({ documentId: "doc-1" }),
      );
      act(() => {
        a.result.current.createHighlight(fakeHighlight("h-1"));
      });
      // The immediate flush already invoked the IPC synchronously; the
      // deferred keeps it in flight.
      expect(highlightsCreate).toHaveBeenCalledTimes(1);
      const bg = a.result.current.flushImmediately();

      // Same fake-ms update: a NEW entry object with an identical timestamp.
      act(() => {
        a.result.current.updateHighlight({
          ...fakeHighlight("h-1"),
          color: "#ff0000",
        });
      });

      d.reject(new Error("backend down"));
      await act(async () => {
        await bg.catch(() => undefined);
      });

      // The update survives the failed create — it is still pending (or was
      // drained), never clobbered by the stale create's requeue.
      await act(async () => {
        await a.result.current.flushImmediately({
          propagateFailure: true,
        });
      });
      expect(highlightsUpdate).toHaveBeenCalledTimes(1);
      // The stale create was never retried over the newer intent.
      expect(highlightsCreate).toHaveBeenCalledTimes(1);
      expect(a.result.current.hasPendingUpdates()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("createHighlight's returned flush settles only after the create attempt completes", async () => {
    // The exact-head Codex review's MAJOR (toast-before-write): the handler
    // gates its success UX on the returned flush, so the flush must not
    // settle while the create IPC is still in flight.
    const d = deferred();
    highlightsCreate.mockImplementationOnce(() => d.promise);

    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    let settled = false;
    let persist: Promise<void> | undefined;
    act(() => {
      persist = a.result.current.createHighlight(fakeHighlight("h-1"));
    });
    expect(persist).toBeDefined();
    if (persist) {
      void persist.then(() => {
        settled = true;
      });
    }
    await Promise.resolve();
    expect(settled).toBe(false); // the IPC is still in flight

    d.resolve();
    await act(async () => {
      await persist;
    });
    expect(settled).toBe(true);
    expect(highlightsCreate).toHaveBeenCalledTimes(1);
  });

  it("a pass outcome is per-entry: a sibling's failure does not mark a landed create", async () => {
    // The exact-head Codex review's MAJOR (pass-wide outcome): A's first
    // attempt fails (in flight), B enqueues and its join-pass retries A AND
    // lands B; A's retry fails in that same pass. The pass outcome is
    // { failed: true } (the pass failed) but failedIds must carry ONLY A —
    // B's handler checks its own id and toasts a landed write.
    const dA = deferred();
    highlightsCreate
      .mockImplementationOnce(() => dA.promise) // call 1: A in flight
      .mockResolvedValueOnce(undefined) // call 2: B lands in the join-pass
      .mockRejectedValueOnce(new Error("still down")); // call 3: A's retry fails

    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    let outcomeA: { failed: boolean; failedIds: string[] } | undefined;
    act(() => {
      const p = a.result.current.createHighlight(fakeHighlight("h-A"));
      if (p) void p.then((o) => {
        outcomeA = o;
      });
    });
    expect(highlightsCreate).toHaveBeenCalledTimes(1);

    let outcomeB: { failed: boolean; failedIds: string[] } | undefined;
    act(() => {
      const p = a.result.current.createHighlight(fakeHighlight("h-B"));
      if (p) void p.then((o) => {
        outcomeB = o;
      });
    });

    dA.reject(new Error("backend down"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // A's own outcome marks A failed.
    expect(outcomeA?.failed).toBe(true);
    expect(outcomeA?.failedIds).toContain("h-A");
    // B landed in the pass that retried A: the pass FAILED (A's retry), but
    // B's id is NOT in failedIds — the per-entry gate lets B's handler
    // signal success for the write that actually landed.
    expect(outcomeB?.failed).toBe(true);
    expect(outcomeB?.failedIds).not.toContain("h-B");
  });
});
