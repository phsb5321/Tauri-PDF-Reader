/**
 * Unit tests for isPlaybackComplete (spec 026) — the timer-completion predicate
 * used by useTtsWordHighlight. The key contract: with no positive duration
 * (the missing-alignment case, totalDuration 0) it must NOT report complete,
 * which previously fired onComplete on the first frame and skipped the page.
 */
import { describe, it, expect } from "vitest";
import { isPlaybackComplete } from "../../lib/tts-tracking";

describe("isPlaybackComplete", () => {
  it("is false when there is no positive duration (missing-alignment case)", () => {
    // The first-frame bug: elapsed ~0, totalDuration 0 must NOT complete.
    expect(isPlaybackComplete(0, 0)).toBe(false);
    expect(isPlaybackComplete(0.016, 0)).toBe(false);
    expect(isPlaybackComplete(999, 0)).toBe(false);
    expect(isPlaybackComplete(5, -1)).toBe(false);
  });

  it("is false while elapsed is before the duration", () => {
    expect(isPlaybackComplete(0, 10)).toBe(false);
    expect(isPlaybackComplete(9.999, 10)).toBe(false);
  });

  it("is true once elapsed reaches or passes a positive duration", () => {
    expect(isPlaybackComplete(10, 10)).toBe(true); // exact end
    expect(isPlaybackComplete(10.5, 10)).toBe(true);
  });
});
