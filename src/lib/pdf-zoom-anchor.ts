interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfZoomAnchor {
  pageNumber: number;
  targetZoom: number;
  pageX: number;
  pageY: number;
  viewportX: number;
  viewportY: number;
}

interface ScrollGeometry {
  left: number;
  top: number;
  maxLeft: number;
  maxTop: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

/** Capture the PDF point under a pointer, or the visible page centre. */
export function capturePdfZoomAnchor(
  page: RectLike,
  viewer: RectLike,
  pageNumber: number,
  targetZoom: number,
  origin?: { x: number; y: number },
): PdfZoomAnchor | null {
  if (page.width <= 0 || page.height <= 0) return null;

  const x = clamp(
    origin?.x ?? viewer.left + viewer.width / 2,
    page.left,
    page.left + page.width,
  );
  const y = clamp(
    origin?.y ?? viewer.top + viewer.height / 2,
    page.top,
    page.top + page.height,
  );

  return {
    pageNumber,
    targetZoom,
    pageX: (x - page.left) / page.width,
    pageY: (y - page.top) / page.height,
    viewportX: x - viewer.left,
    viewportY: y - viewer.top,
  };
}

/** Restore the captured PDF point after target CSS geometry commits. */
export function restorePdfZoomAnchor(
  anchor: PdfZoomAnchor,
  page: RectLike,
  viewer: Pick<RectLike, "left" | "top">,
  scroll: ScrollGeometry,
): { left: number; top: number } {
  const anchoredX = page.left + anchor.pageX * page.width;
  const anchoredY = page.top + anchor.pageY * page.height;
  const desiredX = viewer.left + anchor.viewportX;
  const desiredY = viewer.top + anchor.viewportY;

  return {
    left: clamp(scroll.left + anchoredX - desiredX, 0, scroll.maxLeft),
    top: clamp(scroll.top + anchoredY - desiredY, 0, scroll.maxTop),
  };
}
