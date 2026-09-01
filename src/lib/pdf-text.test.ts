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
