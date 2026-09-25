import { describe, expect, it } from "vitest";
import {
  annotatePdfTextLayer,
  buildPdfText,
  normalizedBoundaryMap,
  rangeFromAnnotatedPdfText,
} from "./pdf-text";

describe("shared PDF text model", () => {
  it("builds one-space segments and records their page offsets", () => {
    expect(
      buildPdfText([{ str: "  Alpha  " }, { str: "Beta   gamma" }]),
    ).toEqual({
      text: "Alpha Beta gamma",
      segments: [
        {
          text: "Alpha",
          start: 0,
          end: 5,
          hasEol: false,
          x: null,
          y: null,
          width: null,
          height: null,
          fontName: null,
        },
        {
          text: "Beta gamma",
          start: 6,
          end: 16,
          hasEol: false,
          x: null,
          y: null,
          width: null,
          height: null,
          fontName: null,
        },
      ],
      boundaries: [],
    });
  });

  it("retains line evidence without changing source offsets", () => {
    const built = buildPdfText([
      {
        str: "first block",
        hasEOL: true,
        transform: [1, 0, 0, 1, 72, 700],
        width: 80,
        height: 10,
        fontName: "Body",
      },
      {
        str: "Next block",
        transform: [1, 0, 0, 1, 72, 680],
        width: 70,
        height: 10,
        fontName: "Body",
      },
    ]);

    expect(built.text).toBe("first block Next block");
    expect(built.segments.map(({ start, end }) => ({ start, end }))).toEqual([
      { start: 0, end: 11 },
      { start: 12, end: 22 },
    ]);
    expect(built.boundaries).toEqual([{ offset: 11, kind: "paragraph" }]);
  });

  it("recognizes the real heading geometry even when PDF.js omits hasEOL", () => {
    const built = buildPdfText([
      {
        str: "What This Book Is About",
        hasEOL: false,
        transform: [21.2475, 0, 0, 21.2475, 76.99, 700.5],
        width: 251.41,
        height: 21.2475,
        fontName: "Heading",
      },
      {
        str: "This book aims to fill a gap.",
        hasEOL: true,
        transform: [15, 0, 0, 15, 76.99, 673.5],
        width: 180,
        height: 15,
        fontName: "Body",
      },
    ]);

    expect(built.text).toBe(
      "What This Book Is About This book aims to fill a gap.",
    );
    expect(built.boundaries).toEqual([{ offset: 23, kind: "section" }]);
  });

  it("does not promote an ordinary PDF line ending to a paragraph", () => {
    const built = buildPdfText([
      {
        str: "wrapped line",
        hasEOL: true,
        transform: [1, 0, 0, 1, 72, 700],
        height: 10,
      },
      {
        str: "continues here",
        transform: [1, 0, 0, 1, 72, 690],
        height: 10,
      },
    ]);
    expect(built.boundaries).toEqual([{ offset: 12, kind: "line" }]);
  });

  it("maps normalized boundaries back through raw whitespace runs", () => {
    expect(normalizedBoundaryMap("  a   b ")).toEqual([2, 3, 6, 7]);
  });

  it("resolves exactly one word through annotated PDF.js spans", () => {
    const layer = document.createElement("div");
    layer.innerHTML = "<span>  Alpha  </span><span>Beta   gamma</span>";
    annotatePdfTextLayer(layer, [
      { str: "  Alpha  " },
      { str: "Beta   gamma" },
    ]);

    const range = rangeFromAnnotatedPdfText(layer, 6, 10);
    expect(range?.toString()).toBe("Beta");
  });

  it("matches the normalized page when PDF.js combines or splits item spans", () => {
    const layer = document.createElement("div");
    layer.innerHTML = "<span>Alpha Beta</span><span>gamma</span>";
    annotatePdfTextLayer(layer, [{ str: "Alpha" }, { str: "Beta\ngamma" }]);

    const spans = layer.querySelectorAll<HTMLElement>("span");
    expect(spans[0].dataset).toMatchObject({
      ttsStart: "0",
      ttsText: "Alpha Beta",
    });
    expect(spans[1].dataset).toMatchObject({
      ttsStart: "11",
      ttsText: "gamma",
    });
    expect(rangeFromAnnotatedPdfText(layer, 6, 10)?.toString()).toBe("Beta");
    expect(rangeFromAnnotatedPdfText(layer, 11, 16)?.toString()).toBe("gamma");
  });

  it("leaves a divergent span unannotated instead of assigning a drifting offset", () => {
    const layer = document.createElement("div");
    layer.innerHTML = "<span>Alpha</span><span>wrong text</span>";
    annotatePdfTextLayer(layer, [{ str: "Alpha" }, { str: "Beta" }]);

    const spans = layer.querySelectorAll<HTMLElement>("span");
    expect(spans[0].dataset.ttsStart).toBe("0");
    expect(spans[1].dataset.ttsStart).toBeUndefined();
  });
});

describe("soft hyphenation at segment joins (spec 293)", () => {
  const ranges = (built: {
    segments: Array<{ text: string; start: number; end: number }>;
  }) => built.segments.map(({ text, start, end }) => ({ text, start, end }));

  it("re-joins hyphen-broken words at a line join (dese- + jo -> desejo)", () => {
    const built = buildPdfText([
      { str: "dese-", hasEOL: true },
      { str: "jo continua" },
    ]);
    expect(built.text).toBe("desejo continua");
    expect(ranges(built)).toEqual([
      { text: "dese", start: 0, end: 4 },
      { text: "jo continua", start: 4, end: 15 },
    ]);
    expect(built.boundaries).toEqual([]);
  });

  it("keeps segments slice-consistent with the normalized text", () => {
    const built = buildPdfText([
      { str: "antessala", hasEOL: true },
      { str: "prepara- se", hasEOL: true },
      { str: "bem" },
    ]);
    for (const segment of built.segments) {
      expect(built.text.slice(segment.start, segment.end)).toBe(segment.text);
    }
  });

  it("never joins an uppercase continuation (proper noun guard)", () => {
    const built = buildPdfText([
      { str: "dese-", hasEOL: true },
      { str: "Jo frio" },
    ]);
    expect(built.text).toBe("dese- Jo frio");
    expect(built.boundaries).toEqual([{ offset: 5, kind: "line" }]);
    expect(ranges(built)).toEqual([
      { text: "dese-", start: 0, end: 5 },
      { text: "Jo frio", start: 6, end: 13 },
    ]);
  });

  it("refuses the join across a paragraph gap", () => {
    const built = buildPdfText([
      {
        str: "dese-",
        hasEOL: true,
        transform: [1, 0, 0, 1, 72, 700],
        width: 40,
        height: 10,
        fontName: "Body",
      },
      {
        str: "jo.",
        transform: [1, 0, 0, 1, 72, 680],
        width: 20,
        height: 10,
        fontName: "Body",
      },
    ]);
    expect(built.text).toBe("dese- jo.");
    expect(built.boundaries).toEqual([{ offset: 5, kind: "paragraph" }]);
  });

  it("documents the compound edge: well- + known collapses (dictionary-free rule)", () => {
    const built = buildPdfText([
      { str: "well-", hasEOL: true },
      { str: "known fact" },
    ]);
    expect(built.text).toBe("wellknown fact");
  });

  it("annotates soft-joined spans through the stripped key (cross-span range)", () => {
    const layer = document.createElement("div");
    layer.innerHTML = "<span>dese-</span><span>jo</span>";
    annotatePdfTextLayer(layer, [
      { str: "dese-", hasEOL: true },
      { str: "jo" },
    ]);

    const spans = layer.querySelectorAll<HTMLElement>("span");
    expect(spans[0].dataset).toMatchObject({ ttsStart: "0", ttsText: "dese" });
    expect(spans[1].dataset).toMatchObject({ ttsStart: "4", ttsText: "jo" });
    const range = rangeFromAnnotatedPdfText(layer, 0, 6);
    // The highlight covers both printed word parts across the line join;
    // the DOM text nodes keep the printed hyphen, while the normalized TTS
    // string says "desejo".
    expect(range?.startContainer.parentElement).toBe(spans[0]);
    expect(range?.endContainer.parentElement).toBe(spans[1]);
    expect(range?.toString()).toBe("dese-jo");
  });

  it("keeps large de-hyphenated pages fast (measured pathology guard, not a benchmark)", () => {
    const items: Array<{ str: string; hasEOL: boolean }> = [];
    for (let i = 0; i < 3000; i += 1) {
      items.push({ str: `word${i}-`, hasEOL: true }, { str: `cont${i} tail` });
    }
    const started = performance.now();
    const built = buildPdfText(items);
    const elapsedMs = performance.now() - started;
    expect(built.text.length).toBeGreaterThan(30000);
    expect(elapsedMs).toBeLessThan(500);
  });
});
