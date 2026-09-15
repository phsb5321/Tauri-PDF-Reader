import { describe, expect, it } from "vitest";
import type { BuiltPdfText } from "./pdf-text";
import {
  nonOverlappingParagraphActionPositions,
  paragraphActionPosition,
  pdfParagraphActions,
} from "./pdf-paragraph-actions";

function source(
  text: string,
  boundaries: BuiltPdfText["boundaries"],
): BuiltPdfText {
  return { text, boundaries, segments: [] };
}

describe("paragraph action screen-space layout", () => {
  it("uses the first line rect and stays wholly before its first glyph", () => {
    const position = paragraphActionPosition(
      [
        { left: 200, top: 100, width: 300, height: 20 },
        { left: 150, top: 124, width: 350, height: 20 },
      ],
      { left: 100, top: 50 },
    );

    expect(position).toEqual({ x: 47, y: 60 });
    if (!position) throw new Error("paragraph action was not positioned");
    expect(position.x + 45).toBeLessThanOrEqual(200 - 100 - 8);
  });

  it.each([
    [17, 8],
    [52, 13],
    [96, 16],
  ])("centres a %spx first line with a %spx gutter", (lineHeight, gap) => {
    const position = paragraphActionPosition(
      [{ left: 220, top: 80, width: 300, height: lineHeight }],
      { left: 100, top: 40 },
    );

    expect(position?.y).toBe(40 + lineHeight / 2);
    expect(position?.x).toBe(120 - gap - 45);
  });

  it("fails closed when a 45px target would cover text or leave the viewer gutter", () => {
    expect(
      paragraphActionPosition(
        [{ left: 110, top: 80, width: 300, height: 20 }],
        { left: 100, top: 40 },
      ),
    ).toBeNull();
    expect(paragraphActionPosition([], { left: 100, top: 40 })).toBeNull();
  });

  it("uses the UI-scaled target and viewer gutter supplied by the renderer", () => {
    const position = paragraphActionPosition(
      [{ left: 220, top: 80, width: 300, height: 40 }],
      { left: 100, top: 40 },
      { targetSize: 55, viewerGutter: 50 },
    );

    expect(position).toEqual({ x: 55, y: 60 });
  });

  it("keeps only the later body action in a dense overlapping cluster regardless of source order", () => {
    expect(
      nonOverlappingParagraphActionPositions(
        [
          { id: "first", x: 0, y: 20 },
          { id: "safe", x: 0, y: 70 },
          { id: "overlap", x: 0, y: 40 },
        ],
        45,
      ).map((action) => action.id),
    ).toEqual(["overlap"]);
  });
});

describe("PDF paragraph actions", () => {
  it("retains structural paragraph starts and page-tail narration offsets", () => {
    const text = "Book heading First paragraph. Second paragraph.";
    const first = text.indexOf("First");
    const second = text.indexOf("Second");
    const actions = pdfParagraphActions(
      source(text, [
        { offset: first - 1, kind: "section" },
        { offset: second - 1, kind: "paragraph" },
      ]),
    );

    expect(
      actions.map(({ sourceStart, sourceEnd, previewText, narrationText }) => ({
        sourceStart,
        sourceEnd,
        previewText,
        narrationText,
      })),
    ).toEqual([
      {
        sourceStart: 0,
        sourceEnd: first - 1,
        previewText: "Book heading",
        narrationText: text,
      },
      {
        sourceStart: first,
        sourceEnd: second - 1,
        previewText: "First paragraph.",
        narrationText: text.slice(first),
      },
      {
        sourceStart: second,
        sourceEnd: text.length,
        previewText: "Second paragraph.",
        narrationText: text.slice(second),
      },
    ]);
  });

  it("fails closed without structural evidence and skips tiny artifacts", () => {
    expect(pdfParagraphActions(source("One visual line only.", []))).toEqual(
      [],
    );
    expect(
      pdfParagraphActions(
        source("1 A useful paragraph.", [{ offset: 1, kind: "paragraph" }]),
      ).map((action) => action.previewText),
    ).toEqual(["A useful paragraph."]);
  });
});
