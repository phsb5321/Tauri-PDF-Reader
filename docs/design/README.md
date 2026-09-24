# Lectrice design docs — the practice

This directory is where design slices live: one **brief per flow** (not per workstream), the hi-fi
artifacts the brief requires, and the **critique that proves the slice happened**. The pattern is
borrowed from DeliCasa's proven practice (vault: `3. Resources/🎨 DeliCasa's GPT screen-design
practice — what Lectrice takes (2026-09-21).md`), adapted from its tablet-web origins to this desktop
app.

## Layout

```text
docs/design/
├── README.md            ← this rule
├── BRIEF-TEMPLATE.md    ← copy me to start a slice
└── flows/
    ├── library/brief.md
    ├── reader/brief.md
    ├── playback-bar/brief.md
    ├── settings/brief.md
    └── empty-states/brief.md
```

When a slice executes, its artifacts land **beside its brief** (DeliCasa shape):

```text
docs/design/flows/<flow>/
├── brief.md        ← the contract (already committed)
├── index.html      ← hi-fi mock at the real sizes
├── variants/       ← exactly two named directions
└── review.md       ← the 5-dimension critique — MANDATORY
```

## THE RULE — no critique, no "done"

**No design slice is complete without a `review.md` written against the render, at the sizes the
product actually renders.** For Lectrice that means: screenshots/captures of the real surface (or the
hi-fi mock at true fidelity) at **1200×800 (window default) and 640×600 (window minimum)** — the sizes
`src-tauri/tauri.conf.json` ships — and the critique cites the render files it was written against.
A slice whose critique was written from memory of the code is not reviewed; a slice whose `review.md`
does not exist is not done, whatever the seat reported.

`review.md` scores the five Huashu dimensions (rubric + output template:
`.claude/skills/huashu-design/references/critique-guide.md`), each 0–10, with Keep / Fix / Quick-Wins:

| #   | Dimension            | Lectrice reading of it                                                                                                                                      |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Philosophy alignment | the four brand principles (`docs/brand/brand-spec.md` §Principles): local-first-quiet, the-voice-is-the-feature, developer-grade restraint, honest surfaces |
| 2   | Visual hierarchy     | where the eye lands first — the document is the hero, the speaking state is always visible                                                                  |
| 3   | Craft quality        | pixel discipline: tokens only, 4/8px radii cap, 24px icon boxes, spacing scale honoured                                                                     |
| 4   | Functionality        | every element serves reading/narrating; deleting anything degrades nothing                                                                                  |
| 5   | Originality          | the nightingale register — figurative where the category is abstract — without costuming                                                                    |

## Lane split (text-only seats read this twice)

A seat on a **text-only lane** (e.g. the Z.AI GLM lane) writes briefs, process, and copy — it does
**not** attempt to view renders and never declares visual work verified. Visual verification belongs
to a vision-capable seat (or Pedro), against captures taken at the two rule sizes. The existing
capture lanes (`scripts/e2e-contrast-capture.sh`, the packaged-app lanes behind `pnpm test:user-gate`)
are the honest way to produce renders.

## Starting a slice

1. `cp docs/design/BRIEF-TEMPLATE.md docs/design/flows/<flow>/brief.md`
2. Fill it **from the code** (`rg -n` the real components, states, copy — cite file:line).
3. Get the brief acknowledged, then produce the deliverables the brief numbers.
4. Write `review.md` against the renders. The slice is done when the critique exists — not before.
