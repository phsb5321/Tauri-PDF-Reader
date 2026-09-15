import { describe, expect, it } from "vitest";
import { zoomPreview } from "./pdf-zoom-preview";

describe("zoom preview", () => {
  it("scales already-rendered pixels up and down to the requested zoom", () => {
    expect(zoomPreview(1, 1.25)).toEqual({
      ratio: 1.25,
      transform: "scale(1.25)",
      transformOrigin: "top left",
    });
    expect(zoomPreview(2, 1)?.transform).toBe("scale(0.5)");
  });

  it("returns no preview when the canvas already matches", () => {
    expect(zoomPreview(1.5, 1.5)).toBeNull();
    // Sub-pixel drift is not worth a compositor layer.
    expect(zoomPreview(1, 1.0005)).toBeNull();
  });

  it("refuses degenerate geometry instead of emitting a broken transform", () => {
    expect(zoomPreview(0, 1)).toBeNull();
    expect(zoomPreview(1, 0)).toBeNull();
    expect(zoomPreview(-1, 1)).toBeNull();
    expect(zoomPreview(Number.NaN, 1)).toBeNull();
    expect(zoomPreview(1, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
