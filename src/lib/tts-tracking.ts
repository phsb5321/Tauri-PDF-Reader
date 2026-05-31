/**
 * TTS tracking utilities for visual highlighting
 * Estimates word positions for synchronized display
 */

import type { TextChunk } from './text-chunking';

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
