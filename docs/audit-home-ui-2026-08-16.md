# Home / Library UI audit — 16/08/2026

**Seat:** UX · **Base:** `f63818e` (origin/main) · **Worktree:** `../tauri-pdf-reader-147-home-audit` (branch `147-home-audit`)
**Method:** packaged app run for real (tauri-driver + WebKitGTK + Xvfb, hermetic profile, `flock /tmp/lectrice-heavy-gate.lock`, `TMPDIR=/tmp`), seeds `empty | single | dual | cover` × themes light/dark × widths 1200/640.
**Harness added (audit artifacts, no product change):** `e2e/home-audit-capture.e2e.mjs`, `scripts/home-audit-capture.sh`.
**Evidence:** 16 PNGs `/tmp/lectrice-audit-<seed>-<theme>-<width>.png`; DOM-geometry + computed-style probes logged in `/tmp/lectrice-audit-<seed>.log`.

## Status when landed — updated 17/08/2026

This report measured `f63818e`. It is landed as a **dated snapshot plus a
reusable harness**, not as a live gap tracker — read the Status column in §1
before acting on any row. Changes since the measurement:

- **Covers are no longer cropped.** PR #145 (`f4316ef`, now in `main`) changed
  `DocumentCover.css` to `object-fit: contain` — the whole first page is shown,
  letterboxed on the subtle background. Every "crop" / "centre-top bias"
  observation in §3 below described the pre-`f4316ef` `object-fit: cover` and is
  **superseded**. The 2:3 `aspect-ratio` that drives gap #1 is unchanged.
- **Gap #1 (card fold, slice S1) is in flight** in branch `151-card-fold`.
- **Gaps #3 and #4 (cover-led resume line, empty-state primary action — slices
  S3 and S2) are in flight** in branch `152-cover-led-home`.
- Gaps #2, #5, #6 are still open as measured; #7 is a platform floor, not a bug.

"In flight" is the work assignment as of this date, verified only as a branch —
not a claim that the fix has landed or been verified. `f4316ef` in `main` **is**
verified (`git merge-base --is-ancestor f4316ef origin/main`).

## Vision honesty note

This seat's route (deepseek-v4-flash) cannot render image attachments, and the vision-capable lanes were refused this session (Claude oracle hold; Codex unavailable; AskClaude hold). **No human-level aesthetic verdict is claimed.** Every finding below is a **measurement** (DOM rects, computed styles, pixel histograms/bbox from the captured PNGs) or **code** (file:line). Where a call is judgement-derived it is marked `[needs vision]`.

## Measured context

- Inner viewport: 1151×767 at 1200×800; 767×767 at the "640" request (the window enforces a ~767px min — a platform/GTK minimum, not a responsive rule).
- The home is a single column: library content x=24…1128 (no app sidebar on this surface; the shelf sidebar occupies x=24…224 inside the library body).
- Grid: 4 columns × ~210 px at 1151 (fits: right=1128 < 1151); 2 columns × ~244 px at 767 (fits: right=744 < 767).
- Grid viewport height: **317 px (single) / 214 px (dual, cover)** — grid starts at y=383 (single) / y=485 (dual/cover).
- Card: cover 209×313 (ratio 0.667) + content ≈ 90 px → card ≈ 403 px tall.
- Dead (pure-background) fraction of the window: empty 16–18 %, single 24–31 %, dual 26–35 %, cover 30 %. — **provenance (added 17/08/2026):** the dead-fraction and colour-histogram figures in this report came from an **ad-hoc pixel pass over the PNGs, which is NOT part of the landed harness**. The harness reproduces the PNGs and every DOM/computed-style probe, but re-running it will not regenerate these percentages. Treat them as recorded observations of the 16/08 captures, not as reproducible assertions.
- `hScroll` probe: `scrollWidth = innerWidth + 1` everywhere — a **1 px artifact**, not real content clipping.
- Headings: H1 Library → H2 Continue reading → H3 Also in progress → H2 Your library → H3 card titles — sequential in every capture. ✓

## (1) Numbered gap list

Status column added 17/08/2026; the gap text itself is the 16/08 measurement,
unedited.

| # | Gap (measurement/code) | Evidence | Cause (file:line) | Status (17/08/2026) |
|---|---|---|---|---|
| 1 | **Card text (title / pages / progress) is below the grid's fold.** Grid viewport 214–317 px; card needs ≈403 px. In dual/cover even the 313 px cover is cut at ~214 px; in single ~all of the card text (starts ≈y696) is clipped off the 700 px grid bottom and reachable only by scrolling the grid. | `lectrice-audit-cover-dark-1200.png` (cards y485, grid bottom 699); rects in `lectrice-audit-cover.log` | `LibraryView.css` `.library-grid{overflow-y:auto;flex:1}` (~L120) + `min-height:0` on `.library-body` (~L114) squeeze the grid; `DocumentCover.css` `aspect-ratio:2/3` (~L10) makes cards too tall to fit. | **In flight** — slice S1, branch `151-card-fold`. Do not re-fix. |
| 2 | **Seeded homes are mostly dead space.** Grid occupies 214–317 px of a 767 px viewport; 24–35 % of the window is bare background; right column tracks are empty with 1–3 books. | `lectrice-audit-single-dark-1200.png` (dead 24 %), `lectrice-audit-cover-light-1200.png` (dead 30 %) | `LibraryView.css` grid `repeat(auto-fill, minmax(200px,1fr))` (~L128) fixed 2:3 card size with no density/height strategy. `[needs vision]` for the aesthetic weight, but the dead fraction is measured. | **Open** — slice S6, deliberately after S1–S3 change the composition. |
| 3 | **"Continue reading" resume line has NO cover** — text-only hero (title + full-width bar + buttons). The cover-led home goal (design packets) is not met; the resume section and "Also in progress" rows are text-only. | `lectrice-audit-single-dark-1200.png` (resume y168–292), probe `resumeCoverCount=0` | `ResumeSection.tsx` `ResumeLine` — no `DocumentCover` import (file imports only Button/IconButton/ListRow). | **In flight** — slice S3, branch `152-cover-led-home`. Do not re-fix. |
| 4 | **Empty-state action mismatch (first-run).** Text: "Open a PDF to add it to your library" — only action: **Open Settings**. Opening a PDF is only reachable from the top toolbar ("Open PDF file", `Toolbar.tsx:92`). | `lectrice-audit-empty-light-1200.png`; probe `emptyState.action=["Open Settings"]` | `LibraryView.tsx` `LibraryEmptyState` (~L248–300) — no `onOpenDocument`; only `onOpenSettings`. | **In flight** — slice S2, branch `152-cover-led-home`. Do not re-fix. |
| 5 | **1 px horizontal document overflow** (`scrollWidth = innerWidth + 1`) — cosmetic scroll artifact, no content lost. | probe `hScroll=true`, `scrollW=1152/1151` | `AppLayout.css:5` `width:100vw` (or a 1 px sibling). | **Open** — slice S5. Cosmetic; no content lost. |
| 6 | **Resume progress bar spans the full library width (1104 px)** for a single book's 40 % — visually disproportionate (bar reads as a full-width track, not a book's progress). | `lectrice-audit-single-light-1200.png` (resume line rect w=1104) | `ResumeSection.css` `.resume-line-bar` (~L36–48) width 100 % of the resume line. | **Open** — slice S4. |
| 7 | **No true narrow breakpoint** — 640 request yields 767 (hard window min); at 767 the layout holds (2 cols, right 744<767) but dead space rises to 30–35 %. | `lectrice-audit-dual-light-640.png` (dead 35 %) | none (platform min-width). `[needs vision]` for crowding. | **Won't fix** — platform/GTK window floor, not a responsive rule. |

**Not gaps (verified):** covers exact 2:3, load for every card, fallback sane (see §3); heading hierarchy sequential; no gradients, no 3-icon rows, no 100vh hero, no invented copy (grep: no `gradient` in library CSS; raw hex only inside tolerated legacy `var(--x, #fallback)` fallbacks); theme flip correct (histograms: Latte light / Mocha dark); empty state flex-centered (`EmptyState.css`).

## (2) First-time user with an EMPTY library

Sees a centered empty state: document icon (64 px, 50 % opacity, secondary colour), "No recent documents", "Open a PDF to add it to your library", and one button **"Open Settings"**. Can they get anywhere? Yes — the top toolbar has the real "Open PDF file" affordance and Settings opens the AI-TTS setup — but the empty state itself does not lead with opening a book, which is the described first action (gap #4). Nothing is broken or blocking; the surface under-sells its own primary action.

## (3) Covers

- **Present and correct aspect:** every `.document-cover` measures ratio 0.667 (2:3) in all 16 captures — grid sm/md and (probe) none broken.
- ~~**No stretch:** `object-fit: cover; object-position: 50% 0%` (`DocumentCover.css` ~L20) — crop, centre-top bias (title-safe).~~
  **SUPERSEDED 17/08/2026 by PR #145 (`f4316ef`, in `main`):** covers are now
  `object-fit: contain` — the entire first page is shown, letterboxed on the
  subtle background, nothing cropped. The measurement above was accurate for
  `f63818e` and is kept for the record only.
- **Load for every card:** probes: single/dual → all `data-state="ready"` (real first-page rasters — white fixture pages visible in histograms); cover seed → 2 `ready` + 1 deterministic `fallback` (mauve token mix `#3D3B52`, glyph) for the corrupt `e2e-coverless.pdf`. Fallback is sane: seeded palette variants from semantic tokens, no broken-image.
- **Missing:** no cover on the resume line or "Also in progress" rows (gap #3).

## (4) Ranked smallest-slice plan (each slice independent, ordered by impact ÷ size)

Slice status added 17/08/2026: **S1 is in flight in `151-card-fold`; S2 and S3
are in flight in `152-cover-led-home`.** They are listed here as the audit
ranked them — this is not an invitation to re-do them.

1. **S1 — Make card text visible without grid scrolling.** *(in flight — `151-card-fold`)* Fit covers to the grid viewport height (e.g. cover max-height from container, or grid becomes the outer scroller and cards stop clipping at `min-height:0`). Fixes gap #1 — the most visible "unfinished" defect. Files: `LibraryView.css`, `DocumentCover.css`. Verify: card bottom ≤ grid bottom in packaged probes; text (title/progress) inside the fold.
2. **S2 — Empty-state primary action = "Open a PDF".** *(in flight — `152-cover-led-home`)* Wire `onOpenDocument` through `LibraryEmptyState` (reuse the toolbar's open flow), Settings becomes the secondary action. Fixes gap #4 (first-run path). File: `LibraryView.tsx` (+ prop from the shell).
3. **S3 — Cover-led resume line.** *(in flight — `152-cover-led-home`)* Add a `lg` `DocumentCover` beside the resume text (and `sm` covers on "Also in progress" rows) — the design goal. Files: `ResumeSection.tsx` + CSS. Verify: cover renders, resume still opens stored page.
4. **S4 — Resume bar proportional width.** Cap the bar at the book's share instead of 100 % width. File: `ResumeSection.css`.
5. **S5 — Kill the 1 px overflow.** `AppLayout.css:5` `width:100vw` → `width:100%` + overflow guard; verify `scrollWidth == innerWidth`.
6. **S6 (needs vision) — density/whitespace pass at 1151 and the 767 floor**, after S1–S3 change the composition; re-measure dead fraction per seed.

Deferred/out of scope: window min-width 767 (platform), shelf-sidebar responsive behaviour at <767, `docs/ui/*.md` stale (003-era pre-Catppuccin token tables — a docs-fix slice on its own).

## Receipts

- 16 PNGs: `/tmp/lectrice-audit-{empty,single,dual,cover}-{light,dark}-{1200,640}.png`
- Probe logs: `/tmp/lectrice-audit-{seed}.log`
- Harness: `e2e/home-audit-capture.e2e.mjs` + `scripts/home-audit-capture.sh` (commit in `147-home-audit`)
- Re-run: `AUDIT_SEED=<empty|single|dual|cover> TMPDIR=/tmp bash scripts/home-audit-capture.sh` (under the heavy lock)

**What the harness does and does not reproduce (verified 17/08/2026 on `f4316ef`,
seed `single`):** it rebuilds the frontend and the debug binary, boots the
packaged app under Xvfb with a hermetic `/tmp` profile, switches theme through
the visible Settings controls, writes the four PNGs per seed, and logs one
`PROBE <theme>-<width>` line per capture with viewport, heading order, card and
cover boxes (incl. `data-state` and measured ratio), `resumeCoverCount`,
computed `grid-template-columns`, overflow flags and named element rects. The
17/08 re-run reproduced the report's geometry exactly (`gridCols` 209.89 px × 4
at 1200, 243.87 px × 2 at the 767 floor, first card at y=383, `scrollW` 1152 vs
`innerWidth` 1151). It does **not** compute pixel histograms or dead-space
fractions — see the provenance note in §Measured context.
