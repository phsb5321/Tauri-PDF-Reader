# Tasks — 266-sonar-new-code-violations

- [x] T1 Mechanical idioms: S7781/S7780/S3358/S6582/S6606/S7735/S6397/S2310/S7778/S7737/S4043
      across ParagraphActionOverlay.tsx, pdf-text.ts, prosody-plan.ts, AiPlaybackBar.tsx,
      PerformanceSettings.tsx, speech-normalization.ts, render-store.ts,
      pdf-paragraph-actions.ts (20 issues).
- [x] T2 A11y semantics: S6819 role swaps → `<output>`/semantic containers (6),
      S6853 label text (4), S6847 non-interactive listener (1) across
      NarrationDeliverySettings.tsx, ReaderView.tsx, PerformanceSettings.tsx,
      NarrationCockpit.tsx, ParagraphActionOverlay.tsx; update role-based test selectors.
- [x] T3 S3776 refactors ≤15: PdfViewer.tsx:318, AiPlaybackBar.tsx:109+386,
      usePdfDropSession.ts:80, useTtsWordHighlight.ts:291, prosody-plan.ts:476,
      speech-normalization.ts:438 (7).
- [x] T4 S2699: add a direct assertion to verify-receipt.test.ts:52.
- [x] T5 Validate: touched vitest suites, fuzz seed 20260915, lint, typecheck,
      harness-check, hooks-clean commit.
- [ ] T6 Land: push → 9/9 required CI → squash-merge → verify post-merge Sonar
      `new_violations = 0`.
