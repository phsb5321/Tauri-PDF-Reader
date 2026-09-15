import { ZOOM_MAX, ZOOM_MIN } from "./constants";

const WHEEL_ZOOM_SENSITIVITY = 0.00125;

/** Continuous multiplicative zoom works for both mouse wheels and trackpads. */
export function nextPdfWheelZoom(current: number, deltaY: number): number {
  if (deltaY === 0) return current;
  const next = current * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY);
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
}
