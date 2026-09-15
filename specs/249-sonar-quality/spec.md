# Spec 249 — Sonar quality follow-through, non-overlapping slice

## Hypothesis

Removing redundant assertions and simplifying the flagged expressions and function responsibilities can address ten Sonar findings without changing reader behavior.

## User Scenarios & Testing

1. Provider activation still rejects stale operations and clears loading/switching state only for the current generation; initialization status/error precedence is unchanged.
2. Speech chunking retains exact original UTF-16 spans and UTF-8 bounds, whitespace preference and whole-request fail-closed behavior for an oversized grapheme.
3. Connection labels, classes, theme choice and selected narration offsets remain identical, including absent DOM nodes and failed initialization.

## Scope and evidence

Original incident main `8e383fe321f8d0c427500b730865d3bed19661bd`; Sonar analysis `1d7a63a1-d8fc-4d71-86ea-b34a17401f1d`: 23 new violations, passing coverage/duplication. This slice owns ten findings in seven files: TtsWordHighlight, AiTtsSettings, ThemeToggle, useAiTts, tts-tracking, ai-tts-store and selection-narration. The other thirteen findings overlapped PR205 and are not implicitly fixed here. PR205 subsequently merged as `adc6300c6a1babb73305d2325bacb35d2f8951f1`; feature249 fast-forwarded to that parent with all14WIP paths byte-preserved. Its distinct Sonar analysis `38035a59-2539-4838-830b-81deb5ffdcba` reports26issues (all23original keys persist, plus3); never relabel the old analysis as this newer one.

No change to workflows, credentials, Sonar rules/exclusions/thresholds, dependencies, source offsets, provider IPC order, live225, deployment or old frozen candidate caps. No blind scanner rerun. Only a subsequent authorized exact-revision analysis establishes actual Sonar remediation.

## Acceptance

- Existing assertions retained; targeted provider/state/selection/chunk/settings regressions and new edge cases pass.
- Typecheck, lint and branch-bound harness pass; affected packaged PR-fast CI remains required.
- Different-family independent review of the exact source/commit, then normal protected PR checks and safe merge policy.
- No new user-visible behavior is intended. No acoustic, performance or native acceptance inferred from unit checks.
