/**
 * Unit tests for the prefers-reduced-motion accessibility helpers (spec 023).
 * Drives the karaoke scroll-to-word behavior: smooth normally, instant when the
 * user opts out of motion.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  prefersReducedMotion,
  reducedMotionScrollBehavior,
} from "../../lib/reduced-motion";

function stubMatchMedia(matches: boolean) {
  const fn = vi.fn(() => ({ matches }) as unknown as MediaQueryList);
  vi.stubGlobal("matchMedia", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prefersReducedMotion", () => {
  it("is true when the media query matches", () => {
    const fn = stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(fn).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("is false when the media query does not match", () => {
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("is false (no throw) when globalThis.matchMedia is absent (Node/SSR/worker)", () => {
    // The helper reads globalThis.matchMedia; with it undefined the lone guard
    // returns false — the only no-DOM safety branch, exercised here.
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("reducedMotionScrollBehavior", () => {
  it("is 'auto' when reduced motion is requested", () => {
    stubMatchMedia(true);
    expect(reducedMotionScrollBehavior()).toBe("auto");
  });

  it("is 'smooth' otherwise", () => {
    stubMatchMedia(false);
    expect(reducedMotionScrollBehavior()).toBe("smooth");
  });
});
