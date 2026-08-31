/**
 * RenderPolicy Unit Tests
 *
 * Tests for the core rendering calculation logic.
 * Covers calculateRenderPlan, megapixel capping, and fit mode calculations.
 */

import { describe, it, expect } from "vitest";
import {
  calculateRenderPlan,
  calculateOptimalOutputScale,
  calculateMemoryMB,
  calculateMegapixels,
  calculateFitWidthZoom,
  calculateFitPageZoom,
  getTransformMatrix,
  formatDebugOverlayData,
} from "../../../domain/rendering/RenderPolicy";
import type {
  RenderSettings,
  DisplayInfo,
} from "../../../domain/rendering/types";
import {
  DEFAULT_RENDER_SETTINGS,
  RenderPlanSchema,
} from "../../../domain/rendering/types";

// Test fixtures
const createDisplayInfo = (
  overrides: Partial<DisplayInfo> = {},
): DisplayInfo => ({
  devicePixelRatio: 2,
  viewportWidth: 1200,
  viewportHeight: 800,
  ...overrides,
});

const createSettings = (
  overrides: Partial<RenderSettings> = {},
): RenderSettings => ({
  ...DEFAULT_RENDER_SETTINGS,
  ...overrides,
});

describe("RenderPolicy", () => {
  describe("calculateRenderPlan", () => {
    it("calculates basic render plan at 100% zoom", () => {
      const plan = calculateRenderPlan({
        pageWidth: 595, // A4 width in points
        pageHeight: 842, // A4 height in points
        zoomLevel: 1.0,
        settings: createSettings({ qualityMode: "balanced" }),
        displayInfo: createDisplayInfo({ devicePixelRatio: 2 }),
      });

      expect(plan.zoomLevel).toBe(1.0);
      expect(plan.viewportWidth).toBe(595);
      expect(plan.viewportHeight).toBe(842);
      expect(plan.outputScale).toBeGreaterThanOrEqual(2); // DPR minimum
      expect(plan.canvasWidth).toBe(Math.floor(595 * plan.outputScale));
      expect(plan.canvasHeight).toBe(Math.floor(842 * plan.outputScale));
      expect(plan.wasCapped).toBe(false);
    });

    it("applies zoom level to viewport dimensions", () => {
      const plan = calculateRenderPlan({
        pageWidth: 595,
        pageHeight: 842,
        zoomLevel: 1.5,
        settings: createSettings(),
        displayInfo: createDisplayInfo(),
      });

      expect(plan.zoomLevel).toBe(1.5);
      expect(plan.viewportWidth).toBe(595 * 1.5);
      expect(plan.viewportHeight).toBe(842 * 1.5);
    });

    it("uses quality mode minimum output scale", () => {
      const performancePlan = calculateRenderPlan({
        pageWidth: 595,
        pageHeight: 842,
        zoomLevel: 1.0,
        settings: createSettings({ qualityMode: "performance" }),
        displayInfo: createDisplayInfo({ devicePixelRatio: 1 }),
      });

      const ultraPlan = calculateRenderPlan({
        pageWidth: 595,
        pageHeight: 842,
        zoomLevel: 1.0,
        settings: createSettings({ qualityMode: "ultra" }),
        displayInfo: createDisplayInfo({ devicePixelRatio: 1 }),
      });

      // Performance: 1.5x, Ultra: 4.0x
      expect(performancePlan.outputScale).toBe(1.5);
      expect(ultraPlan.outputScale).toBe(4.0);
    });

    it("never drops output scale below device pixel ratio", () => {
      const plan = calculateRenderPlan({
        pageWidth: 595,
        pageHeight: 842,
        zoomLevel: 1.0,
        settings: createSettings({ qualityMode: "performance" }), // 1.5x min
        displayInfo: createDisplayInfo({ devicePixelRatio: 2.5 }), // Higher DPR
      });

      // Should use DPR (2.5) since it's higher than performance mode min (1.5)
      expect(plan.outputScale).toBe(2.5);
    });

    it.each([1, 2, 2.8, 3.3, 4])(
      "commits %sx CSS geometry inside the WebKit backing-canvas limit",
      (zoomLevel) => {
        const plan = calculateRenderPlan({
          pageWidth: 612,
          pageHeight: 792,
          zoomLevel,
          settings: createSettings({ qualityMode: "ultra", maxMegapixels: 0 }),
          displayInfo: createDisplayInfo({ devicePixelRatio: 1 }),
        });

        expect(plan.viewportWidth).toBeCloseTo(612 * zoomLevel);
        expect(plan.viewportHeight).toBeCloseTo(792 * zoomLevel);
        expect(
          Math.max(plan.canvasWidth, plan.canvasHeight),
        ).toBeLessThanOrEqual(8192);
      },
    );

    it("keeps an A1 page at 400% truthful while capping its backing canvas", () => {
      const plan = calculateRenderPlan({
        pageWidth: 1684,
        pageHeight: 2384,
        zoomLevel: 4,
        settings: createSettings({ qualityMode: "ultra", maxMegapixels: 0 }),
        displayInfo: createDisplayInfo({ devicePixelRatio: 2 }),
      });

      expect(plan.zoomLevel).toBe(4);
      expect(plan.viewportWidth).toBe(6736);
      expect(plan.viewportHeight).toBe(9536);
      expect(plan.outputScale).toBeLessThan(1);
      expect(Math.max(plan.canvasWidth, plan.canvasHeight)).toBeLessThanOrEqual(
        8192,
      );
      expect(plan.wasCapped).toBe(true);
      expect(RenderPlanSchema.parse(plan)).toEqual(plan);
    });

    it("keeps 280% PDF zoom inside WebKit canvas dimensions even when the configurable megapixel cap is disabled", () => {
      const plan = calculateRenderPlan({
        pageWidth: 612,
        pageHeight: 792,
        zoomLevel: 2.8,
        settings: createSettings({ qualityMode: "ultra", maxMegapixels: 0 }),
        displayInfo: createDisplayInfo({
          devicePixelRatio: 1,
          viewportWidth: 1920,
          viewportHeight: 1080,
        }),
      });

      // WebKit's 8192×8192 backing-canvas ceiling is independent of the
      // user-configurable megapixel cap (spec 004 research, Canvas Limits).
      expect(Math.max(plan.canvasWidth, plan.canvasHeight)).toBeLessThanOrEqual(
        8192,
      );
      expect(plan.viewportWidth).toBeCloseTo(1713.6);
      expect(plan.viewportHeight).toBeCloseTo(2217.6);
      expect(plan.outputScale).toBe(3);
      expect(plan.wasCapped).toBe(true);
    });
  });

  describe("calculateOptimalOutputScale (megapixel capping)", () => {
    it("returns target scale when under megapixel limit", () => {
      const result = calculateOptimalOutputScale(
        800, // viewport width
        600, // viewport height
        2.0, // target scale
        24, // max megapixels
      );

      // 800 * 2 * 600 * 2 = 3,840,000 pixels = 3.84 MP (well under 24 MP)
      expect(result.outputScale).toBe(2.0);
      expect(result.wasCapped).toBe(false);
    });

    it("caps output scale when exceeding megapixel limit", () => {
      const result = calculateOptimalOutputScale(
        4000, // viewport width
        3000, // viewport height
        4.0, // target scale
        24, // max megapixels
      );

      // 4000 * 4 * 3000 * 4 = 192,000,000 pixels = 192 MP (way over 24 MP)
      // Should fall back to lower scale
      expect(result.outputScale).toBeLessThan(4.0);
      expect(result.wasCapped).toBe(true);

      // Verify final size is under limit
      const finalMegapixels =
        (4000 * result.outputScale * 3000 * result.outputScale) / 1_000_000;
      expect(finalMegapixels).toBeLessThanOrEqual(24);
    });

    it("uses fallback cascade to find highest acceptable scale", () => {
      // Test that we get the highest scale that fits, not just any scale that fits
      const result = calculateOptimalOutputScale(
        2000, // viewport width
        1500, // viewport height
        4.0, // target scale
        24, // max megapixels
      );

      // At 4x: 8000 * 6000 = 48 MP (too high)
      // At 3x: 6000 * 4500 = 27 MP (too high)
      // At 2x: 4000 * 3000 = 12 MP (fits!)
      expect(result.outputScale).toBe(2);
      expect(result.wasCapped).toBe(true);
    });

    it("uses a fractional backing scale when 1x would violate hard limits", () => {
      const result = calculateOptimalOutputScale(10000, 10000, 4.0, 1);

      expect(result.outputScale).toBeCloseTo(0.1);
      expect(10000 * result.outputScale).toBeLessThanOrEqual(8192);
      expect(
        (10000 * result.outputScale * 10000 * result.outputScale) / 1_000_000,
      ).toBeLessThanOrEqual(1);
      expect(result.wasCapped).toBe(true);
    });
  });

  describe("calculateMemoryMB", () => {
    it("calculates memory for RGBA canvas", () => {
      // 1000 x 1000 = 1,000,000 pixels
      // 1,000,000 * 4 bytes = 4,000,000 bytes
      // 4,000,000 / (1024 * 1024) ≈ 3.81 MB
      const memory = calculateMemoryMB(1000, 1000);
      expect(memory).toBeCloseTo(3.81, 1);
    });

    it("calculates memory for large canvas", () => {
      // 4000 x 3000 = 12,000,000 pixels
      // 12,000,000 * 4 = 48,000,000 bytes
      // 48,000,000 / (1024 * 1024) ≈ 45.78 MB
      const memory = calculateMemoryMB(4000, 3000);
      expect(memory).toBeCloseTo(45.78, 1);
    });
  });

  describe("calculateMegapixels", () => {
    it("calculates megapixels correctly", () => {
      expect(calculateMegapixels(1000, 1000)).toBe(1);
      expect(calculateMegapixels(2000, 3000)).toBe(6);
      expect(calculateMegapixels(4000, 6000)).toBe(24);
    });
  });

  describe("calculateFitWidthZoom", () => {
    it("calculates zoom to fit page width in container", () => {
      const zoom = calculateFitWidthZoom({
        pageWidth: 595,
        pageHeight: 842,
        containerWidth: 1200,
        containerHeight: 800,
      });

      // 1200 / 595 ≈ 2.02
      expect(zoom).toBeCloseTo(2.02, 1);
    });

    it("accounts for padding", () => {
      const zoom = calculateFitWidthZoom({
        pageWidth: 595,
        pageHeight: 842,
        containerWidth: 1200,
        containerHeight: 800,
        padding: 50,
      });

      // (1200 - 100) / 595 ≈ 1.85
      expect(zoom).toBeCloseTo(1.85, 1);
    });

    it("returns 1.0 for invalid inputs", () => {
      expect(
        calculateFitWidthZoom({
          pageWidth: 0,
          pageHeight: 842,
          containerWidth: 1200,
          containerHeight: 800,
        }),
      ).toBe(1.0);

      expect(
        calculateFitWidthZoom({
          pageWidth: 595,
          pageHeight: 842,
          containerWidth: 0,
          containerHeight: 800,
        }),
      ).toBe(1.0);
    });
  });

  describe("calculateFitPageZoom", () => {
    it("calculates zoom to fit entire page in container (width-constrained)", () => {
      const zoom = calculateFitPageZoom({
        pageWidth: 842, // Landscape page
        pageHeight: 595,
        containerWidth: 1200,
        containerHeight: 800,
      });

      // Width ratio: 1200 / 842 ≈ 1.43
      // Height ratio: 800 / 595 ≈ 1.34
      // Should use height ratio (smaller) = 1.34
      expect(zoom).toBeCloseTo(1.34, 1);
    });

    it("calculates zoom to fit entire page in container (height-constrained)", () => {
      const zoom = calculateFitPageZoom({
        pageWidth: 595, // Portrait page
        pageHeight: 842,
        containerWidth: 1200,
        containerHeight: 600,
      });

      // Width ratio: 1200 / 595 ≈ 2.02
      // Height ratio: 600 / 842 ≈ 0.71
      // Should use height ratio (smaller) = 0.71
      expect(zoom).toBeCloseTo(0.71, 1);
    });

    it("accounts for padding", () => {
      const zoom = calculateFitPageZoom({
        pageWidth: 595,
        pageHeight: 842,
        containerWidth: 1200,
        containerHeight: 900,
        padding: 50,
      });

      // Available: 1100 x 800
      // Width ratio: 1100 / 595 ≈ 1.85
      // Height ratio: 800 / 842 ≈ 0.95
      // Should use 0.95
      expect(zoom).toBeCloseTo(0.95, 1);
    });
  });

  describe("getTransformMatrix", () => {
    it("returns undefined for scale of 1", () => {
      expect(getTransformMatrix(1)).toBeUndefined();
    });

    it("returns transform matrix for other scales", () => {
      const matrix = getTransformMatrix(2);
      expect(matrix).toEqual([2, 0, 0, 2, 0, 0]);

      const matrix3 = getTransformMatrix(3);
      expect(matrix3).toEqual([3, 0, 0, 3, 0, 0]);
    });
  });

  describe("formatDebugOverlayData", () => {
    it("formats debug data for display", () => {
      const plan = calculateRenderPlan({
        pageWidth: 595,
        pageHeight: 842,
        zoomLevel: 1.5,
        settings: createSettings({
          qualityMode: "balanced",
          maxMegapixels: 24,
        }),
        displayInfo: createDisplayInfo({ devicePixelRatio: 2 }),
      });

      const formatted = formatDebugOverlayData(
        plan,
        createSettings({ qualityMode: "balanced" }),
        createDisplayInfo({ devicePixelRatio: 2 }),
      );

      expect(formatted.viewport).toMatch(/^\d+x\d+$/);
      expect(formatted.canvas).toMatch(/^\d+x\d+$/);
      expect(formatted.megapixels).toMatch(/^\d+\.\d+ MP$/);
      expect(formatted.memory).toMatch(/^~\d+ MB$/);
      expect(formatted.qualityMode).toBe("Balanced");
      expect(formatted.outputScale).toMatch(/^\d+\.\d+x$/);
      expect(formatted.capped).toMatch(/^(Yes|No)$/);
    });
  });
});
