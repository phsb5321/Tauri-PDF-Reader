# Tasks

- [x] T001 Reproduce the undefined-token and low-contrast failure numerically.
- [x] T002 Define the Catppuccin palette, semantic roles, and legacy aliases.
- [x] T003 Separate text foreground roles from accent/status fill roles.
- [x] T004 Make typography tokens root-relative and replace sub-12px text.
- [x] T005 Add a nested-rule-aware design-token contract.
- [x] T006 Assert light, system-dark, explicit-dark, subtle, and filled surfaces.
- [x] T007 Run the targeted design-token test and `git diff --check`.
- [x] T008 Run lint and typecheck.
- [x] T009 Run the full frontend verification gate before commit.
- [x] T010 Close the Product MAJOR on relative-size coverage with a planted
      `0.5rem` RED and a fail-closed `px`/`rem`/`var()` resolver.
- [ ] T011 Complete cross-family adversarial review with no BLOCKER/MAJOR findings.
- [ ] T012 Update the durable backlog record with final evidence.

## Product-oracle repair evidence

- Product packet: `.claude/reviews/073-product-review-20260802-codex.md`, copied
  byte-for-byte from the dispatch packet whose SHA-256 is
  `ca527924a1b547f5a66a62e162d63815908a387faabace06e01f358e6304cd1e`.
- RED: the planted `.probe { font-size: 0.5rem; }` expected the specific 8px
  diagnostic, while the extracted original scanner returned `[]`; targeted
  result was 1 failed / 55 passed.
- GREEN: the inventory resolves shipped `px`, `rem`, and recursive
  `var(--token[, fallback])` values at the 16px root; the same command passed
  57/57, including unsupported-form fail-closed controls.
- Falsifier: if removing `rem` resolution lets the planted `0.5rem` source pass
  without `resolves to 8px, below 12px`, the repair is wrong.
