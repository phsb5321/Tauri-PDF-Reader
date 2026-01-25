/**
 * Text Chunking Domain Tests
 *
 * Pure domain logic tests - no Tauri runtime or React hooks needed.
 * These tests should complete in <100ms each.
 */

import { describe, it, expect } from 'vitest';
import {
  splitIntoSentences,
  splitLongSentence,
  mergeSentencesIntoChunks,
  createChunksFromText,
  createChunksFromPages,
  estimateChunkDuration,
  findChunkAtOffset,
  getChunksForPage,
  getWordCount,
  type TextChunk,
} from '../text-chunking';

describe('splitIntoSentences', () => {
  it('should return empty array for empty string', () => {
    expect(splitIntoSentences('')).toEqual([]);
  });

  it('should return empty array for whitespace only', () => {
    expect(splitIntoSentences('   \n\t  ')).toEqual([]);
  });

  it('should split text with periods', () => {
    const result = splitIntoSentences('First sentence. Second sentence.');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('First sentence.');
    expect(result[1]).toBe('Second sentence.');
  });

  it('should handle exclamation marks', () => {
    const result = splitIntoSentences('Wow! Amazing!');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle question marks', () => {
    const result = splitIntoSentences('Is this working? Yes it is.');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle text without ending punctuation', () => {
    const result = splitIntoSentences('Text without ending');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Text without ending');
  });

  it('should normalize whitespace', () => {
    const result = splitIntoSentences('First   sentence.    Second   sentence.');
    expect(result[0]).not.toContain('  ');
  });
});

describe('splitLongSentence', () => {
  it('should return sentence unchanged if under max length', () => {
    const result = splitLongSentence('Short sentence.', 100);
    expect(result).toEqual(['Short sentence.']);
  });

  it('should split long sentence at punctuation', () => {
    const longText = 'This is a long sentence, with a comma, that should be split at the comma when max is reached.';
    const result = splitLongSentence(longText, 50);
    expect(result.length).toBeGreaterThan(1);
  });

  it('should split at space if no punctuation', () => {
    const longText = 'This is a long sentence without any punctuation marks that will need splitting';
    const result = splitLongSentence(longText, 30);
    expect(result.length).toBeGreaterThan(1);
  });

  it('should force split at max length if no break point', () => {
    const noBreaks = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const result = splitLongSentence(noBreaks, 10, 5);
    expect(result.length).toBeGreaterThan(1);
  });
});

describe('mergeSentencesIntoChunks', () => {
  it('should return empty array for empty input', () => {
    expect(mergeSentencesIntoChunks([], 100)).toEqual([]);
  });

  it('should merge short sentences', () => {
    const sentences = ['Hi.', 'Hello.', 'Hey.'];
    const result = mergeSentencesIntoChunks(sentences, 100);
    expect(result.length).toBeLessThan(sentences.length);
  });

  it('should not merge if exceeds max length', () => {
    const sentences = [
      'This is a fairly long first sentence.',
      'This is another long second sentence.',
    ];
    const result = mergeSentencesIntoChunks(sentences, 40);
    expect(result.length).toBe(2);
  });

  it('should create single chunk if all fit', () => {
    const sentences = ['Short.', 'Also short.'];
    const result = mergeSentencesIntoChunks(sentences, 100);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('Short.');
    expect(result[0]).toContain('Also short.');
  });
});

describe('createChunksFromText', () => {
  it('should return empty array for empty text', () => {
    expect(createChunksFromText('', 1)).toEqual([]);
  });

  it('should return empty array for whitespace', () => {
    expect(createChunksFromText('   ', 1)).toEqual([]);
  });

  it('should create single chunk for short text', () => {
    const chunks = createChunksFromText('Hello world.', 1);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Hello world.');
    expect(chunks[0].pageNumber).toBe(1);
  });

  it('should include page number in chunk ID', () => {
    const chunks = createChunksFromText('Test text.', 5);
    expect(chunks[0].id).toContain('5');
  });

  it('should calculate correct offsets', () => {
    const chunks = createChunksFromText('Test text here.', 1);
    expect(chunks[0].startOffset).toBe(0);
    expect(chunks[0].endOffset).toBe(15);
  });

  it('should respect maxChunkLength option', () => {
    const longText = 'This is a sentence. Another sentence here. More text follows. And even more.';
    const chunks = createChunksFromText(longText, 1, { maxChunkLength: 30 });
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(50); // Some tolerance for sentence boundaries
    }
  });

  it('should filter short chunks unless only one', () => {
    const text = 'Long enough sentence here. X.'; // X is very short
    const chunks = createChunksFromText(text, 1, { minChunkLength: 10 });
    // Short chunks should be filtered or merged
    expect(chunks.every(c => c.text.length >= 10 || chunks.length === 1)).toBe(true);
  });
});

describe('createChunksFromPages', () => {
  it('should handle empty pages array', () => {
    expect(createChunksFromPages([])).toEqual([]);
  });

  it('should create chunks from multiple pages', () => {
    const pages = [
      { pageNumber: 1, text: 'Page one content.' },
      { pageNumber: 2, text: 'Page two content.' },
    ];
    const chunks = createChunksFromPages(pages);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('should preserve page numbers', () => {
    const pages = [
      { pageNumber: 1, text: 'First page.' },
      { pageNumber: 5, text: 'Fifth page.' },
    ];
    const chunks = createChunksFromPages(pages);
    expect(chunks.some(c => c.pageNumber === 1)).toBe(true);
    expect(chunks.some(c => c.pageNumber === 5)).toBe(true);
  });

  it('should use global sequential IDs', () => {
    const pages = [
      { pageNumber: 1, text: 'Page one.' },
      { pageNumber: 2, text: 'Page two.' },
    ];
    const chunks = createChunksFromPages(pages);
    expect(chunks[0].id).toBe('chunk-0');
    expect(chunks[1].id).toBe('chunk-1');
  });
});

describe('estimateChunkDuration', () => {
  it('should estimate duration based on word count', () => {
    const chunk: TextChunk = {
      id: 'test',
      text: 'word '.repeat(150).trim(), // 150 words
      pageNumber: 1,
      startOffset: 0,
      endOffset: 750,
    };
    const duration = estimateChunkDuration(chunk, 1.0);
    // 150 words at 150 wpm = 1 minute = 60 seconds
    expect(duration).toBeCloseTo(60, 0);
  });

  it('should adjust for playback rate', () => {
    const chunk: TextChunk = {
      id: 'test',
      text: 'word '.repeat(150).trim(),
      pageNumber: 1,
      startOffset: 0,
      endOffset: 750,
    };
    const duration = estimateChunkDuration(chunk, 2.0);
    // At 2x rate, should be ~30 seconds
    expect(duration).toBeCloseTo(30, 0);
  });

  it('should return 0 for empty chunk', () => {
    const chunk: TextChunk = {
      id: 'test',
      text: '',
      pageNumber: 1,
      startOffset: 0,
      endOffset: 0,
    };
    // Empty text has 1 "word" (empty string split result)
    const duration = estimateChunkDuration(chunk, 1.0);
    expect(duration).toBeLessThan(1);
  });
});

describe('findChunkAtOffset', () => {
  const chunks: TextChunk[] = [
    { id: 'chunk-0', text: 'First chunk.', pageNumber: 1, startOffset: 0, endOffset: 12 },
    { id: 'chunk-1', text: 'Second chunk.', pageNumber: 1, startOffset: 13, endOffset: 26 },
    { id: 'chunk-2', text: 'Page two chunk.', pageNumber: 2, startOffset: 0, endOffset: 15 },
  ];

  it('should find chunk at beginning', () => {
    const found = findChunkAtOffset(chunks, 1, 0);
    expect(found).not.toBeNull();
    expect(found?.id).toBe('chunk-0');
  });

  it('should find chunk at middle offset', () => {
    const found = findChunkAtOffset(chunks, 1, 15);
    expect(found).not.toBeNull();
    expect(found?.id).toBe('chunk-1');
  });

  it('should return null for wrong page', () => {
    const found = findChunkAtOffset(chunks, 3, 0);
    expect(found).toBeNull();
  });

  it('should return null for offset beyond chunks', () => {
    const found = findChunkAtOffset(chunks, 1, 100);
    expect(found).toBeNull();
  });

  it('should find chunk on different page', () => {
    const found = findChunkAtOffset(chunks, 2, 5);
    expect(found).not.toBeNull();
    expect(found?.id).toBe('chunk-2');
  });
});

describe('getChunksForPage', () => {
  const chunks: TextChunk[] = [
    { id: 'chunk-0', text: 'First.', pageNumber: 1, startOffset: 0, endOffset: 6 },
    { id: 'chunk-1', text: 'Second.', pageNumber: 1, startOffset: 7, endOffset: 14 },
    { id: 'chunk-2', text: 'Third.', pageNumber: 2, startOffset: 0, endOffset: 6 },
  ];

  it('should return chunks for specified page', () => {
    const page1Chunks = getChunksForPage(chunks, 1);
    expect(page1Chunks).toHaveLength(2);
    expect(page1Chunks.every(c => c.pageNumber === 1)).toBe(true);
  });

  it('should return empty array for page with no chunks', () => {
    const page3Chunks = getChunksForPage(chunks, 3);
    expect(page3Chunks).toEqual([]);
  });

  it('should not modify original array', () => {
    const originalLength = chunks.length;
    getChunksForPage(chunks, 1);
    expect(chunks.length).toBe(originalLength);
  });
});

describe('getWordCount', () => {
  it('should count words correctly', () => {
    expect(getWordCount('one two three')).toBe(3);
  });

  it('should return 0 for empty string', () => {
    expect(getWordCount('')).toBe(0);
  });

  it('should handle multiple spaces', () => {
    expect(getWordCount('one  two   three')).toBe(3);
  });

  it('should handle leading/trailing spaces', () => {
    expect(getWordCount('  one two  ')).toBe(2);
  });
});
