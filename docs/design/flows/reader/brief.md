# Brief — Reader, the document surface (Hi-Fi Design Slice)

## Surface

- **Screen / route:** `src/components/PdfViewer.tsx` (1006 lines) + `src/components/pdf-viewer/*`
  (`PdfPage.tsx`, `PdfSkeleton.tsx`, `TextLayer.tsx`, `TtsHighlight.tsx`, `TtsWordHighlight.tsx`,
  `HighlightOverlay.tsx`, `HighlightToolbar.tsx`, `HighlightContextMenu.tsx`,
  `ParagraphActionOverlay.tsx`), mounted when `!libraryShowing` (`src/components/reader/ReaderView.tsx:442`).
  Chrome: `Toolbar.tsx` header (Back to library `:89`, Chapters, Sessions, Open, document title
  `:168`, Settings `:184`), `PageNavigation.tsx` and `ZoomControls.tsx` overlays.
- **Window:** 1200×800 default / 640×600 minimum. The page column centres; at 640 the chrome must not
  crowd the text (this is the reading surface — whitespace is the product).
- **Reader context:** the document is the hero ("honest surfaces" — a real PDF page render, real
  waveform, real progress; no skeuomorphic book). Two postures alternate: **reading along** (eyes on
  text, hands off — the TTS sentence highlight `--color-tts-highlight` and word-level karaoke
  `TtsWordHighlight.tsx` carry the position) and **steering** (keyboard: ←/→/Home/End page jumps,
  `PdfViewer.tsx:890-895`; Ctrl+O open; selection → "read from here" via `ParagraphActionOverlay`).
  Mouse is for text selection → highlight toolbar.
- **States to cover (from the code):**
  - nothing open — "Open a PDF to get started", Ctrl+O hint (`PdfViewer.tsx:908-928`)
  - loading — `PdfSkeleton` (`:933`)
  - error — `pdf-viewer-error` (`:939-951`)
  - scanned PDF — `ScannedPdfWarning` banner mounted at `:961` (`src/components/common/ScannedPdfWarning.tsx`)
  - reading — page + zoom + optional highlight overlay (`HighlightOverlay.tsx`)
  - **speaking** — `TtsHighlight` sentence band + `TtsWordHighlight` karaoke + memory-cap warning
    (`MemoryCapWarning`, imported `PdfViewer.tsx:14`)

## Source spec

- `specs/004-pdf-render-quality/` — the render fidelity the surface must not visually regress.
- `specs/054-reader-redesign/` — the reader-shell layout story.
- `specs/022-karaoke-ui/` + `specs/024-karaoke-fallback/` — the speaking-state language.
- `specs/256-zoom-controls/` / `specs/257-page-controls/` — the overlay controls.
- `docs/brand/brand-spec.md`.

## Required deliverables

1. `index.html` — hi-fi mock covering the six states at 1200×800 and 640×600, with a **real page
   raster** behind (screenshot a corpus PDF page; do not draw a fake page — principle 4 of the brand:
   honest surfaces).
2. `variants/` — exactly two named directions, justified by real use:
   - **Direction A — "Paper room":** maximal page, chrome recedes (auto-hiding overlays), reading
     posture first. Justification: the long-session reader (an hour in a thesis) wants the page and
     the voice, nothing else; controls appear on approach.
   - **Direction B — "Cockpit margin":** persistent slim left/right margin holding navigation, zoom,
     and highlight affordances. Justification: the studying reader jumps pages, zooms diagrams, and
     highlights constantly — persistent beats discoverable when the hand is already on the mouse.
3. `review.md` — 5-dimension critique against renders at both sizes, with the **speaking state
   critiqued for glance-distance legibility** (can you tell, from ~1 m, that the app is speaking and
   where? — brand principle 2: the voice is the feature, speaking state always visible).

## Constraints

- **Numbers:** sentence highlight = `--color-tts-highlight` (speak colour @ 16% — do not invent a
  stronger band); karaoke word emphasis must not shift text metrics (no layout reflow between
  highlighted and plain words); page nav + zoom controls ≥ 24×24px; text contrast per WCAG AA
  (≥ 4.5:1 for UI over page margins); `PdfSkeleton` shimmer respects reduced-motion; highlight
  colours from tokens (`HighlightSettings` palette), never raw hex.
- **Copy pair (this surface):**
  > ✅ "This PDF appears to be a scanned document without a text layer. Text selection, highlighting,
  > and text-to-speech may not work." (`ScannedPdfWarning.tsx:19-25` — names what breaks)
  > ❌ "Oops! This file seems weird 🤔" — vague + emoji + no consequence named (banned register).
- **Brand rules:** blue is the app, **mauve is the voice** — every speaking-state element (sentence
  band, word karaoke, the pulse) is the mauve `--color-speak`; nothing else on this surface may wear
  it. Bird icons only for meaning: narration affordances (`IconNarrateBird`), **not** zoom or paging
  (`lectrice-icons.tsx:464`). Vermilion belongs to the mark, not the reading chrome. Radii 0 on page
  chrome (the page is paper-sharp), 4px on floating controls. Ease-out only.

## Real content

- Toolbar strings verbatim: "Back to library", "Chapters", "Reading Sessions", "Open PDF",
  `currentDocument.filePath` in the title slot (`Toolbar.tsx:89-185`).
- Use a two-column academic PDF page (real corpus raster) with one existing highlight and the
  sentence band mid-paragraph; a scanned-document variant using the actual warning copy.

## Output location

```text
docs/design/flows/reader/
├── brief.md
├── index.html
├── variants/
│   ├── direction-a.html
│   └── direction-b.html
└── review.md
```

## Out of scope

- The playback bar footer (own brief) and empty-state language (own brief).
- Highlight persistence/CRUD behaviour; PDF.js render pipeline; TOC sidebar internals
  (`TableOfContents.tsx` — changes land via their own slices).
