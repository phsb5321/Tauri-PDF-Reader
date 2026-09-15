export interface VerticalRect {
  top: number;
  bottom: number;
}

export interface ReadAlongViewport extends VerticalRect {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * Return one clamped absolute scrollTop that places an out-of-band source range
 * at the viewport center. The middle 50% is stable to avoid word-by-word jitter.
 */
export function readingBandScrollTarget(
  range: VerticalRect,
  viewport: ReadAlongViewport,
): number | null {
  const viewportHeight = Math.max(0, viewport.bottom - viewport.top);
  if (viewportHeight === 0 || range.bottom < range.top) return null;
  const bandTop = viewport.top + viewportHeight * 0.25;
  const bandBottom = viewport.bottom - viewportHeight * 0.25;
  if (range.top >= bandTop && range.bottom <= bandBottom) return null;

  const rangeCenter = (range.top + range.bottom) / 2;
  const viewportCenter = (viewport.top + viewport.bottom) / 2;
  const desired = viewport.scrollTop + rangeCenter - viewportCenter;
  const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  return Math.max(0, Math.min(maximum, desired));
}
