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
import { highlightsCreate, highlightsDelete } from "../lib/tauri-invoke";
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
});
