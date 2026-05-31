/**
 * Accessibility helper for `prefers-reduced-motion`.
 *
 * Returns whether the user has asked the OS to reduce motion
 * (`prefers-reduced-motion: reduce`). Reads `globalThis.matchMedia`, which is
 * the universal global in browsers, Node/SSR, and workers — so the single
 * `typeof … !== "function"` guard covers every no-DOM environment and returns
 * `false` there (no throw). This is a pure point-in-time read (no listener) —
 * callers query it at the moment they would animate (e.g. choosing a scroll
 * behavior), so a mid-session change to the OS setting is honored on the next
 * call without any subscription bookkeeping.
 */
export function prefersReducedMotion(): boolean {
  if (typeof globalThis.matchMedia !== "function") {
    return false;
  }
  return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Resolve a `ScrollBehavior` that respects the reduced-motion preference:
 * `"auto"` (instant jump) when reduced motion is requested, else `"smooth"`.
 */
export function reducedMotionScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}
