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
