import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPdfPageReadyEpoch,
  markPdfPageReady,
  resetPdfPageReadyForTests,
  waitForPdfPageReady,
} from "./pdf-page-ready";

afterEach(() => {
  vi.useRealTimers();
  resetPdfPageReadyForTests();
});

describe("PDF page render readiness", () => {
  it("waits for a newer exact-page render and ignores other pages", async () => {
    markPdfPageReady(2);
    const previous = getPdfPageReadyEpoch(2);
    const pending = waitForPdfPageReady(2, previous, { timeoutMs: 1_000 });

    markPdfPageReady(3);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    const ready = markPdfPageReady(2);
    await expect(pending).resolves.toEqual({ status: "ready", epoch: ready });
  });

  it("settles aborted waits without accepting a later render", async () => {
    const controller = new AbortController();
    const pending = waitForPdfPageReady(9, 0, {
      signal: controller.signal,
      timeoutMs: 1_000,
    });
    controller.abort();
    markPdfPageReady(9);

    await expect(pending).resolves.toEqual({ status: "aborted" });
  });

  it("fails closed on a bounded timeout", async () => {
    vi.useFakeTimers();
    const pending = waitForPdfPageReady(4, 0, { timeoutMs: 5_000 });
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toEqual({ status: "timeout" });
  });
});
