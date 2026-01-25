/**
 * Unit tests for coordinate transform utilities
 *
 * Validates that selection coordinates are correctly normalized and scaled
 * for highlight storage and rendering at various zoom levels.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeRects,
  scaleRects,
  mergeAdjacentRects,
  domRectsToRects,
  type Rect,
} from '../../lib/coordinate-transform';

describe('coordinate-transform', () => {
  describe('normalizeRects', () => {
    it('divides coordinates by scale to get PDF space', () => {
      const rects: Rect[] = [
        { x: 100, y: 200, width: 50, height: 20 },
      ];
      const scale = 2.0;

      const normalized = normalizeRects(rects, scale);

      expect(normalized[0]).toEqual({
        x: 50,
        y: 100,
        width: 25,
        height: 10,
      });
    });

    it('returns same rects at scale 1.0', () => {
      const rects: Rect[] = [
        { x: 100, y: 200, width: 50, height: 20 },
      ];

      const normalized = normalizeRects(rects, 1.0);

      expect(normalized[0]).toEqual(rects[0]);
    });

    it('handles common zoom levels correctly', () => {
      const viewportRect: Rect = { x: 150, y: 300, width: 60, height: 18 };

      // 150% zoom
      const at150 = normalizeRects([viewportRect], 1.5);
      expect(at150[0].x).toBe(100);
      expect(at150[0].y).toBe(200);
      expect(at150[0].width).toBe(40);
      expect(at150[0].height).toBe(12);

      // 75% zoom
      const at75 = normalizeRects([viewportRect], 0.75);
      expect(at75[0].x).toBe(200);
      expect(at75[0].y).toBe(400);
      expect(at75[0].width).toBe(80);
      expect(at75[0].height).toBe(24);
    });

    it('returns original rects for invalid scale', () => {
      const rects: Rect[] = [
        { x: 100, y: 200, width: 50, height: 20 },
      ];

      const resultZero = normalizeRects(rects, 0);
      expect(resultZero).toEqual(rects);

      const resultNegative = normalizeRects(rects, -1);
      expect(resultNegative).toEqual(rects);
    });
  });

  describe('scaleRects', () => {
    it('multiplies coordinates by scale for rendering', () => {
      const pdfRects: Rect[] = [
        { x: 50, y: 100, width: 25, height: 10 },
      ];
      const scale = 2.0;

      const scaled = scaleRects(pdfRects, scale);

      expect(scaled[0]).toEqual({
        x: 100,
        y: 200,
        width: 50,
        height: 20,
      });
    });

    it('returns same rects at scale 1.0', () => {
      const rects: Rect[] = [
        { x: 50, y: 100, width: 25, height: 10 },
      ];

      const scaled = scaleRects(rects, 1.0);

      expect(scaled[0]).toEqual(rects[0]);
    });

    it('roundtrips correctly: normalize then scale', () => {
      const originalViewportRect: Rect = { x: 150, y: 300, width: 60, height: 18 };
      const captureScale = 1.5;
      const renderScale = 1.5;

      // Capture: viewport -> PDF space
      const normalized = normalizeRects([originalViewportRect], captureScale);

      // Render: PDF space -> viewport
      const rendered = scaleRects(normalized, renderScale);

      expect(rendered[0].x).toBeCloseTo(originalViewportRect.x, 5);
      expect(rendered[0].y).toBeCloseTo(originalViewportRect.y, 5);
      expect(rendered[0].width).toBeCloseTo(originalViewportRect.width, 5);
      expect(rendered[0].height).toBeCloseTo(originalViewportRect.height, 5);
    });

    it('maintains alignment at different render scales', () => {
      // Simulate: capture at 1.5x, render at 2.0x
      const viewportRect: Rect = { x: 150, y: 300, width: 60, height: 18 };
      const captureScale = 1.5;
      const renderScale = 2.0;

      // Normalize to PDF space
      const pdfRect = normalizeRects([viewportRect], captureScale)[0];

      // Scale to new viewport
      const renderedRect = scaleRects([pdfRect], renderScale)[0];

      // Expected: (150/1.5)*2.0 = 200, etc.
      expect(renderedRect.x).toBe(200);
      expect(renderedRect.y).toBe(400);
      expect(renderedRect.width).toBe(80);
      expect(renderedRect.height).toBe(24);
    });
  });

  describe('domRectsToRects', () => {
    it('converts DOMRect array to Rect array', () => {
      // DOMRect-like objects
      const domRects = [
        { x: 10, y: 20, width: 100, height: 15 } as DOMRect,
        { x: 10, y: 40, width: 80, height: 15 } as DOMRect,
      ];

      const rects = domRectsToRects(domRects);

      expect(rects).toHaveLength(2);
      expect(rects[0]).toEqual({ x: 10, y: 20, width: 100, height: 15 });
      expect(rects[1]).toEqual({ x: 10, y: 40, width: 80, height: 15 });
    });
  });

  describe('mergeAdjacentRects', () => {
    it('merges horizontally adjacent rects on same line', () => {
      const rects: Rect[] = [
        { x: 10, y: 20, width: 50, height: 15 },
        { x: 60, y: 20, width: 40, height: 15 },
      ];

      const merged = mergeAdjacentRects(rects);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({ x: 10, y: 20, width: 90, height: 15 });
    });

    it('keeps separate rects on different lines', () => {
      const rects: Rect[] = [
        { x: 10, y: 20, width: 50, height: 15 },
        { x: 10, y: 50, width: 40, height: 15 },
      ];

      const merged = mergeAdjacentRects(rects);

      expect(merged).toHaveLength(2);
    });

    it('merges with tolerance for slightly misaligned rects', () => {
      const rects: Rect[] = [
        { x: 10, y: 20, width: 50, height: 15 },
        { x: 62, y: 21, width: 40, height: 15 }, // 1px gap, 1px y offset
      ];

      const merged = mergeAdjacentRects(rects, 2);

      expect(merged).toHaveLength(1);
      expect(merged[0].x).toBe(10);
      expect(merged[0].width).toBe(92);
    });

    it('returns empty array for empty input', () => {
      expect(mergeAdjacentRects([])).toEqual([]);
    });

    it('returns single rect unchanged', () => {
      const rects: Rect[] = [{ x: 10, y: 20, width: 50, height: 15 }];
      expect(mergeAdjacentRects(rects)).toEqual(rects);
    });
  });

  describe('highlight alignment accuracy', () => {
    it('maintains 2-pixel accuracy at extreme zoom levels', () => {
      // Requirement: highlights aligned within 2 pixels at all zoom levels
      const pdfRect: Rect = { x: 100, y: 200, width: 50, height: 15 };

      // Test zoom levels from 50% to 300%
      const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

      for (const zoom of zoomLevels) {
        const scaled = scaleRects([pdfRect], zoom)[0];
        const normalized = normalizeRects([scaled], zoom)[0];

        // Check roundtrip accuracy
        expect(Math.abs(normalized.x - pdfRect.x)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(normalized.y - pdfRect.y)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(normalized.width - pdfRect.width)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(normalized.height - pdfRect.height)).toBeLessThanOrEqual(0.01);
      }
    });
  });
});
