/**
 * TTS tracking utilities for visual highlighting
 * Estimates word positions for synchronized display
 */

import type { TextChunk } from './text-chunking';
import type { WordTiming } from './api/ai-tts';

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
  rate: number = 1.0
): WordEstimate[] {
  const words = chunk.text.split(/\s+/).filter(w => w.length > 0);
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
  wordTimings: WordEstimate[]
): number {
  for (let i = 0; i < wordTimings.length; i++) {
    if (elapsed >= wordTimings[i].startTime && elapsed < wordTimings[i].endTime) {
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
 * Calculate reading position based on current chunk and progress
 */
export function calculateReadingPosition(
  chunk: TextChunk,
  progress: number
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
export function estimateChunkDuration(chunk: TextChunk, rate: number = 1.0): number {
  const wordTimings = estimateWordTimings(chunk, rate);
  if (wordTimings.length === 0) return 0;
  return wordTimings[wordTimings.length - 1].endTime;
}

/**
 * Find the text item that contains a specific word at the given index
 */
export function findTextItemForWord(
  wordIndex: number,
  textItems: Array<{ str: string; transform: number[]; width: number; height: number }>
): { item: typeof textItems[0]; localIndex: number } | null {
  let globalWordIndex = 0;

  for (const item of textItems) {
    const itemWords = item.str.split(/\s+/).filter(w => w.length > 0);

    for (let localIndex = 0; localIndex < itemWords.length; localIndex++) {
      if (globalWordIndex === wordIndex) {
        return { item, localIndex };
      }
      globalWordIndex++;
    }
  }

  return null;
}

/** A sentence and its UTF-16 char offsets within the ORIGINAL text. */
export interface SentenceSpan {
  text: string;
  charStart: number;
  charEnd: number;
}

const SENTENCE_TERMINATORS = new Set([".", "!", "?"]);
const TRAILING_CLOSERS = /["')\]]/;

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
      if (SENTENCE_TERMINATORS.has(text[j])) {
        j++; // consume the terminator run + any closing quotes/brackets
        while (j < n && (SENTENCE_TERMINATORS.has(text[j]) || TRAILING_CLOSERS.test(text[j]))) {
          j++;
        }
        break;
      }
      j++;
    }

    let end = j; // trim any trailing whitespace captured by a punctuation-less tail
    while (end > start && /\s/.test(text[end - 1])) end--;

    if (text.slice(start, end).trim().length > 0) {
      spans.push({ text: text.slice(start, end), charStart: start, charEnd: end });
    }
    i = j;
  }

  return spans;
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
    const share = totalChars > 0 ? s.text.length / totalChars : 1 / sentences.length;
    // The last sentence ends exactly at `duration` to avoid float drift.
    const end = i === sentences.length - 1 ? duration : elapsed + share * duration;
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
