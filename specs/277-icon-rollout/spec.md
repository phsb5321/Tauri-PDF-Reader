# Feature Specification: 277 — icon rollout (finish what 275 started)

`src/ui/icons/lectrice-icons.tsx` landed in 275 as the single source for the app's pictograms,
but the app still draws ad-hoc inline `<svg>` glyphs almost everywhere. This slice replaces the
inline glyphs **where the set has a matching pair**, invents nothing, and records the sites that
have no good match so the set's next slices are scoped by evidence rather than guesswork.

## Inventory (evidence)

`rg -U '<svg.*?</svg>' src/components` on `origin/main` (`8e8a6b1`): **65 inline glyphs across
29 component files** (plus 7 more under `src/ui/components/` primitives). Classified against the
13 exported icons / 6 pairs, **exactly 6 usages in 4 files have a pair match** (the shared
`PlayIcon` helper in `ResumeSection` serves two buttons); the other ~60 have none —
the set ships no close/X, search, zoom, gear, trash, check, warning, document, mic, stop,
download, spinner, chevron, card, or eye glyph. Those stay inline and are listed in the PR
report; per the brief, no new icons are invented here.

## User Scenarios & Testing

The brand rule (docs/brand/brand-spec.md): general layer for chrome, bird-carried layer for
voice/reading/rest/direction. This slice adds one operational corollary, forced by the sizes
the app renders: **the branded cut is only used where the glyph is the affordance and renders
at ≥ ~14px** (275 reviewed legibility at 48px and 16px; below that the traced detail is mud).
A labeled button's decorative glyph is chrome and takes the general cut.

### US1 — Paragraph "read from here" speaks with the bird (P1)

The glyph-only hover button that starts paragraph narration (`ParagraphActionOverlay`, rendered
~14.4px inside its 1.4rem disc) shows the nightingale — the same "read to me" meaning 275 gave
the main play control.

**Test:** existing `paragraph-action-overlay` / `resume-and-play` suites stay green (behaviour
unchanged); the markup imports `IconSing`.

### US2 — Page navigation uses the direction pair (P1)

Previous page = the set's left arrow (`IconBack`); next page = the forward bird
(`IconForwardBird`). Both keep the `nav-icon` class so the existing 18px sizing holds. The
chevron stroke rules in `PageNavigation.css` must not outline the filled set glyphs.

**Test:** `PageNavigation` suites stay green; a `nav-icon-solid` guard sets `stroke: none`.

### US3 — Resume buttons keep the general triangle (P2)

`ResumeSection` has two read-aloud buttons — the glyph-only `resume-line-play` control and the
labeled "Read aloud" row button — and both render their glyph at 12px (CSS). Below the bird's
reviewed 16px floor the traced detail is mud, so both take `IconPlay` (general); the accessible
name carries the meaning. No sub-16px bird is shipped.

**Test:** `resume-and-play` / `ResumeSection` suites stay green.

### US4 — TTS settings nav uses the narrate glyph (P2)

`SettingsPanel`'s speaker nav icon (Material `volume_up`, speaker + arcs) is the same function
family as the set's general `IconNarrate` (speaker + arcs). Settings nav is chrome → general
layer, 20px per existing CSS.

**Test:** `settings-menu` suite stays green.

## Acceptance

1. The 6 usages above import from `src/ui/icons/lectrice-icons.tsx`; `IconProps` is untouched.
2. No other glyph is changed; no new icon is added to the set; no token/layout change.
3. `pnpm typecheck` clean, `pnpm lint` 0 errors, targeted suites green, `pnpm test:fuzz` green.
4. All required CI checks green on this head, then squash-merge.

## Boundaries

- **In:** the 6 replacements + the one-line `nav-icon-solid` CSS guard + this spec chain.
- **Out:** every unmatched glyph (stays inline; list reported to the orchestrator); new icons
  for the unmatched functions (Pedro's cut — the set's next slices); simplified sub-24px
  branded variants (275 follow-up); UI token migration (Seat F's brief).
- No behaviour, layout, or colour change; aria/labels/titles byte-identical.
