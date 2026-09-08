# Spec 202 — Library QoL: readable resume-and-read-aloud affordances (#183 tail)

Branch: `202-library-qol` (stacked on `177-library-completeness` @ 951c342, PR #178).
Issue: phsb5321/Tauri-PDF-Reader#183 (cosmetic tail retained out of verified #178).
Worker: `lectrice-library-202` (GLM-Flash bounded-recovery generator; no merge/done authority).

## Problem

The library home hides two useful signals in chrome:

1. **Resume-and-read-aloud is icon-only.** Both the resume line and the
   "Also in progress" rows expose the narration action as a bare play glyph
   (`IconButton` + `PlayIcon`). A reader who does not already know the icon
   cannot discover that one click resumes the book AND starts reading aloud.
2. **0% progress paints like a divider.** `.resume-line-bar` is a 4px
   full-width track filled with `--color-border`; at 0% (e.g. page 2 of a
   250+ page book, or unknown page count) the fill is 0 and the track reads
   as a layout hairline, not a progress affordance.

Both violate the issue's acceptance: visible affordances, fail-first
control-state/geometry probes at narrow and wide widths, no screenshot-only
verdict.

## User Scenarios & Testing

### User Story 1 — Discover resume-and-read-aloud (P1)

As a returning reader, I can see a labeled "Read aloud" action beside Resume,
so discovering that one click lands my page AND starts narration does not
require knowing an icon.

**Independent test**: render the resume line and an Also-in-progress row; assert
a visible text label "Read aloud" on each control whose accessible name keeps
the resume verb + book title, and drive it in the packaged app through public
controls.

**Acceptance scenarios**:

1. Given one in-flight book, the resume line exposes a button containing the
   visible text "Read aloud" with accessible name `Resume {label} and read aloud`.
2. Given two in-flight books, each Also-in-progress row exposes the same
   labeled control, still calling only `onResumeAndPlay`.
3. Given a fresh launch with no TTS key, activating it lands the stored page,
   starts no audio, and shows the existing honest setup signal.
4. Given the fixture TTS backend, activating it drives playback out of idle.

### User Story 2 — Read zero progress as progress, not chrome (P1)

As a reader who just opened a very long book, I can tell my 0% resume line apart
from a layout divider.

**Independent test**: jsdom control-state at percent 0 (page 2 of a 500-page
document) asserting the empty-track modifier; CSS source contract asserting the
hollow track and accent start-nub are bound to tokens; packaged computed-style
probe of the track's container treatment on the existing seeded book.

**Acceptance scenarios**:

1. Given percent 0, the track carries the empty modifier with a visible
   start-position nub bound to the accent token (deterministic control-state
   - CSS contract).
2. Given percent > 0, the empty modifier is absent and the fill behaves as
   before.
3. The track is a hollow container (inset ring on `--color-border`) at every
   percent, so it never reads as a divider (packaged computed-style probe on
   the existing seed).
4. SEAM GAP (documented, not silently skipped): no existing public control or
   seed lane reaches a 0% in-flight book in the packaged app — fixtures are
   fixed at 20%/33% and fresh adds start at page 1 ("unread", not in-flight).
   The packaged 0% probe would require amending the shared e2e bootstrap,
   which this slice's brief forbids. The 0% branch is gated deterministically
   at the jsdom + CSS-contract tier; the packaged tier proves the track
   treatment. A future bootstrap seed lane is the named upgrade path.

### User Story 3 — Keep the home legible at every width and text scale (P2)

As a reader on a narrow laptop or an ultrawide display, the labeled controls
wrap instead of clipping and stay keyboard-reachable — including at the
maximum 150% UI text scale.

**Independent test**: packaged journey at 640/1200/2560 — no horizontal
overflow, controls visible and clickable; keyboard-only tab walk reaches
Resume then Read aloud in DOM order with a visible focus indicator, and Enter
on the focused control fires the same action as click; the public UI-scale
slider set to 150% leaves the resume controls visible with no overflow at 640. Rem-based sizing is retained by a CSS contract (no px font sizes in the
slice's stylesheet).

**Acceptance scenarios**:

1. At 640/1200/2560 (100% scale): no horizontal overflow; "Read aloud" is
   visible and clickable.
2. Keyboard-only: Tab order within the resume line is Resume → Read aloud
   (DOM order); the focused control matches `:focus-visible`; Enter fires the
   read-aloud action (no page turn beyond the stored page; idle stays idle in
   the no-key lane).
3. At 150% UI scale (public slider, its max): controls remain visible, no
   horizontal overflow at 640; stylesheet keeps rem-based type.
4. No dialog or popover is touched by this slice, so Escape-focus-return is
   n/a here (the rename dialog's existing behavior is out of scope).

### User Story 4 — Create a shelf without losing the form (P3, stretch)

As a reader with many shelves, the New shelf form stays pinned while the shelf
list scrolls.

**Independent test**: create enough shelves through the public form to overflow
the list at a short window height; the form remains visible in the viewport.

## Scope (bounded slice)

- `src/components/library/ResumeSection.tsx` — labeled read-aloud controls;
  0% empty-track state.
- `src/components/library/ResumeSection.css` — wrap behavior, hollow track,
  0% start-nub modifier.
- `src/components/library/ShelfSidebar.css` — pin the New shelf form outside
  the scrolling list (#183: "keep the New shelf form near the shelf list /
  pinned when the list scrolls"). NON-BLOCKING STRETCH: primary acceptance is
  resume/read-aloud + 0% distinctness; a shelf-probe failure is reported as a
  secondary finding and cannot displace the primary verdict.
- Targeted tests: new `library-202-affordances` control-state + CSS-contract
  tests (including 150% UI-scale retention guards and DOM tab-order);
  mechanical accessible-name updates in `ResumeSection.test.tsx` and
  `resume-and-play.test.tsx` (same strictness, new name shape).
- Packaged journey `e2e/library-202-journey.e2e.mjs` + runner
  `e2e/run-202-library-journey.sh` (flock `/tmp/lectrice-heavy-gate.lock`),
  using EXISTING seed lanes and fixtures only.

## Out of scope (hard bans from brief)

- `useOpenPdf` / `usePdfDropSession` / `Toolbar`, the shared e2e bootstrap
  (`src/e2e-native-bootstrap.ts` — including its seed lanes; the earlier
  coordinator grant for an additive seed is WITHDRAWN in favour of the
  reviewer's lower-risk alternative), provider state, fleet-shared tokens,
  `.github`.
- Any second settings/transport surface; sort-select contrast (separate
  #183 bullet, needs the packaged contrast sweep — not this slice).
- Merge authority, done-state assertion, parent-branch edits.

## Affordance contracts

### FR-1 Labeled read-aloud control

- Resume line AND each Also-in-progress row render a `Button`
  (secondary variant, sm) whose content is `<PlayIcon/> Read aloud`.
- Visible text "Read aloud" is part of the accessible name (WCAG 2.5.3):
  accessible name becomes `Resume {label} and read aloud` (was
  `Resume {label} and start reading aloud` on an icon-only button).
- The plain `Resume` button and its name are unchanged. The control still
  calls `onResumeAndPlay` only — never the silent resume.

### FR-2 0% progress distinct from a divider

- At `percent === 0` the resume line's track carries a `resume-line-bar--empty`
  modifier rendering an accent start-position nub (`::before`, 6px, centered
  on the track start): the line reads "position: start", not "hairline".
- The track itself becomes a hollow pill at every percent: transparent
  background + inset 1px ring bound to `--color-border`, so a partially
  filled track is visibly a container, and an empty one never renders as a
  solid divider.
- The "N%" meta text, sr-only `<progress>` semantics, and fill behavior at
  > 0% are unchanged.

### FR-3 Legibility/focus at 640/1200/2560 and larger text

- `.resume-line-actions` wraps (`flex-wrap: wrap`) so a narrow window never
  clips the labeled buttons; the actions stay focus-reachable in DOM order.
- No horizontal overflow at 640/1200/2560 in the packaged journey.

### FR-4 New-shelf form pinned (stretch, same component family)

- The shelf LIST is the scroll container (`.shelf-list { flex:1; min-height:0;
overflow-y:auto }`); `.shelf-sidebar` stops scrolling itself, so the form
  stays visible whenever the list overflows.

### FR-5 Packaged zero-progress seed (test seam only, no product change)

- Bootstrap gains seed lane `zero-progress`: additionally registers a
  250-page fixture at page 2 (→ 0%) when the observer pre-placed
  `e2e-resume-fixture-zero.pdf` in the profile. All existing lanes and their
  fixtures behave exactly as before.

## Acceptance (executable)

1. RED-first `library-202-affordances` tests: visible "Read aloud" text;
   accessible names; 0% empty-modifier present at 0% / absent at >0%;
   CSS contract (wrap, hollow track, nub, pinned form) — all fail before the
   implementation, pass after.
2. Updated name-shape assertions in `ResumeSection.test.tsx` +
   `resume-and-play.test.tsx` keep their strictness (role+name driven).
3. Seeded fuzz `pnpm test:fuzz` green (seed + replay recorded).
4. Packaged journey (both lanes, under the shared heavy lock, existing seeds
   only): "Read aloud" visible + clickable at 640/1200/2560; no horizontal
   overflow; click lands the stored page with NO page turn; keyboard-only
   Tab/Enter path fires the same action with a `:focus-visible` indicator;
   150% UI-scale probe keeps controls visible without overflow at 640; no-key
   lane stays idle with the honest setup signal; key lane reaches `playing`
   via the labeled control; shelf form stays visible with a scrolled list
   (stretch, non-blocking).
5. Evidence in `docs/evidence/202-*` + run-root `reports/library.md`.

## Risks

- Accessible-name change touches `resume-and-play.test.tsx` (integration):
  mechanical, name-only; state-machine assertions untouched.
- WebKitGTK computed-style probes are read-only observer checks; actor
  actions remain public-control only.
