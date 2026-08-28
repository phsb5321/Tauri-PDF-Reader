import { describe, expect, it } from "vitest";
import {
  mapSpokenRangeToSource,
  planProsodyRuns,
  type AlignmentSegment,
} from "./prosody-plan";

const bytes = (text: string) => new TextEncoder().encode(text).length;

describe("source-aligned prosody plan", () => {
  it("keeps ordinary source and spoken text identical", () => {
    const text = "First sentence. Second sentence.";
    const runs = planProsodyRuns({ text }, 200);

    expect(runs.map((run) => run.spokenText)).toEqual([
      "First sentence.",
      "Second sentence.",
    ]);
    expect(runs.map((run) => run.displayText)).toEqual([
      "First sentence.",
      "Second sentence.",
    ]);
    expect(runs.every((run) => run.boundaryAfter === "sentence")).toBe(true);
  });

  it("repairs the measured serving/Since defect only in spoken text", () => {
    const text =
      "storage, ingestion, transformation, and serving Since the dawn of data";
    const runs = planProsodyRuns({ text, language: "en" }, 200);

    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({
      displayText: "storage, ingestion, transformation, and serving",
      spokenText: "storage, ingestion, transformation, and serving.",
      sourceStart: 0,
      sourceEnd: 47,
      boundaryAfter: "sentence",
    });
    expect(runs[1]).toMatchObject({
      displayText: "Since the dawn of data",
      spokenText: "Since the dawn of data",
      sourceStart: 48,
      sourceEnd: text.length,
      boundaryAfter: "clause",
    });
    expect(runs[0].alignment.at(-1)).toEqual({
      spokenStart: 47,
      spokenEnd: 48,
      sourceStart: null,
      sourceEnd: null,
      kind: "insert",
    });

    const servingStart = runs[0].spokenText.indexOf("serving");
    expect(
      mapSpokenRangeToSource(
        runs[0].alignment,
        servingStart,
        runs[0].spokenText.length,
      ),
    ).toEqual({ start: servingStart, end: 47 });
    expect(text).not.toContain("serving.");
  });

  it("repairs the pinned PT-BR starter without broad capital rewriting", () => {
    const repaired = planProsodyRuns(
      { text: "os dados chegaram Portanto iniciamos", language: "pt-BR" },
      200,
    );
    expect(repaired.map((run) => run.spokenText)).toEqual([
      "os dados chegaram.",
      "Portanto iniciamos",
    ]);

    const untouched = planProsodyRuns(
      { text: "The Since Project uses Ada Lovelace", language: "en" },
      200,
    );
    expect(untouched).toHaveLength(1);
    expect(untouched[0].spokenText).toBe("The Since Project uses Ada Lovelace");
  });

  it("uses structural paragraph evidence but ignores a plain line ending", () => {
    const text = "first block Next block";
    const line = planProsodyRuns(
      { text, boundaries: [{ offset: 11, kind: "line" }] },
      200,
    );
    expect(line).toHaveLength(1);
    expect(line[0].spokenText).toBe(text);

    const paragraph = planProsodyRuns(
      { text, boundaries: [{ offset: 11, kind: "paragraph" }] },
      200,
    );
    expect(paragraph.map((run) => run.spokenText)).toEqual([
      "first block.",
      "Next block",
    ]);
    expect(paragraph[0].boundaryAfter).toBe("paragraph");

    const continuation = planProsodyRuns(
      {
        text: "first block, Next block",
        boundaries: [{ offset: 12, kind: "paragraph" }],
      },
      200,
    );
    expect(continuation).toHaveLength(1);
    expect(continuation[0].spokenText).toBe("first block, Next block");
  });

  it("closes a typographic heading and groups later paragraph sentences for continuity", () => {
    const heading = "What This Book Is About";
    const paragraph =
      "This book aims to fill a gap. It connects the dots. Readers benefit.";
    const finalParagraph = "A new paragraph starts here.";
    const text = `${heading} ${paragraph} ${finalParagraph}`;
    const paragraphEnd = heading.length + 1 + paragraph.length;
    const runs = planProsodyRuns(
      {
        text,
        boundaries: [
          { offset: heading.length, kind: "section" },
          { offset: paragraphEnd, kind: "paragraph" },
        ],
      },
      8192,
    );

    expect(runs.map((run) => run.spokenText)).toEqual([
      "What This Book Is About.",
      paragraph,
      finalParagraph,
    ]);
    expect(runs[0]).toMatchObject({
      displayText: heading,
      boundaryAfter: "section",
    });
    expect(runs[1]).toMatchObject({
      displayText: paragraph,
      boundaryAfter: "paragraph",
    });
    expect(bytes(runs[1].spokenText)).toBeLessThanOrEqual(300);

    for (const match of runs[1].spokenText.matchAll(/\S+/gu)) {
      const mapped = mapSpokenRangeToSource(
        runs[1].alignment,
        match.index,
        match.index + match[0].length,
      );
      expect(mapped).not.toBeNull();
      expect(runs[1].displayText.slice(mapped?.start, mapped?.end)).toBe(
        match[0],
      );
    }
  });

  it("maps UTF-16 offsets after an astral character without drift", () => {
    const text = "😀 serving Since then";
    const runs = planProsodyRuns({ text }, 200);
    expect(runs[0].spokenText).toBe("😀 serving.");
    const start = runs[0].spokenText.indexOf("serving");
    const mapped = mapSpokenRangeToSource(
      runs[0].alignment,
      start,
      runs[0].spokenText.length,
    );
    expect(mapped).toEqual({ start, end: text.indexOf(" Since") });
    expect(runs[0].displayText.slice(mapped?.start, mapped?.end)).toBe(
      "serving",
    );
  });

  it("covers every source word exactly once after spoken insertions", () => {
    const text =
      "😀 storage, ingestion, transformation, and serving Since the dawn of data";
    const runs = planProsodyRuns({ text }, 200);
    const projected = runs.flatMap((run) =>
      [...run.spokenText.matchAll(/\S+/gu)].map((match) => {
        const range = mapSpokenRangeToSource(
          run.alignment,
          match.index,
          match.index + match[0].length,
        );
        expect(range).not.toBeNull();
        return run.displayText.slice(range?.start, range?.end);
      }),
    );
    expect(projected).toEqual(text.match(/\S+/gu));
  });

  it("retains the provider UTF-8 bound and fails closed on an oversized grapheme", () => {
    const text = `${"alpha ".repeat(40)}Since the end`;
    const runs = planProsodyRuns({ text }, 64);
    expect(runs.length).toBeGreaterThan(1);
    expect(runs.every((run) => bytes(run.spokenText) <= 64)).toBe(true);
    expect(planProsodyRuns({ text: "😀" }, 3)).toEqual([]);
  });
});

describe("spoken range projection", () => {
  it("returns null for insertion-only timing and expands replacement to its source token", () => {
    const alignment: AlignmentSegment[] = [
      {
        spokenStart: 0,
        spokenEnd: 6,
        sourceStart: 0,
        sourceEnd: 4,
        kind: "replace",
      },
      {
        spokenStart: 6,
        spokenEnd: 7,
        sourceStart: null,
        sourceEnd: null,
        kind: "insert",
      },
    ];
    expect(mapSpokenRangeToSource(alignment, 1, 5)).toEqual({
      start: 0,
      end: 4,
    });
    expect(mapSpokenRangeToSource(alignment, 6, 7)).toBeNull();
  });
});
