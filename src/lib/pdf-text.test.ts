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
        { text: "Alpha", start: 0 },
        { text: "Beta gamma", start: 6 },
      ],
    });
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
});
