/**
 * Coordinate Transform Utilities
 *
 * Handles coordinate transformations between PDF coordinate space (scale=1.0)
 * and screen pixel space (current viewport scale).
 *
 * All highlights are stored in normalized PDF coordinates (scale=1.0) to ensure
 * they remain aligned with text across zoom levels.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Normalize rectangles from current viewport scale to PDF coordinate space (scale=1.0)
 *
 * @param rects - Array of rectangles in current viewport scale
 * @param scale - Current viewport scale (e.g., 1.5 for 150% zoom)
 * @returns Array of rectangles in PDF coordinate space (scale=1.0)
 */
export function normalizeRects(rects: Rect[], scale: number): Rect[] {
  if (scale <= 0) {
    console.warn('[coordinate-transform] Invalid scale:', scale, 'defaulting to 1.0');
    return rects;
  }

  if (scale === 1.0) {
    return rects;
  }

  return rects.map((rect) => ({
    x: rect.x / scale,
    y: rect.y / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  }));
}

/**
 * Scale rectangles from PDF coordinate space (scale=1.0) to target viewport scale
 *
 * @param rects - Array of rectangles in PDF coordinate space (scale=1.0)
 * @param toScale - Target viewport scale (e.g., 1.5 for 150% zoom)
 * @returns Array of rectangles in target viewport scale
 */
export function scaleRects(rects: Rect[], toScale: number): Rect[] {
  if (toScale <= 0) {
    console.warn('[coordinate-transform] Invalid toScale:', toScale, 'defaulting to 1.0');
    return rects;
  }

  if (toScale === 1.0) {
    return rects;
  }

  return rects.map((rect) => ({
    x: rect.x * toScale,
    y: rect.y * toScale,
    width: rect.width * toScale,
    height: rect.height * toScale,
  }));
}

/**
 * Convert DOMRect objects to our Rect type
 *
 * @param domRects - Array of DOMRect objects from selection
 * @returns Array of Rect objects
 */
export function domRectsToRects(domRects: DOMRect[]): Rect[] {
  return domRects.map((domRect) => ({
    x: domRect.x,
    y: domRect.y,
    width: domRect.width,
    height: domRect.height,
  }));
}

/**
 * Merge overlapping or adjacent rectangles to reduce storage and rendering overhead
 *
 * @param rects - Array of rectangles to merge
 * @param tolerance - Pixel tolerance for considering rects adjacent (default: 2)
 * @returns Array of merged rectangles
 */
export function mergeAdjacentRects(rects: Rect[], tolerance: number = 2): Rect[] {
  if (rects.length <= 1) {
    return rects;
  }

  // Sort by y, then x for predictable merging
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(a.y - b.y) < tolerance) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  const merged: Rect[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if on same line and adjacent/overlapping
    const sameRow = Math.abs(current.y - next.y) < tolerance;
    const adjacent = next.x <= current.x + current.width + tolerance;

    if (sameRow && adjacent) {
      // Merge: extend current rect to include next
      const newRight = Math.max(current.x + current.width, next.x + next.width);
      current.width = newRight - current.x;
      current.height = Math.max(current.height, next.height);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}
