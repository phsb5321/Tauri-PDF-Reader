# Implementation Plan: 275 brand icon set

## Technical Context

TypeScript 5.6+ / React 18.3, Vite, Tauri 2.x. The app has **no icon library** — components inline
their own `<svg viewBox="0 0 24 24">`. There is no `@/` path alias in this repo (verified: the only
`@/` import in the tree was the one this branch briefly introduced); imports are relative.

Source of the geometry: the traced nightingale (`ai/panels/final-bird.svg` in the brand folder) for
the bird, plus two newly traced shapes (a quill, a flying bird) from the generated pair sheet.

## Smallest sequence

1. **Author the module** — `src/ui/icons/lectrice-icons.tsx`. General icons are hand-written geometry;
   branded icons compose the traced bird/quill/flight groups inside a shared 24px box via
   `translate → scale → translate`, so one source of geometry serves every size.
2. **Verify by render** — extract each component's markup into a sheet and look at it at 48px and
   16px. (This caught inverted traces: a `-negate` step traced the background block instead of the
   icon for the quill and the flying bird.)
3. **Wire one real usage** — `AiPlaybackBar`: play → `IconSing`, pause → `IconPause`. One usage keeps
   the change reviewable and proves the module integrates; the rest is separate work.
4. **State the rule** — `docs/brand/brand-spec.md`: chrome is neutral, meaning is bird-carried.

## Provenance / gates

- `pnpm typecheck` — caught unbalanced `<g>` nesting from a non-greedy extraction; fixed by taking the
  balanced `<svg>` body rather than regex-matching a group.
- `pnpm lint` — 0 errors (architecture boundaries: `components` → `ui` is allowed).
- A rendered size sheet, reviewed on both sizes — this is the check that makes "legible at 16px" an
  observation rather than a claim.
- Renders and the module are reproducible from the brand folder's generator, not hand-edited SVGs.
