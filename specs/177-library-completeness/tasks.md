# Tasks: Complete Library Home

## Phase 1 — Fail-first contracts

- [x] T001 Add a shell/toolbar test proving a visible Settings action opens the existing dialog from the library home and reader surface.
- [x] T002 Add Rust tests for scope candidates: valid SHA-shaped row + canonical regular PDF accepted; missing, directory, non-PDF, and malformed-id rows rejected; already-allowed files not re-added.
- [x] T003 Add the packaged two-phase legacy-profile journey with a real readable fixture and a missing-file negative control; record the pre-fix failure.
- [x] T004 Extend the packaged home-audit probe with card/title/content geometry and 2560×1080 column assertions; record the pre-fix failure.

## Phase 2 — User-visible settings

- [x] T005 Add the Settings callback and accessible toolbar action using existing toolbar tokens and roving keyboard navigation.
- [x] T006 Wire the shared shell’s existing Settings state to the toolbar without duplicating the panel.

## Phase 3 — Legacy cover recovery

- [x] T007 Restore narrow canonical file grants for valid returned library rows before `library_list_documents` returns.
- [x] T008 Prove repeated lists do not re-add allowed paths and per-row scope failures do not hide other documents.
- [x] T009 Keep the existing cover source-size, SHA, cache, and fallback code unchanged; run its targeted regression tests.

## Phase 4 — Responsive card geometry

- [x] T010 Make grid rows content-sized and start-aligned; remove the duplicate wrapper aspect-ratio authority.
- [x] T011 Cap ultrawide grid tracks while preserving internal vertical scrolling, list mode, and no horizontal overflow.
- [x] T012 Run the geometry lane at 640×800, 1200×800, and 2560×1080 and retain the pre/post probe evidence.

## Phase 5 — Acceptance and delivery

- [x] T013 Run targeted frontend tests, typecheck, lint, targeted Rust tests, rustfmt, clippy, and `make harness-check`.
- [x] T014 Run the packaged legacy-profile journey and retain: Settings dialog open, real card `ready`, missing card `fallback`, non-empty visible/accessibility names, and file-specific persisted scope with no wildcard.
- [ ] T015 Run `pnpm verify`, obtain a different-family exact-head review, and resolve every BLOCKER/MAJOR without weakening tests.
- [ ] T016 Push the PR, poll every required check green, squash-merge, verify `state=MERGED`, update the durable backlog receipt, and run the fleet done oracle.
