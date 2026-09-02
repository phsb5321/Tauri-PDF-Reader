/**
 * Zoom preview geometry.
 *
 * Rasterizing a PDF page at a new scale costs tens of milliseconds and is
 * debounced, so a naive viewer leaves the old page sitting at the old size and
 * then jumps. pdf.js avoids that by scaling the already-rendered canvas with a
 * CSS transform for immediate feedback and swapping in the sharp canvas once
 * the real render lands (`PDFPageView.update` → `cssTransform`).
 *
 * The transform is visual only: it never changes the viewport used for text
 * layer geometry, highlight coordinates, or PDF source offsets.
 */

export interface ZoomPreview {
  /** Ratio between the requested zoom and the zoom the canvas was drawn at. */
  ratio: number;
  /** CSS transform that scales the rendered canvas to the requested zoom. */
  transform: string;
  /** Scaling from the top-left keeps the page anchored to its container. */
  transformOrigin: string;
}

/**
 * Describe the preview needed to show `targetZoom` using pixels rasterized at
 * `renderedZoom`, or `null` when no preview applies — equal zooms, a page that
 * has not been rendered yet, or non-finite input.
 */
export function zoomPreview(
  renderedZoom: number,
  targetZoom: number,
): ZoomPreview | null {
  if (!Number.isFinite(renderedZoom) || !Number.isFinite(targetZoom)) {
    return null;
  }
  if (renderedZoom <= 0 || targetZoom <= 0) return null;

  const ratio = targetZoom / renderedZoom;
  // Sub-pixel ratios are indistinguishable from an identity transform and
  // would only cost a compositor layer.
  if (Math.abs(ratio - 1) < 0.001) return null;

  return {
    ratio,
    transform: `scale(${ratio})`,
    transformOrigin: "top left",
  };
}
