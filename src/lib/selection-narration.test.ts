import { describe, expect, it } from "vitest";
import {
  isEffectiveWholePageSelection,
  pageSelectionBounds,
  selectionToPageEnd,
} from "./selection-narration";
import { annotatePdfTextLayer } from "./pdf-text";

function selectRange(
  startNode: Text,
  start: number,
  endNode: Text,
  end: number,
): Selection {
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  const range = document.createRange();
  range.setStart(startNode, start);
  range.setEnd(endNode, end);
  selection.addRange(range);
  return selection;
}

function selectWord(textNode: Text, start: number, end: number): Selection {
  return selectRange(textNode, start, textNode, end);
}

describe("selectionToPageEnd", () => {
  it("starts at the selected word and includes the rest of the PDF text layer", () => {
    const layer = document.createElement("div");
    layer.innerHTML =
      "<span>Alpha </span><span>Beta gamma</span><br><span>Delta</span>";
    annotatePdfTextLayer(layer, [
      { str: "Alpha " },
      { str: "Beta gamma" },
      { str: "Delta" },
    ]);
    document.body.append(layer);
    const beta = layer.querySelectorAll("span")[1].firstChild as Text;

    expect(selectionToPageEnd(selectWord(beta, 0, 4), layer)).toEqual({
      text: "Beta gamma Delta",
      baseOffset: 6,
    });
  });

  it("keeps a legitimate multi-line excerpt eligible for Read from here", () => {
    const layer = document.createElement("div");
    layer.innerHTML =
      "<span>Alpha</span><br><span>Beta gamma</span><br><span>Delta omega</span>";
    annotatePdfTextLayer(layer, [
      { str: "Alpha", hasEOL: true },
      { str: "Beta gamma", hasEOL: true },
      { str: "Delta omega" },
    ]);
    document.body.append(layer);
    const spans = layer.querySelectorAll("span");
    const beta = spans[1].firstChild as Text;
    const delta = spans[2].firstChild as Text;
    const selection = selectRange(beta, 0, delta, 5);

    expect(isEffectiveWholePageSelection(selection, layer)).toBe(false);
    expect(selectionToPageEnd(selection, layer)).toEqual({
      text: "Beta gamma Delta omega",
      baseOffset: 6,
    });
  });

  it("uses annotated normalized offsets for PDF.js whitespace runs", () => {
    const layer = document.createElement("div");
    layer.innerHTML = "<span>  Alpha  </span><span>Beta   gamma</span>";
    annotatePdfTextLayer(layer, [
      { str: "  Alpha  " },
      { str: "Beta   gamma" },
    ]);
    document.body.append(layer);
    const beta = layer.querySelectorAll("span")[1].firstChild as Text;

    expect(selectionToPageEnd(selectWord(beta, 0, 4), layer)).toEqual({
      text: "Beta gamma",
      baseOffset: 6,
    });
  });

  it("rejects an unannotated layer instead of returning drifting offsets", () => {
    const layer = document.createElement("div");
    layer.innerHTML = "<span>Alpha   </span><span>Beta gamma</span>";
    document.body.append(layer);
    const beta = layer.querySelectorAll("span")[1].firstChild as Text;

    expect(selectionToPageEnd(selectWord(beta, 0, 4), layer)).toBeNull();
  });

  it("rejects collapsed and out-of-page selections", () => {
    const layer = document.createElement("div");
    layer.innerHTML = "<span>Page text</span>";
    annotatePdfTextLayer(layer, [{ str: "Page text" }]);
    const outside = document.createTextNode("Outside");
    document.body.append(layer, outside);
    const inside = layer.querySelector("span")!.firstChild as Text;

    expect(selectionToPageEnd(selectWord(outside, 0, 3), layer)).toBeNull();
    expect(
      selectionToPageEnd(selectRange(inside, 0, outside, 3), layer),
    ).toBeNull();
    const selection = window.getSelection()!;
    selection.collapse(inside, 0);
    expect(selectionToPageEnd(selection, layer)).toBeNull();
  });

  it("rejects only edge-anchored effective whole-page selections", () => {
    const layer = document.createElement("div");
    layer.innerHTML =
      "<span>Alpha paragraph</span><span>Middle paragraph</span><span>Omega paragraph</span>";
    annotatePdfTextLayer(layer, [
      { str: "Alpha paragraph" },
      { str: "Middle paragraph" },
      { str: "Omega paragraph" },
    ]);
    document.body.append(layer);
    const spans = layer.querySelectorAll("span");
    const first = spans[0].firstChild as Text;
    const middle = spans[1].firstChild as Text;
    const last = spans[2].firstChild as Text;
    const whole = selectRange(first, 0, last, last.length);

    expect(pageSelectionBounds(whole, layer)).toEqual({
      start: 0,
      end: 48,
      pageLength: 48,
    });
    expect(isEffectiveWholePageSelection(whole, layer)).toBe(true);
    expect(
      isEffectiveWholePageSelection(
        selectRange(middle, 0, last, last.length),
        layer,
      ),
    ).toBe(false);
  });
});
