import { describe, expect, it } from "vitest";
import page19FootnoteItems from "../__tests__/fixtures/page-19-footnote-items.json";
import { buildPdfText } from "./pdf-text";
import {
  mapSpokenRangeToSource,
  planProsodyRuns,
  resolveProsodyLanguage,
  type AlignmentSegment,
} from "./prosody-plan";

const bytes = (text: string) => new TextEncoder().encode(text).length;

// Exact PDF.js body neighbors for the retained page-19 marker items. The PDF
// emits its markers at the end of extraction order, so attachment is geometric,
// not array adjacency.
const page19AttachedFootnoteItems = [
  {
    str: "AlexSoft",
    hasEOL: false,
    transform: [15, 0, 0, 15, 401.00392154775284, 576.0000063120002],
    width: 54.162598809631206,
    height: 15.00000033499996,
    fontName: "g_d0_f2",
  },
  {
    str: "processing is done with an ETL tool.",
    hasEOL: false,
    transform: [15, 0, 0, 15, 84.49219197899185, 492.75000445275043],
    width: 219.8730521604974,
    height: 15.00000033499996,
    fontName: "g_d0_f1",
  },
  {
    str: "—Jesse Anderson",
    hasEOL: false,
    transform: [15, 0, 0, 15, 347.26173284751076, 381.0000019570007],
    width: 107.90039340977512,
    height: 15.00000033499996,
    fontName: "g_d0_f2",
  },
  {
    str: "—Maxime Beauchemin",
    hasEOL: false,
    transform: [15, 0, 0, 15, 311.4492320476984, 239.999998808001],
    width: 143.70849965948938,
    height: 15.00000033499996,
    fontName: "g_d0_f2",
  },
  {
    str: "—Lewis Gavin",
    hasEOL: true,
    transform: [15, 0, 0, 15, 363.09376070109266, 170.99999726700116],
    width: 92.06543185612767,
    height: 15.00000033499996,
    fontName: "g_d0_f2",
  },
  ...page19FootnoteItems,
];

describe("source-aligned prosody plan", () => {
  it("resolves only explicit or voice-declared narration languages", () => {
    expect(resolveProsodyLanguage("auto", "John-en", null)).toBe("en");
    expect(resolveProsodyLanguage("auto", "F1-pt", null)).toBe("pt-BR");
    expect(resolveProsodyLanguage("auto", "opaque", { locale: "pt_BR" })).toBe(
      "pt-BR",
    );
    expect(resolveProsodyLanguage("auto", "opaque", null)).toBe("auto");
    expect(resolveProsodyLanguage("en", "Sofia-pt-BR", null)).toBe("en");
  });

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
    expect(runs[0].spokenText).toBe("😀 serving. Since then");
    const start = runs[0].spokenText.indexOf("serving");
    const mapped = mapSpokenRangeToSource(
      runs[0].alignment,
      start,
      runs[0].spokenText.indexOf(" Since"),
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

  it("applies a performance-profile ceiling below the provider maximum", () => {
    const text = `${"semantic context stays source aligned ".repeat(20)}Done.`;
    const responsive = planProsodyRuns({ text }, 8_192, 180);
    const balanced = planProsodyRuns({ text }, 8_192, 300);

    expect(responsive.length).toBeGreaterThan(balanced.length);
    expect(responsive.every((run) => bytes(run.spokenText) <= 180)).toBe(true);
    expect(balanced.every((run) => bytes(run.spokenText) <= 300)).toBe(true);
    expect(
      responsive
        .map((run) => run.displayText)
        .join(" ")
        .replace(/\s+/gu, " ")
        .trim(),
    ).toBe(text.replace(/\s+/gu, " ").trim());
  });

  it("silences real page-19 superscript markers without changing source text", () => {
    const built = buildPdfText(page19AttachedFootnoteItems);
    const runs = planProsodyRuns(
      {
        text: built.text,
        boundaries: built.boundaries,
        segments: built.segments,
      },
      300,
    );

    expect(built.text).toMatch(/data engineering \. 1 2 3 4 5$/u);
    expect(runs.map((run) => run.spokenText).join(" ")).not.toMatch(
      /(?:^|\s)[1-5](?:[.\s]|$)/u,
    );
    expect(runs.every((run) => bytes(run.spokenText) >= 12)).toBe(true);
    expect(runs.at(-1)?.sourceEnd).toBe(built.text.indexOf(" 1 2 3 4 5"));
  });

  it("never re-speaks a deleted marker across a merged run boundary", () => {
    const built = buildPdfText([
      {
        str: "Opening sentence.",
        height: 15,
        width: 112,
        transform: [15, 0, 0, 15, 72, 520],
        fontName: "body",
      },
      {
        str: "Second sentence here.",
        height: 15,
        width: 142,
        transform: [15, 0, 0, 15, 72, 500],
        fontName: "body",
      },
      {
        str: "1",
        height: 10,
        width: 5,
        transform: [10, 0, 0, 10, 216, 504],
        fontName: "marker",
      },
      {
        str: "Third sentence here.",
        height: 15,
        width: 132,
        transform: [15, 0, 0, 15, 224, 500],
        fontName: "body",
      },
      {
        str: "Fourth.",
        height: 15,
        width: 45,
        transform: [15, 0, 0, 15, 72, 480],
        fontName: "body",
      },
    ]);

    const runs = planProsodyRuns({ ...built, segments: built.segments }, 300);
    const spoken = runs.map((run) => run.spokenText).join(" ");
    expect(spoken).not.toMatch(/(?:^|\s)1(?:\s|$)/u);
    expect(spoken).toMatch(/Second sentence here\.\s+Third sentence here\./u);
    const merged = runs.find((run) => run.spokenText.includes("Third"));
    expect(merged).toBeDefined();
    const thirdStart = merged?.spokenText.indexOf("Third") ?? -1;
    const mapped = mapSpokenRangeToSource(
      merged?.alignment ?? [],
      thirdStart,
      thirdStart + "Third".length,
    );
    expect(merged?.displayText.slice(mapped?.start, mapped?.end)).toBe("Third");
  });

  it("never re-speaks a deleted marker while coalescing a micro-run", () => {
    const built = buildPdfText([
      {
        str: "Brief.",
        height: 15,
        width: 35,
        transform: [15, 0, 0, 15, 72, 500],
        fontName: "body",
      },
      {
        str: "1",
        height: 10,
        width: 5,
        transform: [10, 0, 0, 10, 109, 504],
        fontName: "marker",
      },
      {
        str: "Continuation is long enough.",
        height: 15,
        width: 176,
        transform: [15, 0, 0, 15, 117, 500],
        fontName: "body",
      },
    ]);
    const runs = planProsodyRuns({ ...built, segments: built.segments }, 300);

    expect(runs).toHaveLength(1);
    expect(runs[0].spokenText).not.toMatch(/\s1\s/u);
    expect(runs[0].displayText).toContain("Brief. 1 Continuation");
  });

  it("retains small numeric table cells that lack superscript style evidence", () => {
    const built = buildPdfText([
      {
        str: "Body context establishes the page type size.",
        height: 15,
        width: 280,
        transform: [15, 0, 0, 15, 72, 520],
        fontName: "body",
      },
      {
        str: "More body context keeps the median stable.",
        height: 15,
        width: 250,
        transform: [15, 0, 0, 15, 72, 500],
        fontName: "body",
      },
      {
        str: "A third body line prevents small captions redefining the median.",
        height: 15,
        width: 340,
        transform: [15, 0, 0, 15, 72, 480],
        fontName: "body",
      },
      {
        str: "Metric",
        height: 9,
        width: 31,
        transform: [9, 0, 0, 9, 72, 450],
        fontName: "table",
      },
      {
        str: "1",
        height: 9,
        width: 5,
        transform: [9, 0, 0, 9, 140, 450],
        fontName: "table",
      },
      {
        str: "2",
        height: 9,
        width: 5,
        transform: [9, 0, 0, 9, 180, 450],
        fontName: "table",
      },
    ]);

    const spoken = planProsodyRuns({ ...built, segments: built.segments }, 300)
      .map((run) => run.spokenText)
      .join(" ");
    expect(spoken).toMatch(/Metric 1 2/u);
  });

  it("retains an ordinary body-sized standalone number", () => {
    const built = buildPdfText([
      {
        str: "Chapter",
        height: 15,
        width: 52,
        transform: [15, 0, 0, 15, 72, 500],
        fontName: "body",
      },
      {
        str: "2",
        height: 15,
        width: 8,
        transform: [15, 0, 0, 15, 128, 500],
        fontName: "body",
      },
      {
        str: "begins here.",
        height: 15,
        width: 82,
        transform: [15, 0, 0, 15, 140, 500],
        fontName: "body",
      },
    ]);
    expect(
      planProsodyRuns({ ...built, segments: built.segments }, 300).map(
        (run) => run.spokenText,
      ),
    ).toEqual(["Chapter 2 begins here."]);
  });

  it("speaks normalized numbers while keeping the digits highlightable", () => {
    const text =
      "In early 2022, the search returned over 91,000 unique results.";
    const runs = planProsodyRuns({ text, language: "en" }, 300);

    expect(runs).toHaveLength(1);
    expect(runs[0].spokenText).toBe(
      "In early two thousand twenty-two, the search returned over ninety-one thousand unique results.",
    );
    expect(runs[0].displayText).toBe(text);

    const spoken = "two thousand twenty-two";
    const spokenStart = runs[0].spokenText.indexOf(spoken);
    expect(
      mapSpokenRangeToSource(
        runs[0].alignment,
        spokenStart,
        spokenStart + spoken.length,
      ),
    ).toEqual({ start: text.indexOf("2022"), end: text.indexOf("2022") + 4 });
  });

  it("leaves digits raw when number normalization is disabled", () => {
    const text =
      "In early 2022, the search returned over 91,000 unique results.";
    expect(
      planProsodyRuns(
        { text, language: "en", normalizeNumbers: false },
        300,
      ).map((run) => run.spokenText),
    ).toEqual([text]);
  });

  it("never speaks a superscript marker that geometry already silenced", () => {
    const built = buildPdfText(page19AttachedFootnoteItems);
    const runs = planProsodyRuns(
      { ...built, segments: built.segments, language: "en" },
      300,
    );

    expect(runs.map((run) => run.spokenText).join(" ")).not.toMatch(
      /\b(?:one|two|three|four|five)\b/u,
    );
  });

  it("keeps expanded number speech inside the provider byte bound", () => {
    const text = "The 2022 report listed 91,000 rows. ".repeat(8);
    const runs = planProsodyRuns({ text, language: "en" }, 120);

    expect(runs.length).toBeGreaterThan(1);
    expect(runs.every((run) => bytes(run.spokenText) <= 120)).toBe(true);
    expect(runs.map((run) => run.spokenText).join(" ")).toContain(
      "ninety-one thousand",
    );
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
