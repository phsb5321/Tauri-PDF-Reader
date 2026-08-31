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

export interface PageSelectionBounds {
  start: number;
  end: number;
  pageLength: number;
}

function normalizedLayerPosition(
  textLayer: HTMLElement,
  container: Node,
  rawOffset: number,
): number | null {
  if (!textLayer.contains(container) || container.nodeType !== Node.TEXT_NODE) {
    return null;
  }
  const span = container.parentElement?.closest<HTMLElement>(
    "span[data-tts-start]",
  );
  if (!span || !textLayer.contains(span)) return null;
  const boundaries = normalizedBoundaryMap(container.textContent ?? "");
  let normalizedOffset = 0;
  while (
    normalizedOffset < boundaries.length &&
    boundaries[normalizedOffset] < rawOffset
  ) {
    normalizedOffset += 1;
  }
  if (normalizedOffset >= boundaries.length) return null;
  return Number(span.dataset.ttsStart) + normalizedOffset;
}

export function pageSelectionBounds(
  selection: Selection,
  textLayer: HTMLElement,
): PageSelectionBounds | null {
  if (selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const start = normalizedLayerPosition(
    textLayer,
    range.startContainer,
    range.startOffset,
  );
  const end = normalizedLayerPosition(
    textLayer,
    range.endContainer,
    range.endOffset,
  );
  const spans = Array.from(
    textLayer.querySelectorAll<HTMLElement>("span[data-tts-start]"),
  );
  const last = spans[spans.length - 1];
  const pageLength = last
    ? Number(last.dataset.ttsStart) + (last.dataset.ttsText?.length ?? 0)
    : 0;
  if (start === null || end === null || end <= start || end > pageLength) {
    return null;
  }
  return { start, end, pageLength };
}

export function isEffectiveWholePageBounds(
  bounds: PageSelectionBounds,
): boolean {
  if (
    bounds.pageLength <= 0 ||
    bounds.start < 0 ||
    bounds.end <= bounds.start ||
    bounds.end > bounds.pageLength
  ) {
    return false;
  }
  const coverage = (bounds.end - bounds.start) / bounds.pageLength;
  return (
    coverage >= 0.95 &&
    bounds.start / bounds.pageLength <= 0.05 &&
    (bounds.pageLength - bounds.end) / bounds.pageLength <= 0.05
  );
}

export function isEffectiveWholePageSelection(
  selection: Selection,
  textLayer: HTMLElement,
): boolean {
  const bounds = pageSelectionBounds(selection, textLayer);
  return bounds ? isEffectiveWholePageBounds(bounds) : false;
}

export function selectionToPageEnd(
  selection: Selection,
  textLayer: HTMLElement,
): NarrationTail | null {
  if (selection.isCollapsed || selection.rangeCount === 0) return null;

  const bounds = pageSelectionBounds(selection, textLayer);
  if (!bounds) return null;

  const selectedRange = selection.getRangeAt(0);
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
      const parts = [
        (annotatedSpan.dataset.ttsText ?? "").slice(localOffset),
        ...spans.slice(spanIndex + 1).map((span) => span.dataset.ttsText ?? ""),
      ];
      const text = parts.filter(Boolean).join(" ").trim();
      return text ? { text, baseOffset: bounds.start } : null;
    }
  }

  // Fail closed rather than return offsets from a second, raw DOM coordinate
  // system. Production PDF.js layers are annotated immediately after render.
  return null;
}
