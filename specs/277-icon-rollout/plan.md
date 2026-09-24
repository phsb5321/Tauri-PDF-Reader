# Implementation Plan: 277 — icon rollout

## Technical Context

React 18.3 + TS 5.6, no `@/` alias (relative imports, as 275 established). The set
(`src/ui/icons/lectrice-icons.tsx`) renders `width/height` attributes from `size`; every target
site sizes its `<svg>` via CSS class, and CSS beats presentation attributes, so existing sizing
survives the swap — `size` is passed to match each CSS-enforced px as a fallback if the CSS
ever goes away (22 overlay / 12 resume / 18 nav / 20 settings).

Traps checked before editing:

- **Stroke inheritance (PageNavigation):** `.nav-icon { stroke: currentColor; stroke-width: 2 }`
  sits on the `<svg>` and inherits into paths. The bird glyphs protect themselves
  (`stroke="none"` on their groups), but `IconBack`'s bare filled path would get a 2px outline.
  Guard: `.nav-icon-solid { stroke: none }` in `PageNavigation.css`, applied to both nav
  glyphs. `fill: none` from the same rule cannot bleach the glyphs — an own presentation
  attribute (`fill="currentColor"`) beats an inherited value.
- **Sub-16px branded detail:** 275 reviewed the traced cuts at 48px/16px only. The 12px
  labeled button therefore takes the general `IconPlay`; only the ~14.4px glyph-only overlay
  takes `IconSing`.
- **aria:** every replaced glyph was `aria-hidden` decoration next to labelled controls;
  `IconProps` renders `aria-hidden="true"` itself, so labels/titles are untouched.

## Sequence

1. Specs (this chain) — gate requires it for 4 product files.
2. Swap the 5 sites; delete the now-dead local `PlayIcon`/`SpeakerIcon` helpers; add the
   `nav-icon-solid` guard.
3. `pnpm lint` → `pnpm typecheck` → targeted suites:
   `paragraph-action-overlay`, `resume-and-play`, `ResumeSection`, `PageNavigation*`,
   `settings-menu` (+ `library-202-affordances` which touches ResumeSection).
4. `pnpm test:fuzz` (seeded; record seed).
5. Commit on `277-icon-rollout`; check the repo-wide anchor is idle before pushing (CI is
   serialised — brief rule 6); PR; required checks; merge per the safe class.

## Provenance / gates

- Deterministic: targeted vitest + fuzz + lint + typecheck locally; repo CI (backend + packaged
  user gate) on the PR head.
- Visual: this seat is GLM and cannot look at renders (brief rule 1). Geometry-level reasoning
  and the CSS audit stand in; the visual sign-off belongs to a vision-capable lane / the
  packaged gate. Recorded as an explicitly unpassed gate in the PR and the orchestrator report.
