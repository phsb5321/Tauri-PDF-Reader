# Plan — 267-zoom-css-dup

## Technical Context

- css:S4666 fires on the second `.zoom-select { … }` ruleset added by spec 256. Declarations merge into the first block without cascade change: same
  specificity, same origin order relative to the dark variants.
- The 256 test contract (`color-scheme: light` scoped on `.zoom-select`,
  dark via `[data-theme="dark"]` + media fallback, no `:root` declaration)
  is preserved by the merge; assertions run on comment-stripped CSS.

## Files

| File                              | Change                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/components/ZoomControls.css` | fold `color-scheme: light` into the base `.zoom-select` block; delete the duplicate ruleset |

## Steps

1. Merge the declaration (done in the same commit as the spec chain).
2. Validate: 256 + ZoomControls suites, typecheck, lint.
3. Land behind required CI; post-merge Sonar gate is the acceptance oracle.
