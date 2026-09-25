# Implementation Plan: 276 design practice adoption

## Technical Context

Docs-only slice on the Lectrice repo (TypeScript/React/Tauri desktop app, hexagonal frontend,
Catppuccin token system, `src/ui/icons/lectrice-icons.tsx` icon pairs). The pattern being adopted is
DeliCasa's, read from the primary artifacts, not from memory of them:

- `~/Documents/Code/work/DeliCasa/DeliCasa-661-pnpm/design/partner/restock-flow/brief.md` — the brief
  shape to adapt (Surface / Source spec / numbered deliverables / Constraints with numbers + copy pair
  / Real content / Output location / Out of scope).
- `~/Documents/Code/work/DeliCasa/DeliCasa-661-pnpm/specs/131-brand-identity-huashu/research/01-huashu-methodology.md`
  — the 5-dimension critique rubric (philosophy alignment / visual hierarchy / craft quality /
  functionality / originality, each 0–10, output template in `critique-guide.md`) and the swarm
  frontmatter convention.
- DeliCasa's vendored `.claude/skills/huashu-design/` (2.1 MB, tracked) — the trimming precedent:
  everything from the global skill **except** `assets/bgm-*.mp3` (~30 MB) and `assets/showcases/**`
  (~3.3 MB), plus a local `BOOTSTRAP.md` and `VENDORED-LICENSE-MIT.txt`.

The desktop-app adaptation of "Surface": the app has no URLs — a surface is the component tree that
mounts, under what condition (`ReaderView.tsx` view-swap logic), at what window size
(`src-tauri/tauri.conf.json`: 1200×800 default, 640×600 min), with which input modality (keyboard
chords vs mouse) and reader state (idle / speaking).

Evidence base for the briefs was read from the code: `src/components/reader/ReaderView.tsx` (shell,
view swap, playback-bar mount condition), `src/components/library/LibraryView.tsx` (+ its
`LibraryEmptyState`), `src/components/PdfViewer.tsx` (:908 empty state, :961 ScannedPdfWarning mount),
`src/components/playback-bar/AiPlaybackBar.tsx` (:879 needsApiKey setup bar), `src/components/settings/SettingsPanel.tsx`
(7-section modal dialog), `src/ui/components/EmptyState/EmptyState.tsx` (shared empty-state primitive),
`src/ui/icons/lectrice-icons.tsx` (general/branded pairs), `src/lib/constants.ts:57`
(`AI_TTS_SETUP_MESSAGE`).

## Smallest sequence

1. **Spec chain first** — `specs/276-design-practice/{spec,plan,tasks}.md`, matching the 268/275 house
   format (the gate greps for `## User Scenarios & Testing`, `## Technical Context`, `- [x] T…`).
2. **The rule** — `docs/design/README.md`: what lives in `docs/design/`, the mandatory-`review.md` rule
   written against the render at 1200×800 + 640×600, the critique dimensions, the text-only-lane split.
3. **The template** — `docs/design/BRIEF-TEMPLATE.md`, DeliCasa's shape ported to a desktop app, with
   the Lectrice brand constraints pre-filled (vermilion-on-paper mark, bird-goes-where-the-meaning-is,
   two-cut rule, blue=app/mauve=voice, tokens-only).
4. **Five briefs from the code** — `docs/design/flows/{library,reader,playback-bar,settings,empty-states}/brief.md`,
   each naming real component paths + line numbers, real states, real copy, and exactly two named
   variant directions justified by how the surface is actually used.
5. **Vendor the skill** — rsync from `~/.claude/skills/huashu-design/` excluding `assets/bgm-*.mp3` and
   `assets/showcases/`; copy `LICENSE` → `VENDORED-LICENSE-MIT.txt`; write a Lectrice `BOOTSTRAP.md`
   (what's here, what's omitted + fetch-on-demand, where the brand input lives).
6. **Brand-spec pointer** — short "Design process" note in `docs/brand/brand-spec.md` pointing at the
   README rule.
7. **Verify + land** — `make harness-check`, prettier on the markdown (lint-staged does it), commit,
   push, PR. The orchestrator reviews (per the brief's rules); CI green before merge.

## Provenance / gates

- `make harness-check` — PASS (branch `276-design-practice` matches `specs/276-design-practice/`).
- Pre-commit: lint-staged prettier on `*.md`; no `src/**` files → no eslint/vitest triggered by the
  diff; typecheck unchanged-clean.
- Every file:line citation in the briefs re-verified with `rg -n` after writing (evidence, not
  assertions).
- Vendored skill diff-checked against DeliCasa's file list (same exclusions) before committing.
