export interface PdfTextSegment {
  text: string;
  start: number;
}

export interface BuiltPdfText {
  text: string;
  segments: PdfTextSegment[];
}

function itemText(item: unknown): string | null {
  if (!item || typeof item !== "object" || !("str" in item)) return null;
  const raw = String((item as { str: unknown }).str);
  const text = raw.replace(/\s+/gu, " ").trim();
  return text || null;
}

/** Build the one normalized page string used by TTS and highlight offsets. */
export function buildPdfText(items: readonly unknown[]): BuiltPdfText {
  const segments: PdfTextSegment[] = [];
  let text = "";
  for (const item of items) {
    const segment = itemText(item);
    if (!segment) continue;
    if (text) text += " ";
    segments.push({ text: segment, start: text.length });
    text += segment;
  }
  return { text, segments };
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
