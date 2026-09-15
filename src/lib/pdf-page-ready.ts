export type PdfPageReadyResult =
  | { status: "ready"; epoch: number }
  | { status: "aborted" }
  | { status: "timeout" };

interface WaitOptions {
  signal?: AbortSignal;
  timeoutMs: number;
}

type ReadyListener = (pageNumber: number, epoch: number) => void;

let epoch = 0;
const readyEpochs = new Map<number, number>();
const listeners = new Set<ReadyListener>();

/** Mark the exact canvas + text + annotation render as committed. */
export function markPdfPageReady(pageNumber: number): number {
  epoch += 1;
  readyEpochs.set(pageNumber, epoch);
  for (const listener of listeners) listener(pageNumber, epoch);
  return epoch;
}

export function getPdfPageReadyEpoch(pageNumber: number): number {
  return readyEpochs.get(pageNumber) ?? 0;
}

/**
 * Wait for a render newer than the caller's snapshot.
 *
 * A page can have been ready earlier in the session. Requiring a newer epoch
 * prevents auto-page from accepting stale DOM while React is replacing page N
 * with page N+1.
 */
export function waitForPdfPageReady(
  pageNumber: number,
  afterEpoch: number,
  options: WaitOptions,
): Promise<PdfPageReadyResult> {
  const current = getPdfPageReadyEpoch(pageNumber);
  if (current > afterEpoch) {
    return Promise.resolve({ status: "ready", epoch: current });
  }
  if (options.signal?.aborted) {
    return Promise.resolve({ status: "aborted" });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PdfPageReadyResult) => {
      if (settled) return;
      settled = true;
      listeners.delete(onReady);
      options.signal?.removeEventListener("abort", onAbort);
      clearTimeout(timeout);
      resolve(result);
    };
    const onReady: ReadyListener = (readyPage, readyEpoch) => {
      if (readyPage === pageNumber && readyEpoch > afterEpoch) {
        finish({ status: "ready", epoch: readyEpoch });
      }
    };
    const onAbort = () => finish({ status: "aborted" });
    const timeout = setTimeout(
      () => finish({ status: "timeout" }),
      Math.max(0, options.timeoutMs),
    );

    listeners.add(onReady);
    options.signal?.addEventListener("abort", onAbort, { once: true });

    // Close the check/subscribe race for a synchronous render marker.
    const latest = getPdfPageReadyEpoch(pageNumber);
    if (latest > afterEpoch) finish({ status: "ready", epoch: latest });
    else if (options.signal?.aborted) finish({ status: "aborted" });
  });
}

/** Test isolation only; production readiness is session-scoped. */
export function resetPdfPageReadyForTests(): void {
  epoch = 0;
  readyEpochs.clear();
  listeners.clear();
}
