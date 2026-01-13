import { useMemo } from 'react';
import type { TextChunk } from '../../lib/text-chunking';
import './TtsHighlight.css';

interface TtsHighlightProps {
  chunk: TextChunk | null;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
  textItems?: Array<{
    str: string;
    transform: number[];
    width: number;
    height: number;
  }>;
}

interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * TTS Highlight overlay component
 * Shows visual indication of currently spoken text
 */
export function TtsHighlight({
  chunk,
  scale,
  viewportWidth,
  viewportHeight,
  textItems,
}: TtsHighlightProps) {
  // Calculate highlight rectangles based on text position
  const highlightRects = useMemo((): HighlightRect[] => {
    if (!chunk || !textItems || textItems.length === 0) {
      return [];
    }

    // Find text items that match the chunk text
    const chunkWords = chunk.text.toLowerCase().split(/\s+/);
    const rects: HighlightRect[] = [];

    let wordIndex = 0;
    let accumulatedText = '';

    for (const item of textItems) {
      if (!item.str.trim()) continue;

      accumulatedText += item.str + ' ';

      // Check if this text item contains words from the chunk
      const itemWords = item.str.toLowerCase().split(/\s+/).filter(w => w);

      for (const word of itemWords) {
        if (wordIndex < chunkWords.length && chunkWords[wordIndex].includes(word)) {
          // This item contains part of the chunk - add its rect
          const [scaleX, , , scaleY, tx, ty] = item.transform;
          const fontSize = Math.sqrt(scaleX * scaleX + scaleY * scaleY);

          rects.push({
            x: tx * scale,
            y: viewportHeight - ty * scale - fontSize * scale,
            width: item.width * scale,
            height: fontSize * scale * 1.2,
          });

          wordIndex++;
          break;
        }
      }

      // If we've matched enough words, we can stop
      if (wordIndex >= chunkWords.length) {
        break;
      }
    }

    // Merge adjacent rectangles on the same line
    return mergeRects(rects);
  }, [chunk, textItems, scale, viewportHeight]);

  if (!chunk || highlightRects.length === 0) {
    return null;
  }

  return (
    <div
      className="tts-highlight-container"
      style={{ width: viewportWidth, height: viewportHeight }}
    >
      {highlightRects.map((rect, index) => (
        <div
          key={index}
          className="tts-highlight-rect"
          style={{
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Merge rectangles that are on the same line and adjacent
 */
function mergeRects(rects: HighlightRect[]): HighlightRect[] {
  if (rects.length <= 1) return rects;

  const sorted = [...rects].sort((a, b) => {
    // Sort by Y position first, then X
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 5) return yDiff;
    return a.x - b.x;
  });

  const merged: HighlightRect[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if on same line and adjacent
    const sameLine = Math.abs(current.y - next.y) < 5;
    const adjacent = next.x <= current.x + current.width + 10;

    if (sameLine && adjacent) {
      // Merge rectangles
      const newWidth = Math.max(
        current.x + current.width,
        next.x + next.width
      ) - current.x;
      current = {
        x: current.x,
        y: Math.min(current.y, next.y),
        width: newWidth,
        height: Math.max(current.height, next.height),
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}
