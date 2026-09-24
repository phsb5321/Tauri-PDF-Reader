# Brief — Empty states, the honest zeros (Hi-Fi Design Slice)

## Surface

- **Screen / route:** not one tree — a **family** rendered by the shared primitive
  `src/ui/components/EmptyState/EmptyState.tsx` (props: `title`, `description`, `icon`, `action`,
  `secondaryAction`, `variant: 'default' | 'compact'`, `:20-27`). This brief designs the family's
  language once, then applies it to every zero the product actually has (enumerated below — from the
  code, not brainstormed).
- **Window:** empties land everywhere, so the family must hold at **640×600** (worst case: the
  fresh-install library, which is the whole surface) and not feel lost in 1200×800.
- **Reader context:** an empty state is the product speaking at its most vulnerable moment — the
  reader just arrived (fresh install), just searched and missed, just opened the highlights panel
  before highlighting, just pressed play without a key, just opened a scan. Each one must answer
  **why it is empty** and **the single next action** — never apologise, never celebrate.
- **The real zeros (file:line evidence):**
  | # | Zero | Where | Current copy |
  |---|------|-------|--------------|
  | 1 | Fresh-install library | `LibraryView.tsx:284-313` | "No recent documents" + Open a PDF / Open Settings |
  | 2 | Search miss | `LibraryView.tsx:326-331` | `No results for "<query>"` + Clear search |
  | 3 | Empty shelf | `LibraryView.tsx:296-300` | "Nothing on this shelf yet" + how-to hint |
  | 4 | No highlights yet | `HighlightsPanel.tsx:75-81` | "No highlights yet" (compact) |
  | 5 | No API key | `AiPlaybackBar.tsx:882-913` + `AiTtsSettings.tsx:42-43` + `ResumeSection.tsx:72` | "AI TTS requires an ElevenLabs API key" + Configure |
  | 6 | Scanned PDF (no text layer) | `ScannedPdfWarning.tsx` mounted at `PdfViewer.tsx:961` | warning banner, dismissible |
  | 7 | Reader with nothing open | `PdfViewer.tsx:908-928` | "Open a PDF to get started" + Ctrl+O |
  | 8 | No reading sessions | `SessionMenu.tsx:154-170` | "No reading sessions" + Create Session (compact) |

  All six the slice brief names are rows 1, 2, 4, 5, 6 (rows 3, 7, 8 ride along — same primitive,
  same language, no reason to design them apart).

## Source spec

- `specs/073-library-a11y/` — the a11y floor for the action buttons.
- `specs/177-library-completeness/` — the fresh-install path (row 1 carries Settings because on a
  fresh install it is the ONLY surface — `LibraryView.tsx:283-287` comment, slice 112 B3).
- `specs/275-icon-set/` — which glyphs exist for empty-state icons.
- `docs/brand/brand-spec.md` — "honest surfaces" principle; icon rules.

## Required deliverables

1. `index.html` — a **catalogue sheet**: all 8 zeros at both sizes, each in its real context (library
   body, highlights dock, playback footer, reader, session menu), using the shared primitive's
   structure so the family reads as one voice.
2. `variants/` — exactly two named directions, justified by real use:
   - **Direction A — "Quiet zero":** icon + one sentence + one action; description only when the fix
     is non-obvious. Justification: most zeros are momentary (search miss, empty panel) — the reader
     wants past them, and restraint is the brand's default register ("one thousand no's").
   - **Direction B — "Teaching zero":** fresh-install and API-key zeros carry a two-step path (e.g.
     Open Settings → paste key), with the secondary action visually co-equal. Justification: rows 1
     and 5 are **dead ends for a first-time user** — the measured slice-112 finding is that the
     fresh-install empty state is the only place carrying TTS setup; teaching beats quiet when the
     alternative is a reader who concludes the app can't read aloud.
3. `review.md` — 5-dimension critique against the catalogue renders at both sizes, with a
   **consistency pass**: the 8 rows must read as one family (same type scale, same action-button
   hierarchy, same icon weight) while keeping their distinct verbs.

## Constraints

- **Numbers:** primary action ≥ 24px hit height + visible focus; title one line at 640px; description
  ≤ 2 lines; exactly one primary action per zero (`EmptyState` supports `action` + `secondaryAction`
  — never three); icons from the 24px box at 32–48px display; compact variant reserved for docked
  panels (rows 4, 8), default for surfaces (rows 1, 2, 7); contrast ≥ 4.5:1 for copy.
- **Copy pairs (the core of this brief):**
  > ✅ `No results for "the med"` — names the query, offers the exit (row 2, `LibraryView.tsx:326`)
  > ❌ "No recent documents" for a search miss — implies an empty library (`LibraryView.tsx:266-268`
  > records this exact trap).
  >
  > ✅ "AI TTS requires an ElevenLabs API key" + Configure (row 5, `constants.ts:57`) — names the
  > exact missing thing; the key is **session-only by design** (`ReaderView.tsx:141`), so the
  > empty state recurs by design and must never feel like an error.
  > ❌ "Voice magic isn't enabled yet ✨".
  >
  > ✅ Scanned-PDF warning names the three broken things — selection, highlighting, TTS
  > (`ScannedPdfWarning.tsx:26-30`).
  > ❌ "This document may have limited features."
  >
  > Tone rule for the whole family: verb-forward, concrete, no emoji, no exclamation marks, no
  > first-person chirpiness ("Let's find your books!").
- **Brand rules:** empty-state **icons are general, not bird-carried** — a zero is chrome, not
  meaning; the bird stays reserved for voice/reading/rest/direction
  (`lectrice-icons.tsx` two-layer rule). The one exception to evaluate in variants: row 5 (no API
  key) _is_ the voice's absence — a muted `IconNarrateBird` may be defensible; the review decides,
  and if the bird is used it must be the traced geometry, never a redraw. Blue accents for actions
  (app register); mauve only if the zero is voice-specific. Tokens only; radii 4/8; ease-out.

## Real content

- Every current string in the table above is the baseline vocabulary — improve wording, keep the
  facts (which action, which hint, which shortcut).
- Row 7's hint is real: "Press Ctrl+O or use the Open button in the toolbar" (`PdfViewer.tsx:911`).

## Output location

```text
docs/design/flows/empty-states/
├── brief.md
├── index.html
├── variants/
│   ├── direction-a.html
│   └── direction-b.html
└── review.md
```

## Out of scope

- The surfaces the zeros live in (library/reader/playback/settings briefs own their layouts).
- Error states (`library-view--error`, `pdf-viewer-error`) — adjacent family, its own slice if ever
  needed; loading states (`PdfSkeleton`, `LoadingState.tsx`) likewise.
- Changing the `EmptyState` component API.
