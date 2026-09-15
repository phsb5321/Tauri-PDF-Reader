import type { PdfTextBoundary } from "./pdf-text";
import { segmentSpeechWithOffsets } from "./tts-tracking";

export const PROSODY_PLAN_REVISION = "source-aligned-v2";
export const PROSODY_CONTEXT_MAX_UTF8_BYTES = 300;

export type ProsodyLanguage = "auto" | "en" | "pt-BR";
export type ProsodyBoundary = "clause" | "sentence" | "paragraph" | "section";
export type AlignmentKind = "copy" | "replace" | "insert" | "delete";

export interface AlignmentSegment {
  spokenStart: number;
  spokenEnd: number;
  sourceStart: number | null;
  sourceEnd: number | null;
  kind: AlignmentKind;
}

export interface ProsodySource {
  text: string;
  boundaries?: readonly PdfTextBoundary[];
  language?: ProsodyLanguage;
}

export interface SpokenRun {
  sourceStart: number;
  sourceEnd: number;
  displayText: string;
  spokenText: string;
  /** Run-local UTF-16 coordinates on both sides. */
  alignment: AlignmentSegment[];
  language: ProsodyLanguage;
  boundaryAfter: ProsodyBoundary;
  revision: typeof PROSODY_PLAN_REVISION;
}

export interface SourceRange {
  start: number;
  end: number;
}

const TERMINAL_MARK = /[.!?…]["')\]]*$/u;
const DISCOURSE_STARTERS: Record<Exclude<ProsodyLanguage, "auto">, string[]> = {
  en: [
    "Since",
    "However",
    "Therefore",
    "Meanwhile",
    "Nevertheless",
    "Furthermore",
    "Consequently",
  ],
  "pt-BR": ["Porém", "Entretanto", "Portanto", "Todavia", "Consequentemente"],
};

function previousContentEnd(text: string, offset: number): number {
  let end = Math.min(Math.max(offset, 0), text.length);
  while (end > 0 && /\s/u.test(text[end - 1])) end--;
  return end;
}

function nextContentStart(text: string, offset: number): number {
  let start = Math.min(Math.max(offset, 0), text.length);
  while (start < text.length && /\s/u.test(text[start])) start++;
  return start;
}

function isUnterminatedBefore(text: string, offset: number): boolean {
  const end = previousContentEnd(text, offset);
  return end > 0 && !TERMINAL_MARK.test(text.slice(0, end));
}

function canEndInferredSentence(text: string, offset: number): boolean {
  const end = previousContentEnd(text, offset);
  return end > 0 && /[\p{L}\p{N}"')\]]/u.test(text[end - 1]);
}

function structuredInsertions(source: ProsodySource): number[] {
  const insertions: number[] = [];
  for (const boundary of source.boundaries ?? []) {
    if (boundary.kind !== "paragraph" && boundary.kind !== "section") continue;
    const offset = previousContentEnd(source.text, boundary.offset);
    if (
      offset > 0 &&
      nextContentStart(source.text, boundary.offset) < source.text.length &&
      isUnterminatedBefore(source.text, boundary.offset) &&
      canEndInferredSentence(source.text, boundary.offset)
    ) {
      insertions.push(offset);
    }
  }
  return insertions;
}

function discourseInsertions(source: ProsodySource): number[] {
  const languages: Array<Exclude<ProsodyLanguage, "auto">> =
    source.language && source.language !== "auto"
      ? [source.language]
      : ["en", "pt-BR"];
  const starters = languages.flatMap(
    (language) => DISCOURSE_STARTERS[language],
  );
  if (starters.length === 0) return [];

  const escaped = starters.map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
  );
  const pattern = new RegExp(
    `(\\p{Ll}{3,})(\\s+)(${escaped.join("|")})\\b`,
    "gu",
  );
  const insertions: number[] = [];
  for (const match of source.text.matchAll(pattern)) {
    const previousWord = match[1];
    const offset = (match.index ?? 0) + previousWord.length;
    if (isUnterminatedBefore(source.text, offset)) insertions.push(offset);
  }
  return insertions;
}

interface AlignedText {
  spokenText: string;
  alignment: AlignmentSegment[];
}

function buildAlignedText(source: ProsodySource): AlignedText {
  const insertions = [
    ...structuredInsertions(source),
    ...discourseInsertions(source),
  ]
    .filter((offset, index, all) => offset > 0 && all.indexOf(offset) === index)
    .sort((a, b) => a - b);

  let sourceCursor = 0;
  let spokenText = "";
  const alignment: AlignmentSegment[] = [];
  for (const insertion of insertions) {
    if (insertion < sourceCursor || insertion > source.text.length) continue;
    if (insertion > sourceCursor) {
      const copied = source.text.slice(sourceCursor, insertion);
      const spokenStart = spokenText.length;
      spokenText += copied;
      alignment.push({
        spokenStart,
        spokenEnd: spokenText.length,
        sourceStart: sourceCursor,
        sourceEnd: insertion,
        kind: "copy",
      });
    }
    const spokenStart = spokenText.length;
    spokenText += ".";
    alignment.push({
      spokenStart,
      spokenEnd: spokenText.length,
      sourceStart: null,
      sourceEnd: null,
      kind: "insert",
    });
    sourceCursor = insertion;
  }
  if (sourceCursor < source.text.length) {
    const spokenStart = spokenText.length;
    spokenText += source.text.slice(sourceCursor);
    alignment.push({
      spokenStart,
      spokenEnd: spokenText.length,
      sourceStart: sourceCursor,
      sourceEnd: source.text.length,
      kind: "copy",
    });
  }
  return { spokenText, alignment };
}

function projectSegment(
  segment: AlignmentSegment,
  spokenStart: number,
  spokenEnd: number,
): AlignmentSegment | null {
  const start = Math.max(segment.spokenStart, spokenStart);
  const end = Math.min(segment.spokenEnd, spokenEnd);
  if (start >= end) return null;
  if (segment.sourceStart === null || segment.sourceEnd === null) {
    return {
      spokenStart: start,
      spokenEnd: end,
      sourceStart: null,
      sourceEnd: null,
      kind: segment.kind,
    };
  }
  if (segment.kind === "copy") {
    return {
      spokenStart: start,
      spokenEnd: end,
      sourceStart: segment.sourceStart + (start - segment.spokenStart),
      sourceEnd: segment.sourceStart + (end - segment.spokenStart),
      kind: "copy",
    };
  }
  return {
    spokenStart: start,
    spokenEnd: end,
    sourceStart: segment.sourceStart,
    sourceEnd: segment.sourceEnd,
    kind: segment.kind,
  };
}

function sourceBoundaryAfter(
  source: ProsodySource,
  sourceEnd: number,
  spokenText: string,
): ProsodyBoundary {
  const structural = (source.boundaries ?? []).find(
    (boundary) =>
      (boundary.kind === "paragraph" || boundary.kind === "section") &&
      previousContentEnd(source.text, boundary.offset) === sourceEnd,
  );
  if (structural?.kind === "section") return "section";
  if (structural?.kind === "paragraph") return "paragraph";
  return TERMINAL_MARK.test(spokenText) ? "sentence" : "clause";
}

function mergeRuns(
  source: ProsodySource,
  left: SpokenRun,
  right: SpokenRun,
): SpokenRun {
  const sourceGap = source.text.slice(left.sourceEnd, right.sourceStart);
  const rightSpokenOffset = left.spokenText.length + sourceGap.length;
  const rightSourceOffset = right.sourceStart - left.sourceStart;
  const alignment: AlignmentSegment[] = [...left.alignment];
  if (sourceGap.length > 0) {
    alignment.push({
      spokenStart: left.spokenText.length,
      spokenEnd: rightSpokenOffset,
      sourceStart: left.sourceEnd - left.sourceStart,
      sourceEnd: rightSourceOffset,
      kind: "copy",
    });
  }
  alignment.push(
    ...right.alignment.map((segment) => ({
      ...segment,
      spokenStart: segment.spokenStart + rightSpokenOffset,
      spokenEnd: segment.spokenEnd + rightSpokenOffset,
      sourceStart:
        segment.sourceStart === null
          ? null
          : segment.sourceStart + rightSourceOffset,
      sourceEnd:
        segment.sourceEnd === null
          ? null
          : segment.sourceEnd + rightSourceOffset,
    })),
  );
  return {
    sourceStart: left.sourceStart,
    sourceEnd: right.sourceEnd,
    displayText: source.text.slice(left.sourceStart, right.sourceEnd),
    spokenText: left.spokenText + sourceGap + right.spokenText,
    alignment,
    language: left.language,
    boundaryAfter: right.boundaryAfter,
    revision: PROSODY_PLAN_REVISION,
  };
}

/**
 * Keep the latency-critical first unit short, then group later sentences from
 * one paragraph into a single model context. Supertonic's documented default
 * is 300 characters; a 300-byte cap is conservative for every language and
 * also prevents its internal chunker from creating another independent edge.
 */
function mergeContextRuns(
  source: ProsodySource,
  runs: SpokenRun[],
  contextLimit: number,
): SpokenRun[] {
  if (runs.length < 3) return runs;
  const encoder = new TextEncoder();
  const merged: SpokenRun[] = [runs[0]];
  let current = runs[1];

  for (const next of runs.slice(2)) {
    const candidate = mergeRuns(source, current, next);
    const crossesBlock =
      current.boundaryAfter === "paragraph" ||
      current.boundaryAfter === "section";
    if (
      !crossesBlock &&
      encoder.encode(candidate.spokenText).length <= contextLimit
    ) {
      current = candidate;
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  return merged;
}

/**
 * Build provider-bounded spoken runs while retaining a reversible UTF-16 map to
 * the unchanged PDF source. The policy is intentionally conservative: only
 * structural block evidence and a pinned discourse-starter anomaly can insert
 * punctuation.
 */
export function planProsodyRuns(
  source: ProsodySource,
  maxTextUtf8Bytes: number,
  contextMaxUtf8Bytes = PROSODY_CONTEXT_MAX_UTF8_BYTES,
): SpokenRun[] {
  if (!source.text.trim()) return [];
  const contextLimit = Math.min(maxTextUtf8Bytes, contextMaxUtf8Bytes);
  if (contextLimit <= 0) return [];
  const aligned = buildAlignedText(source);
  const spans = segmentSpeechWithOffsets(aligned.spokenText, contextLimit);
  if (spans.length === 0) return [];

  const runs: SpokenRun[] = [];
  for (const span of spans) {
    const projected = aligned.alignment
      .map((segment) => projectSegment(segment, span.charStart, span.charEnd))
      .filter((segment): segment is AlignmentSegment => segment !== null);
    const mapped = projected.filter(
      (segment) => segment.sourceStart !== null && segment.sourceEnd !== null,
    );
    if (mapped.length === 0) continue;
    const sourceStart = Math.min(
      ...mapped.map((segment) => segment.sourceStart as number),
    );
    const sourceEnd = Math.max(
      ...mapped.map((segment) => segment.sourceEnd as number),
    );
    const alignment = projected.map((segment) => ({
      ...segment,
      spokenStart: segment.spokenStart - span.charStart,
      spokenEnd: segment.spokenEnd - span.charStart,
      sourceStart:
        segment.sourceStart === null ? null : segment.sourceStart - sourceStart,
      sourceEnd:
        segment.sourceEnd === null ? null : segment.sourceEnd - sourceStart,
    }));
    runs.push({
      sourceStart,
      sourceEnd,
      displayText: source.text.slice(sourceStart, sourceEnd),
      spokenText: span.text,
      alignment,
      language: source.language ?? "auto",
      boundaryAfter: sourceBoundaryAfter(source, sourceEnd, span.text),
      revision: PROSODY_PLAN_REVISION,
    });
  }
  return mergeContextRuns(source, runs, contextLimit);
}

/** Map a spoken timing range to the run-local unchanged source range. */
export function mapSpokenRangeToSource(
  alignment: readonly AlignmentSegment[],
  spokenStart: number,
  spokenEnd: number,
): SourceRange | null {
  if (spokenStart < 0 || spokenEnd <= spokenStart) return null;
  const ranges: SourceRange[] = [];
  for (const segment of alignment) {
    const start = Math.max(segment.spokenStart, spokenStart);
    const end = Math.min(segment.spokenEnd, spokenEnd);
    if (
      start >= end ||
      segment.sourceStart === null ||
      segment.sourceEnd === null
    ) {
      continue;
    }
    if (segment.kind === "copy") {
      ranges.push({
        start: segment.sourceStart + (start - segment.spokenStart),
        end: segment.sourceStart + (end - segment.spokenStart),
      });
    } else {
      ranges.push({ start: segment.sourceStart, end: segment.sourceEnd });
    }
  }
  if (ranges.length === 0) return null;
  return {
    start: Math.min(...ranges.map((range) => range.start)),
    end: Math.max(...ranges.map((range) => range.end)),
  };
}
