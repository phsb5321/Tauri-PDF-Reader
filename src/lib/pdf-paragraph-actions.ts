import type { BuiltPdfText } from "./pdf-text";

export interface PdfParagraphAction {
  index: number;
  sourceStart: number;
  sourceEnd: number;
  previewText: string;
  narrationText: string;
}

export interface ParagraphClientRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ParagraphActionPosition {
  x: number;
  y: number;
}

export const PARAGRAPH_ACTION_TARGET_PX = 45;

export interface ParagraphActionMetrics {
  targetSize: number;
  viewerGutter: number;
}

/**
 * Place one screen-space action before the paragraph's first rendered line.
 * It fails closed when the 45 px target (a measured ≥44 px floor in WebKit)
 * would leave both the PDF margin and
 * the viewer gutter, rather than covering selectable text.
 */
export function paragraphActionPosition(
  rects: readonly ParagraphClientRect[],
  container: Pick<ParagraphClientRect, "left" | "top">,
  metrics: ParagraphActionMetrics = {
    targetSize: PARAGRAPH_ACTION_TARGET_PX,
    viewerGutter: 40,
  },
): ParagraphActionPosition | null {
  const first = rects.find((rect) => rect.width > 0 && rect.height > 0);
  if (!first) return null;

  const gap = Math.max(8, Math.min(16, first.height * 0.25));
  const x = first.left - container.left - gap - metrics.targetSize;
  if (x < -metrics.viewerGutter) return null;

  return {
    x,
    y: first.top - container.top + first.height / 2,
  };
}

/** Keep one action per dense vertical cluster; the body/later action wins. */
export function nonOverlappingParagraphActionPositions<
  T extends ParagraphActionPosition,
>(actions: readonly T[], targetSize: number): T[] {
  const kept: T[] = [];
  // ponytail: one rendered page has O(10²) actions; use an interval tree only
  // if continuous multi-page rendering makes this quadratic scan measurable.
  for (const action of actions) {
    const overlaps = kept.flatMap((candidate, index) =>
      Math.abs(action.y - candidate.y) < targetSize ? [index] : [],
    );
    if (overlaps.length === 0) {
      kept.push(action);
      continue;
    }

    const insertionIndex = overlaps[0];
    for (const index of overlaps.reverse()) kept.splice(index, 1);
    kept.splice(insertionIndex, 0, action);
  }
  return kept;
}

function trimRange(text: string, start: number, end: number) {
  while (start < end && /\s/u.test(text[start])) start += 1;
  while (end > start && /\s/u.test(text[end - 1])) end -= 1;
  return { start, end };
}

/**
 * Build conservative paragraph actions from structural PDF boundaries.
 * A page with no paragraph/section evidence exposes no margin action rather
 * than pretending each visual line is a paragraph or offering the whole page.
 */
export function pdfParagraphActions(
  source: BuiltPdfText,
): PdfParagraphAction[] {
  const breaks = source.boundaries
    .filter(
      (boundary) =>
        boundary.kind === "paragraph" || boundary.kind === "section",
    )
    .map((boundary) => boundary.offset)
    .filter((offset) => offset > 0 && offset < source.text.length)
    .filter((offset, index, all) => all.indexOf(offset) === index)
    .sort((left, right) => left - right);
  if (breaks.length === 0) return [];

  const starts = [0, ...breaks.map((offset) => offset + 1)];
  const ends = [...breaks, source.text.length];
  const actions: PdfParagraphAction[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const range = trimRange(source.text, starts[index], ends[index]);
    const previewText = source.text.slice(range.start, range.end);
    if (previewText.length < 8) continue;
    actions.push({
      index: actions.length,
      sourceStart: range.start,
      sourceEnd: range.end,
      previewText,
      narrationText: source.text.slice(range.start),
    });
  }
  return actions;
}
