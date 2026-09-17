# Spec 267 — css:S4666 duplicate selector on ZoomControls

## User Scenarios & Testing

**Primary story:** after #214 lands, the post-merge Sonar analysis counts
exactly one new-code violation. This slice clears it so the gate reports
`new_violations = 0` with no exclusions, ignores, or threshold edits.

**Verification:** `zoom-controls-256.test.tsx` + `ZoomControls.test.tsx`
green; typecheck 0; lint 0 errors; required CI green; post-merge Sonar OK.

## Context

The post-merge Sonar analysis of 7d51ce1 (#214 / spec 256) counts exactly one
new-code violation (REST-verified, `inNewCodePeriod`):

- css:S4666 MAJOR — `Unexpected duplicate selector ".zoom-select", first used
at line 55` at `src/components/ZoomControls.css:81`.

The frozen 256 delta declared `color-scheme: light` in a second `.zoom-select`
block; the new-code window re-evaluates whole edited files, so the duplicate
selector enters the gate. Coverage 87.8 and duplication 0.12 remain OK; this
is the only violation on the branch.

## Fix (honest, no exclusions)

Move the `color-scheme: light` declaration into the existing base
`.zoom-select` block (one selector, same cascade position — before the
`[data-theme="dark"]` and `prefers-color-scheme` variants, which are distinct
selectors and stay as they are). No rule ignores, no threshold edits, no
`sonar.exclusions`.

## Verification

`zoom-controls-256.test.tsx` (10 gates) + `ZoomControls.test.tsx` green;
typecheck 0; lint 0 errors; required CI green; post-merge Sonar
`new_violations = 0`.

## Out of scope

All other 974 all-history issues (other projects included), product behavior,
Rust analysis.
