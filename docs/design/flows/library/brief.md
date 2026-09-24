# Brief — Library, the reading home (Hi-Fi Design Slice)

## Surface

- **Screen / route:** `src/components/library/LibraryView.tsx`, mounted inside `.library-surface`
  whenever `libraryShowing` is true — i.e. `showLibrary || !pdfDocument`
  (`src/components/reader/ReaderView.tsx:354`, rendered at `:430`). It is the **landing surface**: a
  returning reader with nothing loaded starts here. The shell around it: `Toolbar` header
  (`src/components/Toolbar.tsx`), no footer unless audio is playing
  (`ReaderView.tsx:375`).
- **Window:** 1200×800 default / 640×600 minimum (`src-tauri/tauri.conf.json` `width`/`minWidth`).
  The grid must stay usable at 640 — two cover columns is the honest floor, not a squeezed five.
- **Reader context:** picking up where they left off. Mouse-first on this surface (documents open on
  **double-click**, `LibraryView.tsx:245`; delete is a click-again gate, `:239-247`), keyboard for the
  search box and the sort select. Ambient state: usually idle; when narration is still playing over
  the home, the playback bar stays mounted (`ReaderView.tsx:375-385`) and the library must not push it
  off-screen.
- **States to cover (from the code):**
  - loading — `library-view--loading` spinner (`LibraryView.tsx:147-153`)
  - error — retry row (`:156-166`)
  - fresh install — "No recent documents" + the two actions (`:284-313`)
  - shelf with nothing filed — "Nothing on this shelf yet" (`:296-300`)
  - search miss — `No results for "<query>"` (`:326`)
  - populated — grid/list of `DocumentCard`s (`:229-251`), with the `ResumeSection` catch-up shelf
    above the fold and `ShelfSidebar` counts beside it (`:216-228`).

## Source spec

- `specs/073-library-a11y/` — the a11y floor this surface owes.
- `specs/177-library-completeness/` and `specs/202-library-qol/` / `specs/208-library-qol/` — the
  completeness + QOL stories the grid/search/sort serve.
- `specs/275-icon-set/` — the general/branded icon rule the surface consumes.
- `docs/brand/brand-spec.md` — palette, type, geometry, principles.

## Required deliverables

1. `index.html` — hi-fi mock covering **all six states** above at 1200×800 and 640×600, using the real
   tokens and the real cover/title/metadata shapes (`DocumentCard.tsx`, `DocumentCover.tsx`,
   `ResumeSection.tsx`).
2. `variants/` — exactly two named directions, justified by real use:
   - **Direction A — "Catch-up first":** the `ResumeSection` shelf leads, the grid is the workhorse
     below. Justification: the measured behaviour this surface exists for is _resuming_ — the reader
     who opens Lectrice wants the book they were in, one click away, before they want a filing system.
   - **Direction B — "Library as shelf-room":** shelves (`ShelfSidebar` + `DocumentCard` shelf chips)
     lead visually, resume is a compact strip. Justification: the reader with 30+ PDFs organises
     before they read; the room answers "where is that paper?" first.
3. `review.md` — 5-dimension critique against the renders at both sizes (`docs/design/README.md`).

## Constraints

- **Numbers:** cover grid keeps ≥ 2 columns at 640px; search input ≥ 24px hit height; sort select and
  view toggle ≥ 24×24px targets; card title 14px min, body 14px, base 16px (`--text-base`); contrast
  ≥ 4.5:1 (`colors.css` carries the measured ratios); radii 4px chrome / 8px cards (cap); spacing from
  the `--space-*` scale; focus rings visible on cards (keyboard users must reach every card).
- **Copy pair (this surface):**
  > ✅ `No results for "the med"` — Try a different title, or clear the search. (`LibraryView.tsx:326-327`)
  > ❌ "No recent documents" shown for a _failed search_ — the comment at `LibraryView.tsx:266-268`
  > records this exact trap: it implies an empty library, not a missed query.
  > Fresh-install copy must keep the path to Settings visible ("Open Settings" action,
  > `LibraryView.tsx:311-318`) — it is the only surface carrying TTS setup on a fresh install
  > (`:271-274`, slice 112 B3).
- **Brand rules:** blue is the app (`--color-accent`), mauve is the voice — the library is an _app_
  surface, so its accents are blue/general; the bird appears only where meaning is: `IconLibraryBird`
  for the library/home affordance, **never** birded gears or search (`src/ui/icons/lectrice-icons.tsx:464`
  `iconPairs`; brand-spec "The bird goes where the meaning is"). Covers are real first-page renders
  (`useCover.ts`) — honest surfaces, no skeuomorphic book spines. No gradients, no emoji, tokens only.

## Real content

- Section headings as shipped: "Library" (`:169`), the catch-up shelf (`ResumeSection.tsx`), "Your
  library" (`LibraryView.tsx:214`).
- Sort options verbatim: Recently Opened / Date Added / Title (`:181-183`); view toggle Grid/List
  (`:188-196`).
- Use real-feeling Brazilian academic titles (the corpus is Pedro's papers/theses) — 6–10 documents,
  2 shelves, mixed read/unread progress, one document mid-book at page 147/312.

## Output location

```text
docs/design/flows/library/
├── brief.md
├── index.html
├── variants/
│   ├── direction-a.html
│   └── direction-b.html
└── review.md
```

## Out of scope

- Behaviour changes (heal-on-open, click-again delete) — visual only.
- The playback bar (own brief: `playback-bar/`) and the empty-state _language_ (own brief:
  `empty-states/` — this brief sizes them, that brief voices them).
- Collections CRUD flows inside `ShelfSidebar`.
