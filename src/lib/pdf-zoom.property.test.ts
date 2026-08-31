import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculateRenderPlan } from "../domain/rendering/RenderPolicy";
import { useDocumentStore } from "../stores/document-store";
import { capturePdfZoomAnchor, restorePdfZoomAnchor } from "./pdf-zoom-anchor";
import { nextPdfWheelZoom } from "./pdf-wheel-zoom";

type ZoomAction =
  | { kind: "wheel"; deltaY: number }
  | { kind: "set"; zoom: number };

const action = fc.oneof(
  fc
    .integer({ min: -1000, max: 1000 })
    .filter((deltaY) => deltaY !== 0)
    .map((deltaY): ZoomAction => ({ kind: "wheel", deltaY })),
  fc
    .double({ min: -2, max: 8, noNaN: true, noDefaultInfinity: true })
    .map((zoom): ZoomAction => ({ kind: "set", zoom })),
);

const seed = Number(process.env.FC_SEED ?? 20260830);
const numRuns = Number(process.env.FC_NUM_RUNS ?? 500);

describe("real PDF zoom model", () => {
  it("keeps every manual action truthful, bounded, and WebKit-committable", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.25, max: 4, noNaN: true }),
        fc.double({ min: 10, max: 5_000, noNaN: true }),
        fc.double({ min: 10, max: 5_000, noNaN: true }),
        fc.array(action, { minLength: 1, maxLength: 100 }),
        (initialZoom, pageWidth, pageHeight, actions) => {
          useDocumentStore.getState().reset();
          useDocumentStore.setState({ zoomLevel: initialZoom });

          for (const operation of actions) {
            const current = useDocumentStore.getState();
            current.setZoomLevel(
              operation.kind === "wheel"
                ? nextPdfWheelZoom(current.zoomLevel, operation.deltaY)
                : operation.zoom,
            );
            const state = useDocumentStore.getState();
            expect(state.zoomLevel).toBeGreaterThanOrEqual(0.25);
            expect(state.zoomLevel).toBeLessThanOrEqual(4);
            expect(state.fitMode).toBe("none");

            const plan = calculateRenderPlan({
              pageWidth,
              pageHeight,
              zoomLevel: state.zoomLevel,
              settings: {
                qualityMode: "ultra",
                maxMegapixels: 0,
                hwAccelerationEnabled: true,
                debugOverlayEnabled: false,
              },
              displayInfo: {
                devicePixelRatio: 1,
                viewportWidth: 1920,
                viewportHeight: 1080,
              },
            });
            expect(
              Math.max(plan.canvasWidth, plan.canvasHeight),
            ).toBeLessThanOrEqual(8192);
            expect(plan.canvasWidth).toBeGreaterThanOrEqual(1);
            expect(plan.canvasHeight).toBeGreaterThanOrEqual(1);
            expect(plan.viewportWidth).toBeCloseTo(pageWidth * state.zoomLevel);
            expect(plan.viewportHeight).toBeCloseTo(
              pageHeight * state.zoomLevel,
            );
          }
        },
      ),
      { seed, numRuns, path: process.env.FC_PATH, endOnFailure: true },
    );
  });

  it("restores arbitrary pointer anchors after a real geometry change", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.01, max: 3, noNaN: true }),
        fc.double({ min: 100, max: 700, noNaN: true }),
        fc.double({ min: 100, max: 500, noNaN: true }),
        (ratio, pointerX, pointerY) => {
          const viewer = { left: 0, top: 0, width: 800, height: 600 };
          const oldPage = { left: 50, top: 40, width: 700, height: 900 };
          const anchor = capturePdfZoomAnchor(oldPage, viewer, 1, ratio, {
            x: pointerX,
            y: pointerY,
          });
          if (!anchor) throw new Error("zoom anchor was not captured");

          const newPage = {
            left: oldPage.left,
            top: oldPage.top,
            width: oldPage.width * ratio,
            height: oldPage.height * ratio,
          };
          const target = restorePdfZoomAnchor(anchor, newPage, viewer, {
            left: 0,
            top: 0,
            maxLeft: 10_000,
            maxTop: 10_000,
          });
          const settledPage = {
            left: newPage.left - target.left,
            top: newPage.top - target.top,
          };

          expect(settledPage.left + anchor.pageX * newPage.width).toBeCloseTo(
            viewer.left + anchor.viewportX,
            8,
          );
          expect(settledPage.top + anchor.pageY * newPage.height).toBeCloseTo(
            viewer.top + anchor.viewportY,
            8,
          );
        },
      ),
      { seed, numRuns, path: process.env.FC_PATH, endOnFailure: true },
    );
  });
});
