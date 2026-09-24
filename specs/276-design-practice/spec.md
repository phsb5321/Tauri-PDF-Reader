# Feature Specification: 276 — design practice adoption (per-flow briefs + vendored skill)

Measured 21/09/2026 (vault: `3. Resources/🎨 DeliCasa's GPT screen-design practice — what Lectrice takes
(2026-09-21).md`): three seats reported "done" having produced nothing, and it was invisible until
someone checked. DeliCasa already solved this — every design slice ends with a **5-dimension critique
file written against the render** (`design/partner/restock-flow/brief.md` shape), and the huashu-design
skill is vendored into the repo so every seat runs the same version of the practice. This spec adopts
that pattern: "done" for a design slice becomes an artifact that can be read, not a claim.

This slice is **process, not pixels**: no component changes, no visual verification (the executing seat
is text-only). It lands the template, the five per-flow briefs written from the real code, the vendored
skill, and the rule that makes `review.md` mandatory.

## User Scenarios & Testing

### US1 — A design seat starts a slice from a brief, not a blank page (P1)

Any seat asked to "redesign the library" finds `docs/design/flows/library/brief.md`, which names the
surface (real component paths + line numbers), the source spec lineage, the numbered deliverables
(hi-fi artifact, exactly two named variants, `review.md`), and the constraints with numbers and a copy
pair.

**Test:** the five briefs exist and every component reference in them resolves to a real file:line in
this repo (spot-checked with `rg -n`).

### US2 — "Done" is verifiable (P1)

A reviewer checking a claimed-complete design slice looks for `review.md` beside the artifacts. Without
it the slice is incomplete by rule — `docs/design/README.md` states it, `docs/brand/brand-spec.md`
carries it as part of the brand process.

**Test:** both docs state the rule in terms a seat can execute (critique written against the render, at
1200×800 and 640×600 — the sizes `src-tauri/tauri.conf.json` actually ships).

### US3 — The practice travels with the product (P2)

The huashu-design skill lives at `.claude/skills/huashu-design/` (vendored from the global
`~/.claude/skills/huashu-design/`, trimmed of ~30 MB of BGM/showcase media exactly as DeliCasa trims
it, with `BOOTSTRAP.md` recording what was omitted and how to fetch it on demand).

**Test:** `SKILL.md`, `references/` (incl. `critique-guide.md`), `scripts/`, `assets/` JSX frames + SFX
and `demos/` are tracked; `assets/bgm-*.mp3` and `assets/showcases/` are absent;
`VENDORED-LICENSE-MIT.txt` preserves upstream attribution.

### US4 — A text-only seat knows its lane (P2)

The README says explicitly: a seat that cannot read images writes the process and the briefs and hands
visual verification to a vision-capable seat; it never declares visual work verified.

**Test:** the rule text names the lane split in one readable sentence.

## Acceptance

1. `docs/design/BRIEF-TEMPLATE.md` exists, adapting DeliCasa's brief shape for a desktop app (Surface =
   screen/route + window size + input modality + reader state, not a URL; numbered deliverables with
   exactly-two named variants; constraints as numbers + a copy pair).
2. Five briefs exist under `docs/design/flows/`: `library/`, `reader/`, `playback-bar/`, `settings/`,
   `empty-states/` — each citing actual component paths from `src/components/**` / `src/ui/**`.
3. `.claude/skills/huashu-design/` vendored per US3.
4. The mandatory-`review.md` rule stated in `docs/design/README.md` and pointed to from
   `docs/brand/brand-spec.md`.
5. `make harness-check` PASS; pre-commit green (prettier-formatted markdown); no `src/` changes.

## Boundaries

- **In:** docs/design/**, specs/276-design-practice/**, `.claude/skills/huashu-design/**`, the
  brand-spec process note.
- **Out:** any component/CSS/token change; any visual verdict on renders (a vision-capable seat owns
  that); the hi-fi artifacts themselves (they are produced _from_ these briefs in later slices);
  vendoring the ~30 MB `assets/bgm-*.mp3` + `assets/showcases/` media.
- No new dependency, no workflow change, no behaviour change.
