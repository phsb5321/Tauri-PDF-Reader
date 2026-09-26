# Plan

## Technical Context

Existing TypeScript shared text helper, PDF.js-shaped extraction items, Vitest
regressions. No dependency, backend or schema additions. The public text layer
and narration callers all use `buildPdfText`; repair this shared seam once.

## Implementation

1. Reproduce carrier loss against base `b3eeefd` with synthetic PDF.js-shaped items and UTF-16 assertions.
2. In `buildPdfText`, retain an empty item's EOL on the previous parsed item and published segment. Keep paragraph gating and section geometry unchanged.
3. Run extraction, prosody, tracking, lint, typecheck and harness checks; retain logs in `docs/evidence/296-pdf-boundaries/`.
4. Deliver through the normal PR checks; do not infer packaged deployment from unit acceptance.

## Rejected alternative

Unconditionally inferring paragraphs from large baseline jumps broke the existing page-19 footnote fixture. The planner already coalesces micro-runs; changing it would mask the extraction regression.

## Constitution check

Pure shared text helper; no IPC or architecture-boundary additions, UI styling, permissions, source logging or external network dispatch. Existing test expectations and coverage thresholds unchanged. Revert the squash commit via a PR to reverse.
