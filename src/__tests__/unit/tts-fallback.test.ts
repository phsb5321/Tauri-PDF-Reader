/**
 * Unit tests for the sentence-level karaoke fallback (spec 024, P1 #7 pt.3).
 * These are the pure building blocks used when ElevenLabs returns no per-word
 * alignment: segment text into sentences with original-text UTF-16 offsets, and
 * spread the (real or estimated) duration across them.
 */
import { describe, it, expect } from "vitest";
import {
  segmentSentencesWithOffsets,
  buildSentenceFallbackTimings,
  buildWordFallbackTimings,
} from "../../lib/tts-tracking";

describe("segmentSentencesWithOffsets", () => {
  it("returns [] for empty / whitespace-only text", () => {
    expect(segmentSentencesWithOffsets("")).toEqual([]);
    expect(segmentSentencesWithOffsets("   \n  ")).toEqual([]);
  });

  it("splits two sentences with correct original-text offsets", () => {
    const spans = segmentSentencesWithOffsets("Hello world. How are you?");
    expect(spans).toEqual([
      { text: "Hello world.", charStart: 0, charEnd: 12 },
      { text: "How are you?", charStart: 13, charEnd: 25 },
    ]);
  });

  it("trims leading/trailing whitespace from the span offsets", () => {
    const spans = segmentSentencesWithOffsets("  Hi.  Bye.  ");
    expect(spans).toEqual([
      { text: "Hi.", charStart: 2, charEnd: 5 },
      { text: "Bye.", charStart: 7, charEnd: 11 },
    ]);
  });

  it("keeps a trailing fragment without terminal punctuation as its own span", () => {
    const spans = segmentSentencesWithOffsets("Done. And more");
    expect(spans).toEqual([
      { text: "Done.", charStart: 0, charEnd: 5 },
      { text: "And more", charStart: 6, charEnd: 14 },
    ]);
  });

  it("consumes a run of terminators and trailing closers as one boundary", () => {
    expect(segmentSentencesWithOffsets("Wait?! Go.")).toEqual([
      { text: "Wait?!", charStart: 0, charEnd: 6 },
      { text: "Go.", charStart: 7, charEnd: 10 },
    ]);
    // Closing quote after the period is part of the sentence.
    const q = segmentSentencesWithOffsets('"Go." Next.');
    expect(q[0]).toEqual({ text: '"Go."', charStart: 0, charEnd: 5 });
  });

  it("keeps decimals and abbreviations inside their sentence", () => {
    expect(
      segmentSentencesWithOffsets("Dr. Ada uses v1.2, e.g. in tests. Next."),
    ).toEqual([
      {
        text: "Dr. Ada uses v1.2, e.g. in tests.",
        charStart: 0,
        charEnd: 33,
      },
      { text: "Next.", charStart: 34, charEnd: 39 },
    ]);
  });

  it("treats a Unicode ellipsis as a sentence terminator", () => {
    expect(segmentSentencesWithOffsets("Wait… Continue.")).toEqual([
      { text: "Wait…", charStart: 0, charEnd: 5 },
      { text: "Continue.", charStart: 6, charEnd: 15 },
    ]);
  });

  it("uses UTF-16 offsets (accents are one code unit)", () => {
    const spans = segmentSentencesWithOffsets("café. ok");
    expect(spans[0]).toEqual({ text: "café.", charStart: 0, charEnd: 5 });
    expect(spans[1]).toEqual({ text: "ok", charStart: 6, charEnd: 8 });
  });
});

describe("buildWordFallbackTimings", () => {
  it("binds every word to original UTF-16 offsets and the real audio clock", () => {
    const timings = buildWordFallbackTimings("Alpha beta, gamma.", 9);

    expect(
      timings.map(({ word, charStart, charEnd }) => ({
        word,
        charStart,
        charEnd,
      })),
    ).toEqual([
      { word: "Alpha", charStart: 0, charEnd: 5 },
      { word: "beta,", charStart: 6, charEnd: 11 },
      { word: "gamma.", charStart: 12, charEnd: 18 },
    ]);
    expect(timings[0].startTime).toBe(0);
    expect(timings[2].endTime).toBe(9);
    expect(timings[1].startTime).toBe(timings[0].endTime);
    expect(timings[2].startTime).toBe(timings[1].endTime);
  });

  it("fails closed without text and estimates an honest clock without duration", () => {
    expect(buildWordFallbackTimings("", 5)).toEqual([]);
    const estimated = buildWordFallbackTimings("one two three four five", 0);
    expect(estimated).toHaveLength(5);
    expect(estimated[0].startTime).toBe(0);
    expect(estimated.at(-1)?.endTime).toBeCloseTo(2, 9);
  });
});

describe("buildSentenceFallbackTimings", () => {
  it("returns [] for empty text", () => {
    expect(buildSentenceFallbackTimings("", 10)).toEqual([]);
    expect(buildSentenceFallbackTimings("   ", 10)).toEqual([]);
  });

  it("spreads an explicit duration proportionally; last ends exactly at duration", () => {
    const t = buildSentenceFallbackTimings("Hello world. How are you?", 10);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({
      word: "Hello world.",
      startTime: 0,
      charStart: 0,
      charEnd: 12,
    });
    // Equal-length sentences (12 chars each) -> half each.
    expect(t[0].endTime).toBeCloseTo(5, 9);
    expect(t[1].startTime).toBeCloseTo(5, 9);
    expect(t[1].endTime).toBe(10); // exact, no float drift
    expect(t[1]).toMatchObject({
      word: "How are you?",
      charStart: 13,
      charEnd: 25,
    });
  });

  it("spreads duration proportional to UNEQUAL sentence lengths", () => {
    // "Hi." = 3 chars, "Hello there world." = 18 chars, total 21 -> at
    // duration 21 the first span gets exactly 3s (3/21*21), the rest to the end.
    const t = buildSentenceFallbackTimings("Hi. Hello there world.", 21);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ word: "Hi.", charStart: 0, charEnd: 3 });
    expect(t[0].endTime).toBeCloseTo(3, 9);
    expect(t[1]).toMatchObject({
      word: "Hello there world.",
      charStart: 4,
      charEnd: 22,
    });
    expect(t[1].startTime).toBeCloseTo(3, 9);
    expect(t[1].endTime).toBe(21);
  });

  it("produces monotonic, gapless spans (each end == next start)", () => {
    const t = buildSentenceFallbackTimings("One. Two. Three.", 9);
    for (let i = 1; i < t.length; i++) {
      expect(t[i].startTime).toBeCloseTo(t[i - 1].endTime, 9);
      expect(t[i].endTime).toBeGreaterThan(t[i].startTime);
    }
    expect(t[t.length - 1].endTime).toBe(9);
  });

  it("estimates duration from word count (~150 wpm) when none is given", () => {
    // 5 words, no terminal punctuation -> single sentence.
    const t = buildSentenceFallbackTimings("one two three four five", 0);
    expect(t).toHaveLength(1);
    expect(t[0].startTime).toBe(0);
    expect(t[0].endTime).toBeCloseTo((5 / 150) * 60, 9); // = 2.0s
    expect(t[0]).toMatchObject({ charStart: 0, charEnd: 23 });
  });

  it("treats a non-positive explicit duration as 'estimate'", () => {
    const t = buildSentenceFallbackTimings("a b c", -1);
    expect(t[0].endTime).toBeCloseTo((3 / 150) * 60, 9);
  });
});
