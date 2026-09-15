import { describe, expect, it } from "vitest";
import { selectionToPageEnd } from "./selection-narration";
import { annotatePdfTextLayer } from "./pdf-text";

function selectWord(textNode: Text, start: number, end: number): Selection {
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  selection.addRange(range);
  return selection;
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
    layer.textContent = "Page text";
    const outside = document.createTextNode("Outside");
    document.body.append(layer, outside);

    expect(selectionToPageEnd(selectWord(outside, 0, 3), layer)).toBeNull();
    const selection = window.getSelection()!;
    selection.collapse(layer.firstChild, 0);
    expect(selectionToPageEnd(selection, layer)).toBeNull();
  });
});
