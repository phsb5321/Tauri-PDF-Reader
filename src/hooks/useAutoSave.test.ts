import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("../lib/tauri-invoke", () => ({
  libraryUpdateProgress: vi.fn().mockResolvedValue({}),
}));

import { useAutoSave } from "./useAutoSave";
import { libraryUpdateProgress } from "../lib/tauri-invoke";

/** A promise the test resolves by hand — the pending-IPC control. */
function deferred(): { promise: Promise<unknown>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise((r) => (resolve = () => r({})));
  return { promise, resolve };
}

const pagesOf = () =>
  vi
    .mocked(libraryUpdateProgress)
    .mock.calls.map((call) => [call[0], call[1]] as [string, number]);

describe("useAutoSave — the D1 close/race contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("D1 regression: a page change never writes the previous page back", async () => {
    const { rerender } = renderHook(
      ({ page }: { page: number }) =>
        useAutoSave({ documentId: "doc-1", currentPage: page }),
      { initialProps: { page: 1 } },
    );

    rerender({ page: 2 });
    rerender({ page: 3 });

    // The old implementation's [documentId, saveProgress] cleanup ran on
    // every render and wrote the previous page (2) back over the fresh one.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(pagesOf()).not.toContainEqual(["doc-1", 2]);
  });

  it("drains a page change that lands during the in-flight write", async () => {
    const first = deferred();
    let firstInvoked = false;
    libraryUpdateProgress.mockImplementationOnce(() => {
      firstInvoked = true;
      return first.promise;
    });

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useAutoSave({ documentId: "doc-1", currentPage: page }),
      { initialProps: { page: 1 } },
    );

    rerender({ page: 2 });
    const drain = result.current.flushProgress();
    // PROVE the write is in flight before the rerender: the mock's
    // invocation flag (the IPC is now pending on the deferred) — not a
    // time heuristic.
    await waitFor(() => expect(firstInvoked).toBe(true));
    rerender({ page: 3 });

    first.resolve(); // page-2 write completes
    await act(async () => {
      await drain;
    });

    // The drain must follow the in-flight write with the NEW page — the
    // snapshot marking never suppresses the page-3 write.
    expect(pagesOf()).toEqual([
      ["doc-1", 2],
      ["doc-1", 3],
    ]);
  });

  it("close flush awaits the in-flight write and drains the latest dirty snapshot", async () => {
    const first = deferred();
    libraryUpdateProgress.mockImplementationOnce(() => first.promise);

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useAutoSave({ documentId: "doc-1", currentPage: page }),
      { initialProps: { page: 1 } },
    );

    rerender({ page: 2 });
    let flushSettled = false;
    const flush = result.current.flushProgress().then(() => {
      flushSettled = true;
    });
    rerender({ page: 3 });

    // The flush must NOT have settled while the write is in flight — the old
    // isSavingRef early-return made the flush resolve immediately and lose
    // the pending state.
    expect(flushSettled).toBe(false);

    first.resolve();
    await act(async () => {
      await flush;
    });

    expect(flushSettled).toBe(true);
    expect(pagesOf()[pagesOf().length - 1]).toEqual(["doc-1", 3]);
  });

  it("a rejected IPC makes the explicit flush REJECT with bounded calls, and the next save recovers", async () => {
    libraryUpdateProgress.mockRejectedValueOnce(new Error("backend down"));

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useAutoSave({ documentId: "doc-1", currentPage: page }),
      { initialProps: { page: 1 } },
    );

    rerender({ page: 2 });
    let rejected = false;
    await act(async () => {
      try {
        await result.current.flushProgress();
      } catch {
        rejected = true;
      }
    });

    // The explicit flush REJECTS (the close protocol must not ack a write
    // that did not land) — with exactly ONE attempt (no hot retry loop).
    expect(rejected).toBe(true);
    expect(pagesOf().length).toBe(1);

    // The chain recovers on the next explicit save with a new revision.
    rerender({ page: 3 });
    await act(async () => {
      await result.current.flushProgress();
    });
    expect(pagesOf()[pagesOf().length - 1]).toEqual(["doc-1", 3]);
  });

  it("a background save settles quietly on a rejected IPC", async () => {
    libraryUpdateProgress.mockRejectedValueOnce(new Error("backend down"));

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useAutoSave({ documentId: "doc-1", currentPage: page }),
      { initialProps: { page: 1 } },
    );

    rerender({ page: 2 });
    await act(async () => {
      await result.current.saveNow(); // background semantics: settle, no throw
    });
    expect(pagesOf().length).toBe(1);
  });

  it("a document switch flushes the leaving document under its OWN id", async () => {
    const { result, rerender } = renderHook(
      ({ doc, page }: { doc: string; page: number }) =>
        useAutoSave({ documentId: doc, currentPage: page }),
      { initialProps: { doc: "doc-A", page: 2 } },
    );

    rerender({ doc: "doc-A", page: 3 }); // doc-A dirty at page 3
    rerender({ doc: "doc-B", page: 5 }); // the switch

    await act(async () => {
      await result.current.flushProgress();
    });

    const calls = pagesOf();
    expect(calls).toContainEqual(["doc-A", 3]);
    expect(calls).toContainEqual(["doc-B", 5]);
    // Isolation: never the new document's values under the old id, nor the
    // old values under the new id.
    expect(calls).not.toContainEqual(["doc-A", 5]);
    expect(calls).not.toContainEqual(["doc-B", 3]);
  });
});
