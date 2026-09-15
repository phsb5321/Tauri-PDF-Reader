import { describe, expect, it } from "vitest";
import { segmentSpeechWithOffsets } from "./tts-tracking";

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

describe("segmentSpeechWithOffsets", () => {
  it("keeps short sentences and original UTF-16 offsets", () => {
    const text = "  First sentence.  Second sentence!";
    expect(segmentSpeechWithOffsets(text, 200)).toEqual([
      { text: "First sentence.", charStart: 2, charEnd: 17 },
      { text: "Second sentence!", charStart: 19, charEnd: 35 },
    ]);
  });

  it("splits an oversized sentence within the UTF-8 bound without offset drift", () => {
    const text = `${"alpha ".repeat(45)}omega.`;
    const spans = segmentSpeechWithOffsets(text, 200);

    expect(spans.length).toBeGreaterThan(1);
    expect(spans.every((span) => utf8Bytes(span.text) <= 200)).toBe(true);
    expect(
      spans.every(
        (span) => text.slice(span.charStart, span.charEnd) === span.text,
      ),
    ).toBe(true);
    expect(spans.map((span) => span.text).join(" ")).toBe(text);
  });

  it("never splits surrogate pairs, combining marks, or ZWJ emoji", () => {
    const text = `${"e\u0301 😀 👩‍💻 ".repeat(30)}done.`;
    const spans = segmentSpeechWithOffsets(text, 64);

    expect(spans.length).toBeGreaterThan(1);
    expect(spans.every((span) => utf8Bytes(span.text) <= 64)).toBe(true);
    for (const span of spans) {
      expect(text.slice(span.charStart, span.charEnd)).toBe(span.text);
      expect(span.text).not.toMatch(/^\p{Mark}/u);
      expect(span.text).not.toMatch(/^\u200D|\u200D$/u);
      const firstUnit = span.text.charCodeAt(0);
      const lastUnit = span.text.charCodeAt(span.text.length - 1);
      expect(firstUnit >= 0xdc00 && firstUnit <= 0xdfff).toBe(false);
      expect(lastUnit >= 0xd800 && lastUnit <= 0xdbff).toBe(false);
    }
  });

  it("hard-splits a long token but fails closed when one grapheme exceeds the bound", () => {
    const longToken = `${"x".repeat(450)}.`;
    const spans = segmentSpeechWithOffsets(longToken, 200);
    expect(spans.map((span) => span.text).join("")).toBe(longToken);
    expect(spans.every((span) => utf8Bytes(span.text) <= 200)).toBe(true);
    expect(segmentSpeechWithOffsets("😀", 3)).toEqual([]);
  });
});
