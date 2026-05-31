/**
 * Unit tests for findWordIndexAtTime — the karaoke "word under the playback
 * head" selection. This pure function was extracted from the requestAnimationFrame
 * loop in useTtsWordHighlight (spec 022); these tests pin its exact semantics:
 * in-range match, gap-fill (hold previous word during silent gaps), tail (hold
 * last word once past its start), and -1 before the first word / when empty.
 */
import { describe, it, expect } from "vitest";
import { findWordIndexAtTime } from "../../lib/tts-tracking";

type T = { startTime: number; endTime: number };

// Three words with a silent gap between word 1 (ends 2.0) and word 2 (starts 3.0).
const words: T[] = [
  { startTime: 0.0, endTime: 1.0 },
  { startTime: 1.0, endTime: 2.0 },
  { startTime: 3.0, endTime: 4.0 },
];

describe("findWordIndexAtTime", () => {
  it("returns -1 for an empty timing list", () => {
    expect(findWordIndexAtTime(0, [])).toBe(-1);
    expect(findWordIndexAtTime(5, [])).toBe(-1);
  });

  it("returns -1 before the first word starts", () => {
    // First word starts at 2.0; nothing is highlighted before then.
    const late: T[] = [{ startTime: 2.0, endTime: 3.0 }];
    expect(findWordIndexAtTime(0, late)).toBe(-1);
    expect(findWordIndexAtTime(1.999, late)).toBe(-1);
  });

  it("matches the in-range word ([startTime, endTime))", () => {
    expect(findWordIndexAtTime(0.0, words)).toBe(0); // at start, inclusive
    expect(findWordIndexAtTime(0.5, words)).toBe(0);
    expect(findWordIndexAtTime(1.0, words)).toBe(1); // boundary belongs to next
    expect(findWordIndexAtTime(1.5, words)).toBe(1);
    expect(findWordIndexAtTime(3.0, words)).toBe(2);
    expect(findWordIndexAtTime(3.999, words)).toBe(2);
  });

  it("holds the previous word during a silent gap (gap-fill)", () => {
    // Gap is [2.0, 3.0): word 1 ended, word 2 not yet started.
    expect(findWordIndexAtTime(2.0, words)).toBe(1); // at the gap's start (word1 end)
    expect(findWordIndexAtTime(2.5, words)).toBe(1);
    expect(findWordIndexAtTime(2.999, words)).toBe(1);
  });

  it("holds the last word once past its start (tail)", () => {
    expect(findWordIndexAtTime(4.0, words)).toBe(2); // at last word's end
    expect(findWordIndexAtTime(10, words)).toBe(2); // far past
  });

  it("handles a single word: -1 before, 0 at/after its start", () => {
    const one: T[] = [{ startTime: 1.0, endTime: 2.0 }];
    expect(findWordIndexAtTime(0.5, one)).toBe(-1);
    expect(findWordIndexAtTime(1.0, one)).toBe(0);
    expect(findWordIndexAtTime(1.5, one)).toBe(0);
    expect(findWordIndexAtTime(2.0, one)).toBe(0); // tail (past start, at end)
    expect(findWordIndexAtTime(9.0, one)).toBe(0); // tail
  });

  it("treats back-to-back words with no gap continuously", () => {
    // No gaps: every instant from the first start on maps to some word.
    expect(findWordIndexAtTime(0.0, words)).toBe(0);
    expect(findWordIndexAtTime(0.9999, words)).toBe(0);
    expect(findWordIndexAtTime(1.0, words)).toBe(1);
  });
});
