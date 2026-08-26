import { normalizedBoundaryMap } from "./pdf-text";

/**
 * Return the selected word and everything after it on the current PDF page.
 *
 * The browser Range is the authority here: PDF.js already positioned and
 * ordered the selectable text layer, so duplicating its item-spacing heuristic
 * would create a second, drifting text model.
 */
export interface NarrationTail {
  text: string;
  baseOffset: number;
}

export function selectionToPageEnd(
  selection: Selection,
  textLayer: HTMLElement,
): NarrationTail | null {
  if (selection.isCollapsed || selection.rangeCount === 0) return null;

  const selectedRange = selection.getRangeAt(0);
  if (!textLayer.contains(selectedRange.startContainer)) return null;

  const startNode = selectedRange.startContainer;
  if (startNode.nodeType === Node.TEXT_NODE) {
    const annotatedSpan = (
      startNode.parentElement as HTMLElement | null
    )?.closest<HTMLElement>("span[data-tts-start]");
    if (annotatedSpan) {
      const spans = Array.from(
        textLayer.querySelectorAll<HTMLElement>("span[data-tts-start]"),
      );
      const spanIndex = spans.indexOf(annotatedSpan);
      const rawBoundaries = normalizedBoundaryMap(startNode.textContent ?? "");
      let localOffset = 0;
      while (
        localOffset < rawBoundaries.length &&
        rawBoundaries[localOffset] < selectedRange.startOffset
      ) {
        localOffset++;
      }
      const segmentStart = Number(annotatedSpan.dataset.ttsStart);
      const parts = [
        (annotatedSpan.dataset.ttsText ?? "").slice(localOffset),
        ...spans.slice(spanIndex + 1).map((span) => span.dataset.ttsText ?? ""),
      ];
      const text = parts.filter(Boolean).join(" ").trim();
      return text ? { text, baseOffset: segmentStart + localOffset } : null;
    }
  }

  // Fail closed rather than return offsets from a second, raw DOM coordinate
  // system. Production PDF.js layers are annotated immediately after render.
  return null;
}
