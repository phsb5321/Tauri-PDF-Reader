/**
 * Playback-speed range — spec 039 (pitch-preserving speed).
 *
 * The store's `setSpeed` clamps to [MIN_SPEED, MAX_SPEED]. Spec 039 raised the
 * ceiling from 2.0× to 4.5×; these pin that the extended range is selectable and
 * out-of-range input clamps (FR-011 / SC-005) rather than erroring.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useAiTtsStore } from "../../stores/ai-tts-store";

describe("ai-tts-store speed range (spec 039)", () => {
  beforeEach(() => {
    useAiTtsStore.setState({ speed: 1.0 });
  });

  it("accepts the extended range up to 4.5× and clamps above it", () => {
    useAiTtsStore.getState().setSpeed(4.5);
    expect(useAiTtsStore.getState().speed).toBe(4.5);

    useAiTtsStore.getState().setSpeed(6.0);
    expect(useAiTtsStore.getState().speed).toBe(4.5); // clamped to the new max
  });

  it("keeps a value that the OLD 2.0× cap would have clamped (regression for SC-005)", () => {
    useAiTtsStore.getState().setSpeed(3.0);
    expect(useAiTtsStore.getState().speed).toBe(3.0);
  });

  it("clamps below the 0.5× floor", () => {
    useAiTtsStore.getState().setSpeed(0.1);
    expect(useAiTtsStore.getState().speed).toBe(0.5);
  });
});
