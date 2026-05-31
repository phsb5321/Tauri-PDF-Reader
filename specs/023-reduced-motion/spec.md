# Spec 023 — Reduced-Motion for Karaoke Scroll-to-Word (P1 #7 pt.2)

## Problem

P1 #7 quality gap (from spec 022's analysis): `AiPlaybackBar`'s scroll-to-word
called `scrollIntoView({ behavior: "smooth" })` unconditionally, so the viewport
animates a smooth scroll to follow the karaoke highlight **even for users who
set `prefers-reduced-motion: reduce`** — an accessibility regression and a
violation of the project's reduced-motion-aware UI rule.

## Decision

Add a pure helper `src/lib/reduced-motion.ts`:
- `prefersReducedMotion(): boolean` — reads `globalThis.matchMedia` (universal
  across browser / Node / SSR / worker), guarded so it returns `false` with no
  throw when `matchMedia` is absent. Point-in-time read (no listener), so a
  mid-session OS change is honored on the next call.
- `reducedMotionScrollBehavior(): ScrollBehavior` — `"auto"` under reduced
  motion, else `"smooth"`.

Use `reducedMotionScrollBehavior()` for both `scrollIntoView` calls in
`AiPlaybackBar.scrollToWord`.

## Scope

- `src/lib/reduced-motion.ts` (new), `src/components/playback-bar/AiPlaybackBar.tsx`
  (use the helper), `src/__tests__/unit/reduced-motion.test.ts` (5 tests).

No new deps, no Tauri scope/capability change, no boundary impact. Frontend only.

## Verification

- `pnpm lint` 0 errors; `pnpm typecheck` exit 0; `pnpm exec vitest run
  …reduced-motion.test.ts` → 5/5 pass (matchMedia true/false, exact query
  string, no-matchMedia guard, behavior mapping).
- Codex: round 1 CHANGES REQUIRED (the SSR branch was unasserted); resolved by
  switching to `globalThis.matchMedia` (single, fully-tested guard); round 2
  VERDICT PASS. `.claude/reviews/023-reduced-motion.md`.

## Rollback

Revert the commit — scroll-to-word returns to unconditional `"smooth"`. Zero
data impact.

## Checklist

- [x] Hexagonal boundaries: pure `src/lib` util used by a UI component — in bounds.
- [x] No direct `invoke()`.
- [x] Tauri capability/scope impact: none.
- [x] Secrets/privacy: none.
- [x] Offline behavior: unaffected.
- [x] Frontend tests: +5 unit tests; lint/typecheck green.
- [x] Backend tests: N/A.
- [x] Build/bundle smoke: N/A (frontend only).
- [x] Accessibility impact: POSITIVE — honors `prefers-reduced-motion`.
- [x] Rollback: documented.
- [x] Codex review: PASS (after one revision).

## Remaining #7 work

pt.3 — sentence-level fallback when `wordTimings` is empty/sparse.
pt.4 — page-boundary range handling in `TtsWordHighlight.createWordRange`.
Then P2 (pdf.js 5.x upgrade).
