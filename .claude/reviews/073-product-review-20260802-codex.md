# 073 Product review — readable themes and minimum text

Date: 02/08/2026 13:39 BRT
Reviewer: Product (native Codex Sol), read-only
Scope: PR #72 at `5c9155ac7d7e9a6c140c34b560d2c10b38d27fbd`

## Verdict

**FAIL / CHANGES REQUIRED**

- BLOCKER: none.
- MAJOR: 1.
- MINOR: 0.

This is a Product/acceptance review. It is same-family with the generator and
does not satisfy the separately missing independent-family gate.

## MAJOR — the 12px oracle permits sub-12px relative sizes

`specs/073-library-a11y/spec.md` acceptance criterion 6 says the smallest
rendered text is 12px, and the test says `--text-xs` is the floor. However,
`src/__tests__/ui/design-tokens.test.ts:862-887` checks only:

1. that `--text-xs` itself resolves to at least 12px at a 16px root; and
2. literal declarations matching `font-size: <number>px`.

A production stylesheet containing `.probe { font-size: 0.5rem; }` is outside
that regex, so the gate reports no undersized declaration and passes while the
text renders at 8px at the default root. The same blind spot covers undersized
`em`, `pt`, percentage, `calc(...)`, and `font` shorthand values.

Read-only reproduction against the exact gate expression:

```text
input: .probe { font-size: 0.5rem; }
xsPx: 12
undersized: []
passesGate: true
```

Required repair: either narrow the Product claim to the syntaxes actually
enforced, or (preferred) make the oracle resolve every supported font-size form
used by first-party CSS/runtime style sheets and fail closed on unsupported
forms. Add a planted `0.5rem` negative control; it must fail for the specific
sub-12px reason. Decorative `aria-hidden` SVG glyphs may be explicitly excluded
from the interface-text claim.

## Evidence that remains valid

- The dark-mode defect is real: legacy undefined tokens previously fell back to
  light literals, including the documented 1.06:1 case.
- The semantic foreground/fill split is aligned with the Product outcome.
- The light/system-dark/explicit-dark/increased-contrast matrix, runtime JSX
  style inventory, and direct warning/info/playback bindings are materially
  stronger than the pre-073 state.
- PR #72 is clean and has 7/7 checks green, with no GitHub review threads.
- Delivery remains blocked independently on the missing different-family typed
  verdict even after this MAJOR is repaired.

## Falsifier

If a planted first-party `.probe { font-size: 0.5rem; }` does not make the
targeted 073 contract fail with an undersized-text diagnostic, the acceptance
oracle is still incomplete.

No repository file, branch, worktree, PR, or CI state was changed.
