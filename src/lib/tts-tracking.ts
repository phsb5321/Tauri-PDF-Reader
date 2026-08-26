/**
 * TTS tracking utilities for visual highlighting
 * Estimates word positions for synchronized display
 */

import type { TextChunk } from "./text-chunking";
import type { WordTiming } from "./api/ai-tts";

/** Speaking-rate model shared with estimateWordTimings (≈150 wpm at 1x). */
const FALLBACK_WORDS_PER_MINUTE = 150;

export interface TextPosition {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  progress: number; // 0-1 progress through the chunk
}

export interface WordEstimate {
  word: string;
  startTime: number;
  endTime: number;
  index: number;
}

/**
 * Estimate word timings for a chunk based on word count and speech rate
 * @param chunk The text chunk
 * @param rate Speech rate multiplier (1.0 = normal)
 * @returns Array of estimated word timings
 */
export function estimateWordTimings(
  chunk: TextChunk,
  rate: number = 1.0,
): WordEstimate[] {
  const words = chunk.text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  // Average speaking rate: ~150 words per minute at 1x speed
  const wordsPerSecond = (150 * rate) / 60;
  const avgWordDuration = 1 / wordsPerSecond;

  const estimates: WordEstimate[] = [];
  let currentTime = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Adjust duration based on word length (longer words take longer)
    const lengthFactor = Math.max(0.5, Math.min(2.0, word.length / 5));
    const duration = avgWordDuration * lengthFactor;

    estimates.push({
      word,
      startTime: currentTime,
      endTime: currentTime + duration,
      index: i,
    });

    currentTime += duration;
  }

  return estimates;
}

/**
 * Get the estimated current word index based on elapsed time
 * @param elapsed Elapsed time in seconds since chunk started
 * @param wordTimings Word timing estimates
 * @returns Index of the current word, or -1 if not found
 */
export function getCurrentWordIndex(
  elapsed: number,
  wordTimings: WordEstimate[],
): number {
  for (let i = 0; i < wordTimings.length; i++) {
    if (
      elapsed >= wordTimings[i].startTime &&
      elapsed < wordTimings[i].endTime
    ) {
      return i;
    }
  }
  // If elapsed is past all words, return last word
  if (elapsed >= (wordTimings[wordTimings.length - 1]?.endTime ?? 0)) {
    return wordTimings.length - 1;
  }
  return 0;
}

/**
 * Find the active word index for `elapsedSeconds` against real (ElevenLabs)
 * word timings — the karaoke "word under the playback head" selection.
 *
 * This is the pure extraction of the loop that previously lived inline in
 * `useTtsWordHighlight`'s requestAnimationFrame callback; semantics are kept
 * identical so it can be unit-tested independently of the rAF loop:
 * - In-range: the word whose `[startTime, endTime)` contains `elapsedSeconds`.
 * - Gap-fill: during a silent gap between word `i` and `i + 1`, hold word `i`.
 * - Tail: once past the last word's `startTime`, hold the last word.
 * - Returns `-1` before the first word starts (nothing highlighted yet), or
 *   when there are no timings.
 *
 * Note this differs from `getCurrentWordIndex` above, which targets estimated
 * chunk timings (`WordEstimate`) and returns `0` rather than `-1` pre-start.
 * Accepts any `{ startTime, endTime }`-shaped timing so it is decoupled from the
 * full `WordTiming` binding.
 */
export function findWordIndexAtTime(
  elapsedSeconds: number,
  wordTimings: ReadonlyArray<{ startTime: number; endTime: number }>,
): number {
  for (let i = 0; i < wordTimings.length; i++) {
    const word = wordTimings[i];
    if (elapsedSeconds >= word.startTime && elapsedSeconds < word.endTime) {
      return i;
    }
    // Gap between this word and the next — keep the previous word highlighted.
    if (i < wordTimings.length - 1) {
      const nextWord = wordTimings[i + 1];
      if (
        elapsedSeconds >= word.endTime &&
        elapsedSeconds < nextWord.startTime
      ) {
        return i;
      }
    }
  }

  // Past all words — hold the last one.
  if (wordTimings.length > 0) {
    const lastWord = wordTimings[wordTimings.length - 1];
    if (elapsedSeconds >= lastWord.startTime) {
      return wordTimings.length - 1;
    }
  }

  return -1;
}

/**
 * Calculate reading position based on current chunk and progress
 */
export function calculateReadingPosition(
  chunk: TextChunk,
  progress: number,
): TextPosition {
  return {
    pageNumber: chunk.pageNumber,
    startOffset: chunk.startOffset,
    endOffset: chunk.endOffset,
    progress,
  };
}

/**
 * Estimate total duration of a chunk in seconds
 */
export function estimateChunkDuration(
  chunk: TextChunk,
  rate: number = 1.0,
): number {
  const wordTimings = estimateWordTimings(chunk, rate);
  if (wordTimings.length === 0) return 0;
  return wordTimings[wordTimings.length - 1].endTime;
}

/**
 * Find the text item that contains a specific word at the given index
 */
export function findTextItemForWord(
  wordIndex: number,
  textItems: Array<{
    str: string;
    transform: number[];
    width: number;
    height: number;
  }>,
): { item: (typeof textItems)[0]; localIndex: number } | null {
  let globalWordIndex = 0;

  for (const item of textItems) {
    const itemWords = item.str.split(/\s+/).filter((w) => w.length > 0);

    for (let localIndex = 0; localIndex < itemWords.length; localIndex++) {
      if (globalWordIndex === wordIndex) {
        return { item, localIndex };
      }
      globalWordIndex++;
    }
  }

  return null;
}

/**
 * Build duration-bound per-word timings when a local provider publishes audio
 * duration but no marks. Internal words are estimates; the first starts at 0
 * and the last ends exactly with the real WAV, keeping overlay and progress on
 * the same clock as playback.
 */
export function buildWordFallbackTimings(
  text: string,
  totalDurationSeconds: number,
): WordTiming[] {
  if (!(totalDurationSeconds > 0)) return [];

  const matches = [...text.matchAll(/\S+/gu)];
  if (matches.length === 0) return [];
  const weights = matches.map((match) =>
    Math.max(0.5, Math.min(2, match[0].length / 5)),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let elapsed = 0;

  return matches.map((match, index) => {
    const startTime = elapsed;
    const endTime =
      index === matches.length - 1
        ? totalDurationSeconds
        : elapsed + (weights[index] / totalWeight) * totalDurationSeconds;
    elapsed = endTime;
    const charStart = match.index;
    return {
      word: match[0],
      startTime,
      endTime,
      charStart,
      charEnd: charStart + match[0].length,
    };
  });
}

/** A sentence and its UTF-16 char offsets within the ORIGINAL text. */
export interface SentenceSpan {
  text: string;
  charStart: number;
  charEnd: number;
}

const SENTENCE_TERMINATORS = new Set([".", "!", "?", "…"]);
const TRAILING_CLOSERS = /["')\]]/;
const SHORT_ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "st",
  "jr",
  "sr",
  "vs",
  "no",
]);

/**
 * Segment `text` into sentences, tracking each sentence's `[charStart, charEnd)`
 * offsets in the ORIGINAL text as JS string (UTF-16) indices — so a highlight
 * overlay can build DOM ranges over the rendered text layer. Unlike
 * text-chunking's splitIntoSentences (which normalizes whitespace first and
 * therefore loses original offsets), this preserves them. Leading/trailing
 * whitespace is excluded from the span; terminal punctuation is included. A
 * trailing fragment without terminal punctuation becomes its own span.
 */
export function segmentSentencesWithOffsets(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  const n = text.length;
  let i = 0;

  while (i < n) {
    while (i < n && /\s/.test(text[i])) i++; // skip leading whitespace
    if (i >= n) break;
    const start = i;

    let j = i;
    while (j < n) {
      const char = text[j];
      if (char === ".") {
        let periodEnd = j + 1;
        while (periodEnd < n && text[periodEnd] === ".") periodEnd++;
        const previous = j > 0 ? text[j - 1] : "";
        const next = periodEnd < n ? text[periodEnd] : " ";
        let wordLength = 0;
        for (
          let wordIndex = j - 1;
          wordIndex >= 0 && /[A-Za-z]/.test(text[wordIndex]);
          wordIndex--
        ) {
          wordLength++;
        }
        const decimal = /\d/.test(previous) && /\d/.test(next);
        const midToken = /[A-Za-z]/.test(previous) && /[A-Za-z]/.test(next);
        const word = text.slice(j - wordLength, j).toLowerCase();
        const shortAbbreviation =
          SHORT_ABBREVIATIONS.has(word) && /\s/.test(next);
        const dottedAbbreviation = /(?:[A-Za-z]\.){2,}$/.test(
          text.slice(Math.max(0, periodEnd - 8), periodEnd),
        );
        if (decimal || midToken || shortAbbreviation || dottedAbbreviation) {
          j = periodEnd;
          continue;
        }
      }

      if (SENTENCE_TERMINATORS.has(char)) {
        j++; // consume the terminator run + any closing quotes/brackets
        while (
          j < n &&
          (SENTENCE_TERMINATORS.has(text[j]) || TRAILING_CLOSERS.test(text[j]))
        ) {
          j++;
        }
        break;
      }
      j++;
    }

    let end = j; // trim any trailing whitespace captured by a punctuation-less tail
    while (end > start && /\s/.test(text[end - 1])) end--;

    if (text.slice(start, end).trim().length > 0) {
      spans.push({
        text: text.slice(start, end),
        charStart: start,
        charEnd: end,
      });
    }
    i = j;
  }

  return spans;
}

interface GraphemeSpan {
  text: string;
  start: number;
  end: number;
  bytes: number;
}

function graphemeSpans(text: string): GraphemeSpan[] {
  const spans: GraphemeSpan[] = [];
  let offset = 0;
  for (const character of text) {
    const start = offset;
    offset += character.length;
    const joinsPrevious =
      spans.length > 0 &&
      (/\p{Mark}/u.test(character) ||
        character === "\uFE0F" ||
        character === "\u200D" ||
        spans[spans.length - 1]?.text.endsWith("\u200D"));
    if (joinsPrevious) {
      const previous = spans[spans.length - 1];
      previous.text += character;
      previous.end = offset;
      previous.bytes = new TextEncoder().encode(previous.text).length;
    } else {
      spans.push({
        text: character,
        start,
        end: offset,
        bytes: new TextEncoder().encode(character).length,
      });
    }
  }
  return spans;
}

/**
 * Keep sentence boundaries when possible, then split oversized sentences at a
 * whitespace/grapheme boundary while retaining original UTF-16 offsets.
 * `maxTextUtf8Bytes` is a conservative provider dispatch bound; no chunk is
 * silently truncated or allowed to exceed it.
 */
export function segmentSpeechWithOffsets(
  text: string,
  maxTextUtf8Bytes: number,
): SentenceSpan[] {
  if (!Number.isInteger(maxTextUtf8Bytes) || maxTextUtf8Bytes < 1) return [];
  const output: SentenceSpan[] = [];
  const encoder = new TextEncoder();

  for (const sentence of segmentSentencesWithOffsets(text)) {
    if (encoder.encode(sentence.text).length <= maxTextUtf8Bytes) {
      output.push(sentence);
      continue;
    }

    const graphemes = graphemeSpans(sentence.text);
    let cursor = 0;
    while (cursor < graphemes.length) {
      while (
        cursor < graphemes.length &&
        /^\s+$/u.test(graphemes[cursor].text)
      ) {
        cursor++;
      }
      if (cursor >= graphemes.length) break;

      const start = cursor;
      let end = cursor;
      let bytes = 0;
      let lastWhitespace = -1;
      while (end < graphemes.length) {
        const nextBytes = graphemes[end].bytes;
        if (bytes + nextBytes > maxTextUtf8Bytes) break;
        bytes += nextBytes;
        end++;
        if (/^\s+$/u.test(graphemes[end - 1].text)) lastWhitespace = end;
      }
      if (end === start) {
        // A single grapheme larger than the provider bound cannot be split
        // without corrupting text. Fail closed; the caller surfaces no start.
        return [];
      }
      if (end < graphemes.length && lastWhitespace > start) {
        end = lastWhitespace;
      }

      let contentEnd = end;
      while (
        contentEnd > start &&
        /^\s+$/u.test(graphemes[contentEnd - 1].text)
      ) {
        contentEnd--;
      }
      if (contentEnd > start) {
        const localStart = graphemes[start].start;
        const localEnd = graphemes[contentEnd - 1].end;
        output.push({
          text: sentence.text.slice(localStart, localEnd),
          charStart: sentence.charStart + localStart,
          charEnd: sentence.charStart + localEnd,
        });
      }
      cursor = end;
    }
  }

  return output;
}

/**
 * Build coarse SENTENCE-level fallback timings for karaoke highlighting when
 * real per-word timings are unavailable (e.g. ElevenLabs returned no alignment).
 * Each sentence becomes one `WordTiming` (carrying its original-text UTF-16
 * offsets) and the duration is spread across sentences proportional to their
 * character length, so the highlight still advances roughly in step with audio.
 *
 * `totalDurationSeconds` is the known audio length; when `<= 0` (the typical
 * no-alignment case, where the timestamps response also omits the duration) it
 * is estimated from the word count at ≈150 wpm. Pure + deterministic; returns
 * `[]` for empty/whitespace-only text or a non-positive resolved duration.
 */
export function buildSentenceFallbackTimings(
  text: string,
  totalDurationSeconds: number,
): WordTiming[] {
  const sentences = segmentSentencesWithOffsets(text);
  if (sentences.length === 0) return [];

  let duration = totalDurationSeconds;
  if (!(duration > 0)) {
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
    duration = (wordCount / FALLBACK_WORDS_PER_MINUTE) * 60;
  }
  if (!(duration > 0)) return [];

  const totalChars = sentences.reduce((sum, s) => sum + s.text.length, 0);
  const timings: WordTiming[] = [];
  let elapsed = 0;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const share =
      totalChars > 0 ? s.text.length / totalChars : 1 / sentences.length;
    // The last sentence ends exactly at `duration` to avoid float drift.
    const end =
      i === sentences.length - 1 ? duration : elapsed + share * duration;
    timings.push({
      word: s.text,
      startTime: elapsed,
      endTime: end,
      charStart: s.charStart,
      charEnd: s.charEnd,
    });
    elapsed = end;
  }

  return timings;
}

/** A character range resolved to (text-node index, local offset) start/end pairs. */
export interface ResolvedCharRange {
  startIndex: number;
  startOffset: number;
  endIndex: number;
  endOffset: number;
  /** true if the requested end ran past the available text and was clamped. */
  clamped: boolean;
}

/**
 * Resolve `[charOffset, charOffset + charLength)` over a sequence of text-node
 * lengths into start/end (node index, local offset) pairs — the pure arithmetic
 * behind createWordRange's TreeWalker. Returns `null` when `charOffset` lies
 * beyond all the text (e.g. the word belongs to a different PDF page than this
 * text layer). When the end runs past the available text it is clamped to the
 * LAST node's end and `clamped` is set — so a word straddling a page boundary
 * still highlights the portion present on this page, instead of highlighting
 * only the first node (the prior bug) or failing outright.
 */
export function resolveCharRange(
  nodeLengths: readonly number[],
  charOffset: number,
  charLength: number,
): ResolvedCharRange | null {
  if (charLength <= 0 || charOffset < 0) return null;

  const total = nodeLengths.reduce((sum, n) => sum + n, 0);
  if (charOffset >= total) return null; // start is off this text layer

  // Locate the start node.
  let acc = 0;
  let startIndex = 0;
  let startOffset = 0;
  for (let i = 0; i < nodeLengths.length; i++) {
    if (acc + nodeLengths[i] > charOffset) {
      startIndex = i;
      startOffset = charOffset - acc;
      break;
    }
    acc += nodeLengths[i];
  }

  // Locate the end node, clamping to the last node when it overruns.
  const target = charOffset + charLength;
  if (target > total) {
    const lastIndex = nodeLengths.length - 1;
    return {
      startIndex,
      startOffset,
      endIndex: lastIndex,
      endOffset: nodeLengths[lastIndex],
      clamped: true,
    };
  }
  let acc2 = 0;
  for (let i = 0; i < nodeLengths.length; i++) {
    if (acc2 + nodeLengths[i] >= target) {
      return {
        startIndex,
        startOffset,
        endIndex: i,
        endOffset: target - acc2,
        clamped: false,
      };
    }
    acc2 += nodeLengths[i];
  }
  /* c8 ignore next -- unreachable: target <= total guarantees a hit above */
  return null;
}

/**
 * Whether timer-driven TTS playback should be considered complete.
 *
 * Completion requires a POSITIVE known duration: `totalDurationSeconds > 0 &&
 * elapsedSeconds >= totalDurationSeconds`. The duration guard is the important
 * part — when ElevenLabs returns no alignment the duration is reported as 0,
 * and the old check (`elapsed >= totalDuration`) was true on the very first
 * animation frame, firing onComplete immediately and (with auto-page on)
 * advancing the page while the audio had only just started. With no real
 * duration there is nothing to time against, so the timer must NOT declare
 * completion — that is the job of a real audio-finished signal (not yet wired;
 * the backend currently cannot detect when playback ends).
 */
export function isPlaybackComplete(
  elapsedSeconds: number,
  totalDurationSeconds: number,
): boolean {
  return totalDurationSeconds > 0 && elapsedSeconds >= totalDurationSeconds;
}
