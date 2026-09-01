export type PdfTextBoundaryKind = "line" | "paragraph" | "section";

export interface PdfTextBoundary {
  /** UTF-16 offset in the unchanged normalized page text. */
  offset: number;
  kind: PdfTextBoundaryKind;
}

export interface PdfTextSegment {
  text: string;
  start: number;
  end: number;
  hasEol: boolean;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  fontName: string | null;
}

export interface BuiltPdfText {
  text: string;
  segments: PdfTextSegment[];
  boundaries: PdfTextBoundary[];
}

interface ParsedPdfItem {
  text: string;
  hasEol: boolean;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  fontName: string | null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseItem(item: unknown): ParsedPdfItem | null {
  if (!item || typeof item !== "object" || !("str" in item)) return null;
  const value = item as Record<string, unknown>;
  const raw = String(value.str);
  const text = raw.replace(/\s+/gu, " ").trim();
  if (!text) return null;
  const transform = Array.isArray(value.transform) ? value.transform : [];
  return {
    text,
    hasEol: value.hasEOL === true,
    x: finiteNumber(transform[4]),
    y: finiteNumber(transform[5]),
    width: finiteNumber(value.width),
    height: finiteNumber(value.height),
    fontName: typeof value.fontName === "string" ? value.fontName : null,
  };
}

function inferBoundary(
  previous: ParsedPdfItem,
  current: ParsedPdfItem,
): PdfTextBoundaryKind | null {
  if (
    previous.y === null ||
    current.y === null ||
    previous.height === null ||
    current.height === null
  ) {
    return previous.hasEol ? "line" : null;
  }

  const smallerHeight = Math.max(Math.min(previous.height, current.height), 1);
  const lineHeight = Math.max(previous.height, current.height, 1);
  const verticalGap = Math.abs(previous.y - current.y);
  const sizeRatio = lineHeight / smallerHeight;
  const styleChanged =
    previous.fontName !== null &&
    current.fontName !== null &&
    previous.fontName !== current.fontName;

  // Real PDFs often omit `hasEOL` on a heading even though the next body line
  // starts a new block. A strong size+font change and a body-relative baseline
  // gap are sufficient section evidence; requiring hasEOL flattened the real
  // “What This Book Is About” heading into its first paragraph.
  if (sizeRatio >= 1.25 && styleChanged && verticalGap >= smallerHeight * 1.5) {
    return "section";
  }
  if (!previous.hasEol) return null;
  if (verticalGap >= lineHeight * 1.45) return "paragraph";
  return "line";
}

/**
 * Build the one normalized page string used by TTS and highlight offsets while
 * retaining PDF.js structure evidence. Boundaries are metadata only: normalized
 * source text remains the same one-space model used by the rendered text layer.
 */
export function buildPdfText(items: readonly unknown[]): BuiltPdfText {
  const segments: PdfTextSegment[] = [];
  const boundaries: PdfTextBoundary[] = [];
  let text = "";
  let previous: ParsedPdfItem | null = null;
  for (const item of items) {
    const parsed = parseItem(item);
    if (!parsed) continue;
    if (text) {
      const kind = previous ? inferBoundary(previous, parsed) : null;
      if (kind) boundaries.push({ offset: text.length, kind });
      text += " ";
    }
    const start = text.length;
    text += parsed.text;
    segments.push({
      ...parsed,
      start,
      end: text.length,
    });
    previous = parsed;
  }
  return { text, segments, boundaries };
}

/** Annotate PDF.js spans with offsets in the same normalized page string. */
export function annotatePdfTextLayer(
  container: HTMLElement,
  items: readonly unknown[],
): void {
  const { text } = buildPdfText(items);
  const spans = Array.from(container.querySelectorAll<HTMLElement>("span"));
  let searchStart = 0;

  for (const span of spans) {
    const normalized = (span.textContent ?? "").replace(/\s+/gu, " ").trim();
    if (!normalized) continue;
    const start = text.indexOf(normalized, searchStart);
    if (start < 0) continue;
    span.dataset.ttsStart = String(start);
    span.dataset.ttsText = normalized;
    searchStart = start + normalized.length;
  }
}

/** Map normalized-string boundaries back to raw text-node boundaries. */
export function normalizedBoundaryMap(raw: string): number[] {
  const first = raw.search(/\S/u);
  if (first < 0) return [0];
  let last = raw.length;
  while (last > first && /\s/u.test(raw[last - 1])) last--;

  const boundaries = [first];
  let index = first;
  while (index < last) {
    if (/\s/u.test(raw[index])) {
      while (index < last && /\s/u.test(raw[index])) index++;
      boundaries.push(index);
    } else {
      index++;
      boundaries.push(index);
    }
  }
  return boundaries;
}

/** Resolve one normalized TTS range through annotated PDF.js spans. */
export function rangeFromAnnotatedPdfText(
  container: Element,
  charStart: number,
  charEnd: number,
): Range | null {
  const spans = Array.from(
    container.querySelectorAll<HTMLElement>("span[data-tts-start]"),
  );
  const startSpan = spans.find((span) => {
    const start = Number(span.dataset.ttsStart);
    const length = span.dataset.ttsText?.length ?? 0;
    return charStart >= start && charStart < start + length;
  });
  const endSpan = spans.find((span) => {
    const start = Number(span.dataset.ttsStart);
    const length = span.dataset.ttsText?.length ?? 0;
    return charEnd > start && charEnd <= start + length;
  });
  if (!startSpan || !endSpan) return null;
  const startNode = startSpan.firstChild;
  const endNode = endSpan.firstChild;
  if (!(startNode instanceof Text) || !(endNode instanceof Text)) return null;

  const startBase = Number(startSpan.dataset.ttsStart);
  const endBase = Number(endSpan.dataset.ttsStart);
  const startMap = normalizedBoundaryMap(startNode.data);
  const endMap = normalizedBoundaryMap(endNode.data);
  const localStart = charStart - startBase;
  const localEnd = charEnd - endBase;
  if (localStart >= startMap.length || localEnd >= endMap.length) return null;

  const range = document.createRange();
  range.setStart(startNode, startMap[localStart]);
  range.setEnd(endNode, endMap[localEnd]);
  return range;
}
