/**
 * Pure domain logic for TTS text chunking
 *
 * This module contains text chunking algorithms that split text into
 * optimal chunks for TTS playback. No framework dependencies.
 */

export interface TextChunk {
  id: string;
  text: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
}

export interface ChunkingOptions {
  maxChunkLength?: number;
  minChunkLength?: number;
}

// Maximum characters per chunk (TTS engines typically handle ~500 chars well)
const DEFAULT_MAX_CHUNK_LENGTH = 500;
// Minimum chunk length to avoid very short utterances
const DEFAULT_MIN_CHUNK_LENGTH = 20;
// Average speaking rate (words per minute at 1x speed)
const WORDS_PER_MINUTE = 150;

/**
 * Generate a unique chunk ID
 */
function generateChunkId(pageNumber: number, index: number): string {
  return `chunk-${pageNumber}-${index}`;
}

/**
 * Split text into sentences based on punctuation
 */
export function splitIntoSentences(text: string): string[] {
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (!normalized) return [];

  // Split by sentence endings
  const sentencePattern = /[.!?]+[\s]*/g;
  const parts: string[] = [];
  let lastIndex = 0;
  let match;

  while ((match = sentencePattern.exec(normalized)) !== null) {
    const sentence = normalized.slice(lastIndex, match.index + match[0].trimEnd().length);
    if (sentence.trim()) {
      parts.push(sentence.trim());
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  const remaining = normalized.slice(lastIndex).trim();
  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

/**
 * Split a long sentence into smaller parts at natural break points
 */
export function splitLongSentence(
  sentence: string,
  maxLength: number,
  minLength: number = DEFAULT_MIN_CHUNK_LENGTH
): string[] {
  if (sentence.length <= maxLength) {
    return [sentence];
  }

  const parts: string[] = [];
  let remaining = sentence;

  while (remaining.length > maxLength) {
    // Find a good break point (comma, semicolon, or last space before maxLength)
    const searchRange = remaining.slice(0, maxLength);

    let breakIndex = Math.max(
      searchRange.lastIndexOf(','),
      searchRange.lastIndexOf(';'),
      searchRange.lastIndexOf(':')
    );

    // Fall back to space if no punctuation break
    if (breakIndex < minLength) {
      breakIndex = searchRange.lastIndexOf(' ');
    }

    // If still no good break point, just break at maxLength
    if (breakIndex < minLength) {
      breakIndex = maxLength;
    }

    parts.push(remaining.slice(0, breakIndex + 1).trim());
    remaining = remaining.slice(breakIndex + 1).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

/**
 * Merge short sentences into longer chunks
 */
export function mergeSentencesIntoChunks(
  sentences: string[],
  maxLength: number
): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    // If adding this sentence would exceed max length, start a new chunk
    if (currentChunk && (currentChunk.length + sentence.length + 1) > maxLength) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      // Add to current chunk
      currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    }
  }

  // Add the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Create text chunks from page text content
 */
export function createChunksFromText(
  text: string,
  pageNumber: number,
  options: ChunkingOptions = {}
): TextChunk[] {
  const maxLength = options.maxChunkLength ?? DEFAULT_MAX_CHUNK_LENGTH;
  const minLength = options.minChunkLength ?? DEFAULT_MIN_CHUNK_LENGTH;

  // Clean and normalize text
  const cleanedText = text
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanedText) return [];

  // Split into sentences
  const sentences = splitIntoSentences(cleanedText);

  // Handle long sentences
  const processedSentences: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      processedSentences.push(...splitLongSentence(sentence, maxLength, minLength));
    } else {
      processedSentences.push(sentence);
    }
  }

  // Merge short sentences into chunks
  const mergedChunks = mergeSentencesIntoChunks(processedSentences, maxLength);

  // Filter out chunks that are too short (unless it's the only chunk)
  const filteredChunks = mergedChunks.length === 1
    ? mergedChunks
    : mergedChunks.filter(chunk => chunk.length >= minLength);

  // Calculate offsets and create chunk objects
  const chunks: TextChunk[] = [];
  let currentOffset = 0;

  for (let i = 0; i < filteredChunks.length; i++) {
    const chunkText = filteredChunks[i];
    const startOffset = cleanedText.indexOf(chunkText, currentOffset);
    const endOffset = startOffset + chunkText.length;

    chunks.push({
      id: generateChunkId(pageNumber, i),
      text: chunkText,
      pageNumber,
      startOffset: startOffset >= 0 ? startOffset : currentOffset,
      endOffset: startOffset >= 0 ? endOffset : currentOffset + chunkText.length,
    });

    currentOffset = endOffset;
  }

  return chunks;
}

/**
 * Create chunks from multiple pages
 */
export function createChunksFromPages(
  pages: Array<{ pageNumber: number; text: string }>,
  options: ChunkingOptions = {}
): TextChunk[] {
  const allChunks: TextChunk[] = [];

  for (const { pageNumber, text } of pages) {
    const pageChunks = createChunksFromText(text, pageNumber, options);
    allChunks.push(...pageChunks);
  }

  // Re-index all chunks with global IDs
  return allChunks.map((chunk, index) => ({
    ...chunk,
    id: `chunk-${index}`,
  }));
}

/**
 * Estimate the duration of a chunk in seconds based on word count
 */
export function estimateChunkDuration(chunk: TextChunk, rate: number = 1.0): number {
  const wordCount = chunk.text.split(/\s+/).length;
  const wordsPerMinute = WORDS_PER_MINUTE * rate;
  return (wordCount / wordsPerMinute) * 60;
}

/**
 * Find chunk containing a specific text offset
 */
export function findChunkAtOffset(
  chunks: TextChunk[],
  pageNumber: number,
  offset: number
): TextChunk | null {
  return chunks.find(
    chunk => chunk.pageNumber === pageNumber &&
             offset >= chunk.startOffset &&
             offset < chunk.endOffset
  ) ?? null;
}

/**
 * Get chunks for a specific page
 */
export function getChunksForPage(chunks: TextChunk[], pageNumber: number): TextChunk[] {
  return chunks.filter(chunk => chunk.pageNumber === pageNumber);
}

/**
 * Get word count for a chunk
 */
export function getWordCount(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}
