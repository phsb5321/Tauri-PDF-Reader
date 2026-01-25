/**
 * RenderPolicy - Central render calculation logic
 *
 * Pure domain logic for computing optimal rendering parameters.
 * No side effects, no I/O - just calculations based on inputs.
 */

import type { DisplayInfo, RenderPlan, RenderSettings } from './types';
import { RENDER_CONSTANTS } from './types';
import { getMinOutputScale } from './QualityMode';

/**
 * Input parameters for calculating a render plan
 */
export interface RenderPlanInput {
  /** PDF page width in points */
  pageWidth: number;
  /** PDF page height in points */
  pageHeight: number;
  /** User zoom level (1.0 = 100%) */
  zoomLevel: number;
  /** Current render settings */
  settings: RenderSettings;
  /** Current display info */
  displayInfo: DisplayInfo;
}

/**
 * Input parameters for fit mode calculations
 */
export interface FitModeInput {
  /** PDF page width in points */
  pageWidth: number;
  /** PDF page height in points */
  pageHeight: number;
  /** Container width in CSS pixels */
  containerWidth: number;
  /** Container height in CSS pixels */
  containerHeight: number;
  /** Padding to leave around the page (CSS pixels) */
  padding?: number;
}

/**
 * Calculate the optimal output scale that stays within megapixel limits
 * Uses a fallback cascade to find the highest acceptable scale
 */
export function calculateOptimalOutputScale(
  viewportWidth: number,
  viewportHeight: number,
  targetScale: number,
  maxMegapixels: number
): { outputScale: number; wasCapped: boolean } {
  // Try the target scale first
  let outputScale = targetScale;
  let wasCapped = false;

  // Calculate megapixels at target scale
  let canvasWidth = Math.floor(viewportWidth * outputScale);
  let canvasHeight = Math.floor(viewportHeight * outputScale);
  let megapixels = (canvasWidth * canvasHeight) / RENDER_CONSTANTS.MEGAPIXEL_DIVISOR;

  // If maxMegapixels is 0, no cap - return target scale immediately
  if (maxMegapixels === 0) {
    return { outputScale, wasCapped: false };
  }

  // If under limit, we're done
  if (megapixels <= maxMegapixels) {
    return { outputScale, wasCapped: false };
  }

  // Find the highest scale from fallback cascade that fits
  wasCapped = true;
  for (const fallbackScale of RENDER_CONSTANTS.FALLBACK_SCALES) {
    if (fallbackScale >= targetScale) continue; // Skip scales >= target

    outputScale = fallbackScale;
    canvasWidth = Math.floor(viewportWidth * outputScale);
    canvasHeight = Math.floor(viewportHeight * outputScale);
    megapixels = (canvasWidth * canvasHeight) / RENDER_CONSTANTS.MEGAPIXEL_DIVISOR;

    if (megapixels <= maxMegapixels) {
      break;
    }
  }

  // Ensure minimum scale of 1
  if (outputScale < 1) {
    outputScale = 1;
  }

  return { outputScale, wasCapped };
}

/**
 * Calculate memory usage for a canvas in MB
 */
export function calculateMemoryMB(canvasWidth: number, canvasHeight: number): number {
  const bytes = canvasWidth * canvasHeight * RENDER_CONSTANTS.BYTES_PER_PIXEL;
  return bytes / RENDER_CONSTANTS.MEGABYTE_DIVISOR;
}

/**
 * Calculate megapixels for canvas dimensions
 */
export function calculateMegapixels(canvasWidth: number, canvasHeight: number): number {
  return (canvasWidth * canvasHeight) / RENDER_CONSTANTS.MEGAPIXEL_DIVISOR;
}

/**
 * Calculate a complete render plan for a page
 *
 * This is the main entry point for render calculations.
 * Given page dimensions, zoom level, settings, and display info,
 * it computes all the parameters needed to render the page.
 */
export function calculateRenderPlan(input: RenderPlanInput): RenderPlan {
  const { pageWidth, pageHeight, zoomLevel, settings, displayInfo } = input;

  // Calculate viewport dimensions (CSS pixels) based on page size and zoom
  const viewportWidth = pageWidth * zoomLevel;
  const viewportHeight = pageHeight * zoomLevel;

  // Get the target output scale based on quality mode and DPR
  const targetOutputScale = getMinOutputScale(settings.qualityMode, displayInfo.devicePixelRatio);

  // Calculate optimal output scale with megapixel capping
  const { outputScale, wasCapped } = calculateOptimalOutputScale(
    viewportWidth,
    viewportHeight,
    targetOutputScale,
    settings.maxMegapixels
  );

  // Calculate physical canvas dimensions
  const canvasWidth = Math.floor(viewportWidth * outputScale);
  const canvasHeight = Math.floor(viewportHeight * outputScale);

  // Calculate metrics
  const megapixels = calculateMegapixels(canvasWidth, canvasHeight);
  const memoryMB = calculateMemoryMB(canvasWidth, canvasHeight);

  return {
    zoomLevel,
    outputScale,
    viewportWidth,
    viewportHeight,
    canvasWidth,
    canvasHeight,
    megapixels,
    memoryMB,
    wasCapped,
  };
}

/**
 * Calculate zoom level for fit-to-width mode
 *
 * Calculates the zoom level that makes the page fill the container width.
 */
export function calculateFitWidthZoom(input: FitModeInput): number {
  const { pageWidth, containerWidth, padding = 0 } = input;
  const availableWidth = containerWidth - padding * 2;

  if (pageWidth <= 0 || availableWidth <= 0) {
    return 1.0;
  }

  return availableWidth / pageWidth;
}

/**
 * Calculate zoom level for fit-to-page mode
 *
 * Calculates the zoom level that makes the entire page visible in the container.
 */
export function calculateFitPageZoom(input: FitModeInput): number {
  const { pageWidth, pageHeight, containerWidth, containerHeight, padding = 0 } = input;
  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;

  if (pageWidth <= 0 || pageHeight <= 0 || availableWidth <= 0 || availableHeight <= 0) {
    return 1.0;
  }

  const widthRatio = availableWidth / pageWidth;
  const heightRatio = availableHeight / pageHeight;

  // Use the smaller ratio to ensure entire page fits
  return Math.min(widthRatio, heightRatio);
}

/**
 * Format debug overlay data for display
 */
export function formatDebugOverlayData(
  plan: RenderPlan,
  settings: RenderSettings,
  displayInfo: DisplayInfo
): {
  viewport: string;
  canvas: string;
  megapixels: string;
  memory: string;
  qualityMode: string;
  outputScale: string;
  dpr: string;
  capped: string;
} {
  return {
    viewport: `${Math.round(plan.viewportWidth)}x${Math.round(plan.viewportHeight)}`,
    canvas: `${plan.canvasWidth}x${plan.canvasHeight}`,
    megapixels: `${plan.megapixels.toFixed(1)} MP`,
    memory: `~${Math.round(plan.memoryMB)} MB`,
    qualityMode: settings.qualityMode.charAt(0).toUpperCase() + settings.qualityMode.slice(1),
    outputScale: `${plan.outputScale.toFixed(1)}x`,
    dpr: `${displayInfo.devicePixelRatio.toFixed(1)}x`,
    capped: plan.wasCapped ? 'Yes' : 'No',
  };
}

/**
 * Get the transform matrix for PDF.js rendering
 *
 * When outputScale !== 1, we need to apply a transform matrix
 * to the canvas context for proper HiDPI rendering.
 */
export function getTransformMatrix(outputScale: number): [number, number, number, number, number, number] | undefined {
  if (outputScale === 1) {
    return undefined;
  }
  return [outputScale, 0, 0, outputScale, 0, 0];
}

/**
 * Input for calculating fit zoom for multiple pages (mixed page sizes)
 */
export interface FitModeMultiPageInput {
  /** Array of page dimensions [width, height] in points */
  pageDimensions: Array<[number, number]>;
  /** Container width in CSS pixels */
  containerWidth: number;
  /** Container height in CSS pixels */
  containerHeight: number;
  /** Padding to leave around the page (CSS pixels) */
  padding?: number;
}

/**
 * Calculate fit-to-width zoom for documents with mixed page sizes
 *
 * For mixed page sizes, we use the widest page to ensure all pages
 * fit within the container width without horizontal scrolling.
 */
export function calculateFitWidthZoomMultiPage(input: FitModeMultiPageInput): number {
  const { pageDimensions, containerWidth, padding = 0 } = input;

  if (pageDimensions.length === 0) {
    return 1.0;
  }

  // Find the widest page
  const maxWidth = Math.max(...pageDimensions.map(([w]) => w));

  return calculateFitWidthZoom({
    pageWidth: maxWidth,
    pageHeight: 0, // Not used for fit-width
    containerWidth,
    containerHeight: 0, // Not used for fit-width
    padding,
  });
}

/**
 * Calculate fit-to-page zoom for documents with mixed page sizes
 *
 * For mixed page sizes, we use the largest page (by diagonal) to ensure
 * all pages fit within the container. This handles both wider and taller pages.
 */
export function calculateFitPageZoomMultiPage(input: FitModeMultiPageInput): number {
  const { pageDimensions, containerWidth, containerHeight, padding = 0 } = input;

  if (pageDimensions.length === 0) {
    return 1.0;
  }

  // Calculate zoom for each page and use the smallest zoom
  // This ensures all pages fit within the container
  const zooms = pageDimensions.map(([pageWidth, pageHeight]) =>
    calculateFitPageZoom({
      pageWidth,
      pageHeight,
      containerWidth,
      containerHeight,
      padding,
    })
  );

  return Math.min(...zooms);
}
