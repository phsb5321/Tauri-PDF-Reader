# Spec 073 — Library readability and design-token contract

## Problem

The reading home and many established components reference legacy CSS custom
properties such as `--text-primary` and `--bg-secondary`. Those names were not
defined globally, so their light-only fallback literals rendered in dark mode.
Measured examples reached 1.06:1 contrast. The token layer also exposed accent
and status fills that do not meet WCAG AA when reused as normal-sized text.

## User outcome

Library and reader chrome remain readable in light, system-dark, explicit-dark,
and increased-contrast environments. Normal text has a machine-enforced WCAG AA
floor of 4.5:1, and no app stylesheet renders text below 12px at the default root
size.

## Acceptance criteria

1. Every CSS custom property referenced by a stylesheet is defined.
2. System-dark and explicit-dark token graphs resolve independently and remain
   equivalent for all tested semantic roles.
3. Every semantic foreground clears 4.5:1 on every shipped text-bearing surface.
4. Foregrounds on accent and status fills clear 4.5:1.
5. Components do not use fill-only accent/status tokens as foreground text.
6. The smallest rendered text size is 12px and typography tokens scale in `rem`.
7. The checks are runnable in Vitest without browser screenshots or network access.

## Non-goals

- Generating or caching PDF cover thumbnails.
- Renaming every legacy call site in the same change.
- Converting every existing 12px-or-larger declaration to typography tokens.
- Changing the Catppuccin Latte/Mocha brand palette.

## Review status

The required cross-family Claude review is **unavailable**, not passed: three
non-mutating `claude -p` invocations completed with empty stdout and produced no
verdict artifact. Per the CI-train handoff, Quality/Terra will review the
committed diff as an emergency **same-family degradation** before p1 opens the
PR. That review cannot be represented as satisfying the cross-family gate.

The first degraded review found one MAJOR: the initial test matrix did not layer
the shipped `prefers-contrast: more` block despite this spec claiming that
environment. The first repair still flattened matching declarations into a
`Map`, ignoring selector specificity, and did not bind the translucent playback
error banner to a measured surface; Terra correctly returned two BLOCKERs.
The amended contract resolves the actual document-root cascade, includes
combined OS/explicit preferences, discriminates scope and specificity failures,
and binds the error banner to the semantic error pair. A new committed-diff
review then found another BLOCKER: the inventory walked only `.css` files and
therefore excluded three runtime `<style>` sheets mounted from TSX. That gap hid
undefined warning/info roles and white normal text on the pale dark-theme accent
fill. The repaired inventory parses JSX structure (not arbitrary TSX text),
accepts only static runtime style templates, fails closed on unsupported style
nodes, and runs the same definition/foreground/size checks over those sheets.
The three components now bind to measured warning, info, and on-accent pairs;
the WCAG transfer breakpoint is the current 0.04045 value. A new committed-diff
verdict is still due; this remains an emergency same-family degradation, never a
cross-family pass.

Product review on 02/08/2026 found one further MAJOR: the 12px contract scanned
only literal `px`, so `.probe { font-size: 0.5rem; }` rendered at 8px while the
gate returned no violation. The repair preserves criterion 6, resolves the
`px`, `rem`, and typography `var()`/fallback forms shipped by first-party CSS
and runtime style sheets, and reports unsupported explicit `font-size` forms
with their source location. Its planted `0.5rem` control first reproduced RED
with the original empty result, then passed only after producing the specific
8px-below-12px diagnostic. Product re-review remains due.
