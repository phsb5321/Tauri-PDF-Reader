# Feature Specification: 275 — brand icon set (general + branded)

The brand direction landed in 274 (vermilion bird on paper) but the app still draws its own ad-hoc
inline `<svg>` glyphs. The mark exists; the iconography that would make the direction _visible in the
product_ does not. This spec lands the icon set as a two-layer system and wires its first real usage.

## User Scenarios & Testing

### US1 — The play control speaks the brand (P1)

A reader opens a document and presses play to hear it read aloud. The control that starts narration is
the nightingale with its beak open — the same bird as the app icon — so the button that means "read to
me" is the mark itself rather than a generic triangle.

**Test:** `AiPlaybackBar` renders `IconSing` when idle and `IconPause` while playing; the glyph is the
traced bird geometry, not a `<polygon>`.

### US2 — Two layers, one rule (P1)

An engineer adding a new control can tell which icon to use without asking: chrome is neutral, meaning
is bird-carried. The rule is written in the brand spec and encoded in `iconPairs`.

**Test:** `docs/brand/brand-spec.md` names both layers and when to use each; `lectrice-icons.tsx`
exports `iconPairs` mapping each function to `{ general, branded }`.

### US3 — Icons survive the sizes the app actually renders (P2)

The app renders controls at 16-20px. Every icon is authored on a 24px box and was reviewed at 48px
_and_ 16px before landing.

**Test:** the rendered check sheet shows all 13 icons legible at both sizes.

## Acceptance

1. `src/ui/icons/lectrice-icons.tsx` exists: 13 icons, all `viewBox="0 0 24 24"`, typed props.
2. `AiPlaybackBar` imports from it; play → `IconSing`, pause → `IconPause`.
3. `docs/brand/brand-spec.md` carries the general/branded rule.
4. `pnpm typecheck` clean; `pnpm lint` 0 errors.
5. All required CI checks green on this head, then squash-merge.

## Boundaries

- **In:** the icon module, the one wired usage, the spec rule.
- **Out:** replacing every existing inline glyph in the app (separate slices, each reviewable);
  the simplified sub-24px variants of the branded icons (same two-cut logic as the mark — its own
  follow-up); any change to UI tokens or layout.
- No behaviour changes beyond the play button's glyph; no new dependency.
