# Tasks 276 — design practice adoption

- [x] T276-1 Read the four reference artifacts (vault analysis note, DeliCasa restock-flow brief,
      huashu methodology, current `docs/brand/brand-spec.md`) and survey the five Lectrice surfaces in
      the code with line-number evidence.
- [x] T276-2 Write the spec chain `specs/276-design-practice/{spec,plan,tasks}.md` in the 268/275
      house format.
- [x] T276-3 Write `docs/design/README.md` — the mandatory `review.md` rule (critique against the
      render at 1200×800 + 640×600), the critique dimensions, the text-only-lane split.
- [x] T276-4 Write `docs/design/BRIEF-TEMPLATE.md` (DeliCasa shape → desktop app, brand constraints
      pre-filled).
- [x] T276-5 Write the five per-flow briefs under `docs/design/flows/` (library, reader, playback-bar,
      settings, empty-states), each citing real component paths + line numbers and naming exactly two
      variant directions justified by real use.
- [x] T276-6 Vendor the skill: copy `~/.claude/skills/huashu-design/` → `.claude/skills/huashu-design/`
      excluding `assets/bgm-*.mp3` + `assets/showcases/`; add `VENDORED-LICENSE-MIT.txt` + Lectrice
      `BOOTSTRAP.md`; verify the file list matches DeliCasa's trimming precedent.
- [x] T276-7 Add the "Design process" pointer to `docs/brand/brand-spec.md`.
- [x] T276-8 Verify: `make harness-check` PASS, `pnpm typecheck` clean, every cited file:line resolves
      (`rg -n` re-check), vendored-tree diff vs DeliCasa list clean.
- [ ] T276-9 Push, open the PR, wait for required checks green, hand to the orchestrator for review
      (this slice's reviewer per the brief); merge after approval.
