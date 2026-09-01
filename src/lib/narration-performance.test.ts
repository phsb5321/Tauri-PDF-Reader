import { describe, expect, it } from "vitest";
import {
  DEFAULT_NARRATION_PERFORMANCE_PROFILE,
  isNarrationPerformanceProfile,
  narrationPerformancePolicy,
} from "./narration-performance";

describe("narration performance policy", () => {
  it("keeps balanced as the source-aligned default", () => {
    expect(DEFAULT_NARRATION_PERFORMANCE_PROFILE).toBe("balanced");
    expect(narrationPerformancePolicy("balanced", 8_192)).toEqual({
      contextMaxUtf8Bytes: 300,
      lookaheadUnits: 1,
    });
  });

  it("maps responsive and continuous to real queue trade-offs", () => {
    expect(narrationPerformancePolicy("responsive", 8_192)).toEqual({
      contextMaxUtf8Bytes: 180,
      lookaheadUnits: 1,
    });
    expect(narrationPerformancePolicy("continuous", 8_192)).toEqual({
      contextMaxUtf8Bytes: 300,
      lookaheadUnits: 2,
    });
  });

  it("never exceeds the connected provider limit", () => {
    expect(narrationPerformancePolicy("continuous", 200)).toEqual({
      contextMaxUtf8Bytes: 200,
      lookaheadUnits: 2,
    });
  });

  it("rejects malformed persisted profile values", () => {
    expect(isNarrationPerformanceProfile("continuous")).toBe(true);
    expect(isNarrationPerformanceProfile("turbo")).toBe(false);
    expect(isNarrationPerformanceProfile(null)).toBe(false);
  });
});
