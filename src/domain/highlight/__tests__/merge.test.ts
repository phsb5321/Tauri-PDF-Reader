/**
 * Highlight Merge Domain Tests
 *
 * Pure domain logic tests - no Tauri runtime or React hooks needed.
 * These tests should complete in <100ms each.
 */

import { describe, it, expect } from 'vitest';
import {
  rectsOverlap,
  rectsAdjacent,
  mergeRects,
  getBoundingBox,
  mergeOverlappingRects,
  sortRects,
  canMergeHighlights,
  mergeHighlights,
  getRectArea,
  isValidRect,
  isValidHexColor,
  type Rect,
  type Highlight,
} from '../merge';

// Test helpers
function createRect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

function createHighlight(overrides: Partial<Highlight> = {}): Highlight {
  return {
    id: 'hl-1',
    documentId: 'doc-1',
    pageNumber: 1,
    rects: [createRect(0, 0, 100, 20)],
    color: '#FFEB3B',
    textContent: 'Test text',
    note: null,
    createdAt: '2026-01-13T00:00:00Z',
    updatedAt: null,
    ...overrides,
  };
}

describe('rectsOverlap', () => {
  it('should detect overlapping rects', () => {
    const a = createRect(0, 0, 100, 50);
    const b = createRect(50, 25, 100, 50);
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('should return true for symmetric overlap', () => {
    const a = createRect(0, 0, 100, 50);
    const b = createRect(50, 25, 100, 50);
    expect(rectsOverlap(a, b)).toBe(rectsOverlap(b, a));
  });

  it('should return false for non-overlapping rects', () => {
    const a = createRect(0, 0, 50, 50);
    const b = createRect(100, 100, 50, 50);
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('should return false for adjacent rects', () => {
    const a = createRect(0, 0, 50, 50);
    const b = createRect(50, 0, 50, 50); // Touching at x=50
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('should detect partial overlap', () => {
    const a = createRect(0, 0, 100, 100);
    const b = createRect(90, 90, 100, 100); // Small overlap at corner
    expect(rectsOverlap(a, b)).toBe(true);
  });
});

describe('rectsAdjacent', () => {
  it('should detect horizontally adjacent rects', () => {
    const a = createRect(0, 0, 50, 50);
    const b = createRect(50, 0, 50, 50);
    expect(rectsAdjacent(a, b)).toBe(true);
  });

  it('should be symmetric', () => {
    const a = createRect(0, 0, 50, 50);
    const b = createRect(50, 0, 50, 50);
    expect(rectsAdjacent(a, b)).toBe(rectsAdjacent(b, a));
  });

  it('should return false for non-touching rects', () => {
    const a = createRect(0, 0, 50, 50);
    const b = createRect(100, 0, 50, 50); // Gap between them
    expect(rectsAdjacent(a, b)).toBe(false);
  });

  it('should return false for overlapping rects', () => {
    const a = createRect(0, 0, 100, 50);
    const b = createRect(50, 0, 100, 50);
    expect(rectsAdjacent(a, b)).toBe(false);
  });

  it('should use tolerance for adjacency', () => {
    const a = createRect(0, 0, 50, 50);
    const b = createRect(51, 0, 50, 50); // 1px gap
    expect(rectsAdjacent(a, b, 2)).toBe(true);
  });

  it('should require same row', () => {
    const a = createRect(0, 0, 50, 50);
    const b = createRect(50, 100, 50, 50); // Different row
    expect(rectsAdjacent(a, b)).toBe(false);
  });
});

describe('mergeRects', () => {
  it('should create bounding box of two rects', () => {
    const a = createRect(0, 0, 50, 50);
    const b = createRect(50, 0, 50, 50);
    const merged = mergeRects(a, b);
    expect(merged).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it('should handle overlapping rects', () => {
    const a = createRect(0, 0, 100, 50);
    const b = createRect(50, 25, 100, 50);
    const merged = mergeRects(a, b);
    expect(merged.x).toBe(0);
    expect(merged.y).toBe(0);
    expect(merged.width).toBe(150);
    expect(merged.height).toBe(75);
  });

  it('should handle distant rects', () => {
    const a = createRect(0, 0, 10, 10);
    const b = createRect(100, 100, 10, 10);
    const merged = mergeRects(a, b);
    expect(merged).toEqual({ x: 0, y: 0, width: 110, height: 110 });
  });
});

describe('getBoundingBox', () => {
  it('should return null for empty array', () => {
    expect(getBoundingBox([])).toBeNull();
  });

  it('should return same rect for single item', () => {
    const rect = createRect(10, 20, 30, 40);
    expect(getBoundingBox([rect])).toEqual(rect);
  });

  it('should calculate bounding box of multiple rects', () => {
    const rects = [
      createRect(0, 0, 50, 50),
      createRect(100, 100, 50, 50),
    ];
    const bbox = getBoundingBox(rects);
    expect(bbox).toEqual({ x: 0, y: 0, width: 150, height: 150 });
  });
});

describe('mergeOverlappingRects', () => {
  it('should return empty array for empty input', () => {
    expect(mergeOverlappingRects([])).toEqual([]);
  });

  it('should return same rect for single item', () => {
    const rects = [createRect(0, 0, 50, 50)];
    const result = mergeOverlappingRects(rects);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(rects[0]);
  });

  it('should merge overlapping rects', () => {
    const rects = [
      createRect(0, 0, 100, 50),
      createRect(50, 0, 100, 50),
    ];
    const result = mergeOverlappingRects(rects);
    expect(result).toHaveLength(1);
    expect(result[0].width).toBe(150);
  });

  it('should merge adjacent rects', () => {
    const rects = [
      createRect(0, 0, 50, 50),
      createRect(50, 0, 50, 50),
    ];
    const result = mergeOverlappingRects(rects);
    expect(result).toHaveLength(1);
  });

  it('should not merge non-adjacent rects', () => {
    const rects = [
      createRect(0, 0, 50, 50),
      createRect(200, 0, 50, 50),
    ];
    const result = mergeOverlappingRects(rects);
    expect(result).toHaveLength(2);
  });

  it('should handle chain of overlapping rects', () => {
    const rects = [
      createRect(0, 0, 50, 50),
      createRect(40, 0, 50, 50),
      createRect(80, 0, 50, 50),
    ];
    const result = mergeOverlappingRects(rects);
    expect(result).toHaveLength(1);
    expect(result[0].width).toBe(130);
  });
});

describe('sortRects', () => {
  it('should sort by y then x', () => {
    const rects = [
      createRect(100, 0, 50, 50),
      createRect(0, 0, 50, 50),
      createRect(0, 100, 50, 50),
    ];
    const sorted = sortRects(rects);
    expect(sorted[0].x).toBe(0);
    expect(sorted[0].y).toBe(0);
    expect(sorted[1].x).toBe(100);
    expect(sorted[1].y).toBe(0);
    expect(sorted[2].y).toBe(100);
  });

  it('should not modify original array', () => {
    const rects = [createRect(100, 0, 50, 50), createRect(0, 0, 50, 50)];
    const original = [...rects];
    sortRects(rects);
    expect(rects).toEqual(original);
  });

  it('should handle same y with different x', () => {
    const rects = [
      createRect(100, 10, 50, 50),
      createRect(0, 10, 50, 50),
    ];
    const sorted = sortRects(rects);
    expect(sorted[0].x).toBe(0);
    expect(sorted[1].x).toBe(100);
  });
});

describe('canMergeHighlights', () => {
  it('should return true for same page and color with adjacent rects', () => {
    const a = createHighlight({
      rects: [createRect(0, 0, 50, 50)],
      pageNumber: 1,
      color: '#FFEB3B',
    });
    const b = createHighlight({
      rects: [createRect(50, 0, 50, 50)],
      pageNumber: 1,
      color: '#FFEB3B',
    });
    expect(canMergeHighlights(a, b)).toBe(true);
  });

  it('should return false for different pages', () => {
    const a = createHighlight({ pageNumber: 1 });
    const b = createHighlight({ pageNumber: 2 });
    expect(canMergeHighlights(a, b)).toBe(false);
  });

  it('should return false for different colors', () => {
    const a = createHighlight({ color: '#FFEB3B' });
    const b = createHighlight({ color: '#FF0000' });
    expect(canMergeHighlights(a, b)).toBe(false);
  });

  it('should return false for non-adjacent rects', () => {
    const a = createHighlight({
      rects: [createRect(0, 0, 50, 50)],
    });
    const b = createHighlight({
      rects: [createRect(200, 0, 50, 50)],
    });
    expect(canMergeHighlights(a, b)).toBe(false);
  });
});

describe('mergeHighlights', () => {
  it('should combine rects', () => {
    const a = createHighlight({
      rects: [createRect(0, 0, 50, 50)],
    });
    const b = createHighlight({
      rects: [createRect(50, 0, 50, 50)],
    });
    const merged = mergeHighlights(a, b);
    expect(merged.rects.length).toBeGreaterThanOrEqual(1);
  });

  it('should combine text content', () => {
    const a = createHighlight({ textContent: 'Hello' });
    const b = createHighlight({ textContent: 'World' });
    const merged = mergeHighlights(a, b);
    expect(merged.textContent).toBe('Hello World');
  });

  it('should handle null text content', () => {
    const a = createHighlight({ textContent: 'Hello' });
    const b = createHighlight({ textContent: null });
    const merged = mergeHighlights(a, b);
    expect(merged.textContent).toBe('Hello');
  });

  it('should combine notes', () => {
    const a = createHighlight({ note: 'Note 1' });
    const b = createHighlight({ note: 'Note 2' });
    const merged = mergeHighlights(a, b);
    expect(merged.note).toContain('Note 1');
    expect(merged.note).toContain('Note 2');
  });

  it('should use earlier createdAt', () => {
    const a = createHighlight({ createdAt: '2026-01-13T00:00:00Z' });
    const b = createHighlight({ createdAt: '2026-01-12T00:00:00Z' });
    const merged = mergeHighlights(a, b);
    expect(merged.createdAt).toBe('2026-01-12T00:00:00Z');
  });

  it('should use custom ID if provided', () => {
    const a = createHighlight({ id: 'a' });
    const b = createHighlight({ id: 'b' });
    const merged = mergeHighlights(a, b, 'custom-id');
    expect(merged.id).toBe('custom-id');
  });
});

describe('getRectArea', () => {
  it('should calculate area correctly', () => {
    expect(getRectArea(createRect(0, 0, 10, 20))).toBe(200);
  });

  it('should return 0 for zero dimensions', () => {
    expect(getRectArea(createRect(0, 0, 0, 10))).toBe(0);
    expect(getRectArea(createRect(0, 0, 10, 0))).toBe(0);
  });
});

describe('isValidRect', () => {
  it('should return true for valid rect', () => {
    expect(isValidRect(createRect(0, 0, 100, 50))).toBe(true);
  });

  it('should return false for zero width', () => {
    expect(isValidRect(createRect(0, 0, 0, 50))).toBe(false);
  });

  it('should return false for zero height', () => {
    expect(isValidRect(createRect(0, 0, 100, 0))).toBe(false);
  });

  it('should return false for negative dimensions', () => {
    expect(isValidRect(createRect(0, 0, -10, 50))).toBe(false);
    expect(isValidRect(createRect(0, 0, 100, -10))).toBe(false);
  });

  it('should allow negative position', () => {
    expect(isValidRect(createRect(-10, -20, 100, 50))).toBe(true);
  });
});

describe('isValidHexColor', () => {
  it('should return true for valid hex colors', () => {
    expect(isValidHexColor('#FFEB3B')).toBe(true);
    expect(isValidHexColor('#000000')).toBe(true);
    expect(isValidHexColor('#ffffff')).toBe(true);
    expect(isValidHexColor('#4CAF50')).toBe(true);
  });

  it('should return false for missing hash', () => {
    expect(isValidHexColor('FFEB3B')).toBe(false);
  });

  it('should return false for short format', () => {
    expect(isValidHexColor('#FFF')).toBe(false);
  });

  it('should return false for invalid hex', () => {
    expect(isValidHexColor('#GGGGGG')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidHexColor('')).toBe(false);
  });
});
