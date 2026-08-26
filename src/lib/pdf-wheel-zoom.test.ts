import { describe, expect, it } from "vitest";
import { nextPdfWheelZoom } from "./pdf-wheel-zoom";

describe("Ctrl+wheel PDF zoom", () => {
  it("zooms in on wheel-up and out on wheel-down", () => {
    expect(nextPdfWheelZoom(1, -100)).toBeCloseTo(1.133, 3);
    expect(nextPdfWheelZoom(1, 100)).toBeCloseTo(0.882, 3);
  });

  it("scales smoothly at high zoom and clamps the supported range", () => {
    expect(nextPdfWheelZoom(2, -1)).toBeCloseTo(2.0025, 4);
    expect(nextPdfWheelZoom(4, -1)).toBe(4);
    expect(nextPdfWheelZoom(0.25, 1)).toBe(0.25);
  });

  it("ignores zero-delta wheels", () => {
    expect(nextPdfWheelZoom(1.25, 0)).toBe(1.25);
  });
});
