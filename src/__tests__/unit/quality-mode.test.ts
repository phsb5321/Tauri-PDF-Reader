/**
 * Unit tests for the render quality-mode domain helpers. Pure config + logic,
 * previously 0% covered.
 */
import { describe, it, expect } from "vitest";
import {
  QUALITY_MODE_CONFIGS,
  getMinOutputScale,
  getQualityModeOptions,
  isValidQualityMode,
} from "../../domain/rendering/QualityMode";

describe("QualityMode", () => {
  it("defines the three modes with ascending min output scales", () => {
    expect(QUALITY_MODE_CONFIGS.performance.minOutputScale).toBe(1.5);
    expect(QUALITY_MODE_CONFIGS.balanced.minOutputScale).toBe(2.0);
    expect(QUALITY_MODE_CONFIGS.ultra.minOutputScale).toBe(4.0);
  });

  describe("getMinOutputScale", () => {
    it("uses the mode's min when DPR is lower", () => {
      expect(getMinOutputScale("performance", 1.0)).toBe(1.5);
      expect(getMinOutputScale("ultra", 2.0)).toBe(4.0);
    });
    it("never goes below the device pixel ratio (avoids upscaling blur)", () => {
      expect(getMinOutputScale("performance", 3.0)).toBe(3.0);
      expect(getMinOutputScale("balanced", 2.5)).toBe(2.5);
    });
  });

  it("getQualityModeOptions returns one labelled option per mode", () => {
    const opts = getQualityModeOptions();
    expect(opts.map((o) => o.value).sort()).toEqual([
      "balanced",
      "performance",
      "ultra",
    ]);
    expect(
      opts.every((o) => o.label.length > 0 && o.description.length > 0),
    ).toBe(true);
  });

  describe("isValidQualityMode", () => {
    it("accepts the known modes", () => {
      expect(isValidQualityMode("performance")).toBe(true);
      expect(isValidQualityMode("balanced")).toBe(true);
      expect(isValidQualityMode("ultra")).toBe(true);
    });
    it("rejects anything else", () => {
      expect(isValidQualityMode("")).toBe(false);
      expect(isValidQualityMode("Ultra")).toBe(false); // case-sensitive
      expect(isValidQualityMode("high")).toBe(false);
    });
  });
});
