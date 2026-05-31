/**
 * Unit tests for resolveCharRange (spec 025, P1 #7 pt.4) — the pure arithmetic
 * behind TtsWordHighlight.createWordRange. Pins start/end node resolution, the
 * clamp-to-last-node behavior for words straddling a page boundary, and the
 * off-page (null) case.
 */
import { describe, it, expect } from "vitest";
import { resolveCharRange } from "../../lib/tts-tracking";

describe("resolveCharRange", () => {
  it("returns null for non-positive length or negative offset", () => {
    expect(resolveCharRange([10], 0, 0)).toBeNull();
    expect(resolveCharRange([10], 0, -1)).toBeNull();
    expect(resolveCharRange([10], -1, 3)).toBeNull();
  });

  it("returns null when there is no text", () => {
    expect(resolveCharRange([], 0, 1)).toBeNull();
  });

  it("returns null when the offset starts beyond all text (off-page)", () => {
    expect(resolveCharRange([5], 5, 2)).toBeNull(); // == total
    expect(resolveCharRange([5], 6, 2)).toBeNull(); // > total
    expect(resolveCharRange([5, 3], 8, 1)).toBeNull();
  });

  it("resolves a range inside a single node", () => {
    expect(resolveCharRange([10], 2, 3)).toEqual({
      startIndex: 0,
      startOffset: 2,
      endIndex: 0,
      endOffset: 5,
      clamped: false,
    });
  });

  it("resolves a range spanning multiple nodes", () => {
    // lengths [5,3,4] (total 12): offset 6 -> node1 local1; end 10 -> node2 local2.
    expect(resolveCharRange([5, 3, 4], 6, 4)).toEqual({
      startIndex: 1,
      startOffset: 1,
      endIndex: 2,
      endOffset: 2,
      clamped: false,
    });
  });

  it("clamps to the last node when the end overruns (page straddle)", () => {
    // Start node != last node, so this distinguishes the fix from the OLD bug
    // (which clamped to the START node's end). lengths [5,3,4] (total 12):
    // offset 6 -> node1 local1; len 10 -> end 16 > 12 -> clamp to node2's end.
    // Old bug would have given endIndex 1, endOffset 3 (start node).
    expect(resolveCharRange([5, 3, 4], 6, 10)).toEqual({
      startIndex: 1,
      startOffset: 1,
      endIndex: 2,
      endOffset: 4,
      clamped: true,
    });
  });

  it("handles a range ending exactly at the last node end (not clamped)", () => {
    expect(resolveCharRange([5, 5], 0, 10)).toEqual({
      startIndex: 0,
      startOffset: 0,
      endIndex: 1,
      endOffset: 5,
      clamped: false,
    });
  });
});
