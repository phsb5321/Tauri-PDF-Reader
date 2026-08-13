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

function deferred(): { promise: Promise<unknown>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise((r) => (resolve = () => r(undefined)));
  return { promise, resolve };
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

  it("a propagate flush after a failed in-flight delete rejects", async () => {
    highlightsDelete.mockRejectedValueOnce(new Error("backend down"));

    const a = renderHook(() =>
      useHighlightPersistence({ documentId: "doc-1" }),
    );
    act(() => {
      a.result.current.deleteHighlight(fakeHighlight("h-1"));
    });

    // The background flush runs, the delete fails and is dropped (background
    // semantics: settle, record the failure).
    await act(async () => {
      await a.result.current.flushImmediately();
    });

    // The close flush must REJECT — the failed delete cannot be
    // acknowledged as success.
    let rejected = false;
    await act(async () => {
      try {
        await a.result.current.flushImmediately({ propagateFailure: true });
      } catch {
        rejected = true;
      }
    });
    expect(rejected).toBe(true);
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
