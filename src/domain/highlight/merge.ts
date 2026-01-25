/**
 * Pure domain logic for highlight merging
 *
 * This module contains algorithms for merging adjacent or overlapping
 * highlight rectangles. No framework dependencies.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Highlight {
  id: string;
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * Check if two rectangles overlap
 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Check if two rectangles are adjacent (touch but don't overlap)
 * Considers rectangles adjacent if they're on the same row and touching horizontally
 */
export function rectsAdjacent(a: Rect, b: Rect, tolerance: number = 1): boolean {
  // Same row (overlapping y ranges)
  const sameRow = a.y < b.y + b.height && a.y + a.height > b.y;

  // Touching x edges (within tolerance)
  const touchingX =
    Math.abs((a.x + a.width) - b.x) <= tolerance ||
    Math.abs((b.x + b.width) - a.x) <= tolerance;

  return sameRow && touchingX && !rectsOverlap(a, b);
}

/**
 * Merge two rectangles into their bounding box
 */
export function mergeRects(a: Rect, b: Rect): Rect {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Calculate the bounding box of multiple rectangles
 */
export function getBoundingBox(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Merge overlapping or adjacent rectangles in a list
 * Uses a simple iterative approach
 */
export function mergeOverlappingRects(rects: Rect[], tolerance: number = 1): Rect[] {
  if (rects.length <= 1) return [...rects];

  const result: Rect[] = [];
  const used = new Set<number>();

  for (let i = 0; i < rects.length; i++) {
    if (used.has(i)) continue;

    let current = { ...rects[i] };
    let merged = true;

    // Keep merging until no more merges possible
    while (merged) {
      merged = false;
      for (let j = 0; j < rects.length; j++) {
        if (i === j || used.has(j)) continue;

        if (rectsOverlap(current, rects[j]) || rectsAdjacent(current, rects[j], tolerance)) {
          current = mergeRects(current, rects[j]);
          used.add(j);
          merged = true;
        }
      }
    }

    used.add(i);
    result.push(current);
  }

  return result;
}

/**
 * Sort rectangles by position (top-to-bottom, left-to-right)
 */
export function sortRects(rects: Rect[]): Rect[] {
  return [...rects].sort((a, b) => {
    // First sort by y (with tolerance for same line)
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 5) return yDiff;
    // Then sort by x
    return a.x - b.x;
  });
}

/**
 * Check if a highlight can be merged with another
 * Highlights can be merged if they:
 * - Are on the same page
 * - Have the same color
 * - Have overlapping or adjacent rects
 */
export function canMergeHighlights(a: Highlight, b: Highlight): boolean {
  // Must be same page and color
  if (a.pageNumber !== b.pageNumber) return false;
  if (a.color !== b.color) return false;

  // Check if any rects overlap or are adjacent
  for (const rectA of a.rects) {
    for (const rectB of b.rects) {
      if (rectsOverlap(rectA, rectB) || rectsAdjacent(rectA, rectB)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Merge two highlights into one
 * Combines rects and text content
 */
export function mergeHighlights(
  base: Highlight,
  other: Highlight,
  newId?: string
): Highlight {
  const combinedRects = mergeOverlappingRects([...base.rects, ...other.rects]);
  const sortedRects = sortRects(combinedRects);

  // Combine text content
  let combinedText: string | null = null;
  if (base.textContent && other.textContent) {
    combinedText = `${base.textContent} ${other.textContent}`;
  } else {
    combinedText = base.textContent || other.textContent;
  }

  // Combine notes
  let combinedNote: string | null = null;
  if (base.note && other.note) {
    combinedNote = `${base.note}\n${other.note}`;
  } else {
    combinedNote = base.note || other.note;
  }

  return {
    id: newId || base.id,
    documentId: base.documentId,
    pageNumber: base.pageNumber,
    rects: sortedRects,
    color: base.color,
    textContent: combinedText,
    note: combinedNote,
    createdAt: base.createdAt < other.createdAt ? base.createdAt : other.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get the area of a rectangle
 */
export function getRectArea(rect: Rect): number {
  return rect.width * rect.height;
}

/**
 * Check if a rectangle is valid (positive width and height)
 */
export function isValidRect(rect: Rect): boolean {
  return rect.width > 0 && rect.height > 0;
}

/**
 * Validate a hex color string
 */
export function isValidHexColor(color: string): boolean {
  if (!color.startsWith('#') || color.length !== 7) {
    return false;
  }
  const hexPart = color.slice(1);
  return /^[0-9a-fA-F]{6}$/.test(hexPart);
}
