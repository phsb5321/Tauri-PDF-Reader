import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  NARRATION_TABS,
  nextNarrationTabIndex,
} from "../components/playback-bar/NarrationCockpit";
import {
  markPdfPageReady,
  resetPdfPageReadyForTests,
  waitForPdfPageReady,
} from "./pdf-page-ready";
import { isEffectiveWholePageBounds } from "./selection-narration";

const seed = Number(process.env.FC_SEED ?? 20260830);
const numRuns = Number(process.env.FC_NUM_RUNS ?? 500);
const key = fc.constantFrom(
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "Tab",
  "Escape",
);

describe("narration cockpit command model", () => {
  it("keeps arbitrary tab-key sequences in one valid roving selection", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: NARRATION_TABS.length - 1 }),
        fc.array(key, { minLength: 1, maxLength: 100 }),
        (initial, keys) => {
          let index = initial;
          for (const pressed of keys) {
            const next = nextNarrationTabIndex(index, pressed);
            if (next !== null) index = next;
            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThan(NARRATION_TABS.length);
            if (pressed === "Home") expect(index).toBe(0);
            if (pressed === "End") {
              expect(index).toBe(NARRATION_TABS.length - 1);
            }
          }
        },
      ),
      { seed, numRuns, path: process.env.FC_PATH, endOnFailure: true },
    );
  });

  it("settles generated page-ready races on the first matching render or cancellation", async () => {
    const readinessAction = fc.oneof(
      fc
        .integer({ min: 1, max: 3 })
        .map((page) => ({ kind: "ready" as const, page })),
      fc.constant({ kind: "abort" as const }),
    );
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        fc.array(readinessAction, { maxLength: 30 }),
        async (targetPage, actions) => {
          resetPdfPageReadyForTests();
          const controller = new AbortController();
          const result = waitForPdfPageReady(targetPage, 0, {
            signal: controller.signal,
            timeoutMs: 0,
          });
          let expected: "ready" | "aborted" | "timeout" = "timeout";
          for (const action of actions) {
            if (expected !== "timeout") continue;
            if (action.kind === "abort") {
              expected = "aborted";
              controller.abort();
            } else {
              markPdfPageReady(action.page);
              if (action.page === targetPage) expected = "ready";
            }
          }
          expect((await result).status).toBe(expected);
        },
      ),
      { seed, numRuns, path: process.env.FC_PATH, endOnFailure: true },
    );
  });

  it("rejects arbitrary partial selections and accepts edge-anchored 95% pages", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 40, max: 20_000 }),
        fc.double({ min: 0.01, max: 0.94, noNaN: true }),
        (pageLength, coverage) => {
          const end = Math.max(1, Math.floor(pageLength * coverage));
          expect(
            isEffectiveWholePageBounds({ start: 0, end, pageLength }),
          ).toBe(false);

          const edge = Math.floor(pageLength * 0.025);
          expect(
            isEffectiveWholePageBounds({
              start: edge,
              end: pageLength - edge,
              pageLength,
            }),
          ).toBe(true);
        },
      ),
      { seed, numRuns, path: process.env.FC_PATH, endOnFailure: true },
    );
  });
});
