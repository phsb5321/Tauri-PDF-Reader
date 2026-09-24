# Tasks 277 — icon rollout

- [x] T277-1 Inventory `rg -U '<svg.*?</svg>' src/components` on origin/main; classify all 65
      glyphs against the 6 pairs; confirm only 5 sites match; write spec.md.
- [x] T277-2 ParagraphActionOverlay: play triangle → `IconSing` (voice, glyph-only, ~14.4px).
- [x] T277-3 ResumeSection: both 12px play glyphs → `IconPlay` (general); delete dead `PlayIcon`.
- [x] T277-4 PageNavigation: prev → `IconBack`, next → `IconForwardBird`; add
      `nav-icon-solid` stroke guard to PageNavigation.css.
- [x] T277-5 SettingsPanel: speaker nav → `IconNarrate` (general); delete dead `SpeakerIcon`.
- [x] T277-6 `pnpm lint` + `pnpm typecheck` + targeted suites green (54/54).
- [x] T277-7 `pnpm test:fuzz` green (seed 20260921, 8/8).
- [ ] T277-8 Commit, push when the CI anchor is idle, PR, required checks green, squash-merge;
      report unmatched-glyph list to the orchestrator.
