# Changelog

All dates are the merge date of the PR that landed the change. "Receipt" links
to the PR body or the test that proved the change — this project's rule is
that a claim about behavior is backed by a runnable assertion, not a glance.

## v0.2.0 — 16/08/2026

What version 0.2.0 contains. Everything between `v0.1.0` (21/06/2026) and this
entry, each change landed by a squash-merged PR. The published artifacts are
built from whichever commit carries the `v0.2.0` tag, which is the commit that
passed the checks in `docs/corpus/release-decision-checklist-2026-08-13.md`. The three version fields (`package.json`,
`src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`) read `0.2.0`, so artifacts
built from this tree identify as 0.2.0, and the `v0.2.0-rc.0` dry run built and
verified exactly those artifacts first
(`docs/corpus/rc-evidence-2026-08-15.md`).

> Platform note for the release: packaged builds and packaged E2E exist for
> **Linux only** (AppImage + deb). Nothing in this changelog claims macOS or
> Windows — there is no packaged evidence for them in this repository.

### Added

- **Offline PDFs**: pdf.js CMaps are bundled locally; the app no longer makes
  CDN egress to jsDelivr. Receipt: [#97] (08/08/2026) + `SECURITY.md`.
- **Document library with reading progress**: the home lists documents and
  shows where each one stopped. Receipt: [#91] (resume line), [#89]
  (resume-and-play).
- **Resume-and-play**: with an ElevenLabs key configured, one action lands
  on the right page and starts narrating; without a key, the reader resumes
  silently and the home explains setup. Receipts: [#89], [#104], [#114] —
  the packaged session-journey lane proves restore opens the right document
  _and_ the right page.
- **Highlight persistence proven**: packaged highlight-journey lane creates a
  highlight and proves it survives a relaunch ([#100], [#102], [#113]).
- **Real first-page covers**: the home shows each book's own first page,
  rastered by pdf.js into a narrow Rust-side cache with a deterministic
  fallback and cleanup on delete ([#126]). Cards expose the cover as
  decorative and carry a truthful control name — click selects, Enter and
  double-click open ([#129]).
- **Books whose file grant lapsed reopen**: a stored book that lost its
  filesystem authorization is reauthorized through the dialog and the opened
  bytes are hash-bound to the stored identity before the reader displays them
  ([#122]).
- **Deleting a book is a proven journey**: the packaged delete lane asserts
  the row and its cached audio both go ([#124]).
- **Keyboard shortcuts panel derives from the real bindings** — the panel
  can no longer advertise a chord that does not exist ([#111]).
- **UI tracks OS text size**: rem replaces fixed-pixel font sizes across the
  app, enforced by a stylesheet oracle ([#83], [#108], [#111]).

### Fixed (selected, all with receipts)

- Closing the window no longer drops a pending write. The close-flush
  protocol covers both writers ([#113]), and after the autosave-snapshot
  rework in [#125] the packaged close lane proves **both** data-loss paths on
  a genuine close inside the save debounce: the highlight survives (window
  gone at 387 ms) and the reading position survives (window gone at 401 ms,
  persisted row and restarted reader both on page 3). This closes the defect
  [#115] left open.
- Dark mode no longer drops rules: the duplicated/invalid dark blocks were
  merged and repaired, and contrast is now bound by executable contracts
  ([#123], [#127]).
- Failed opens are no longer silent; a dismissible error banner surfaces
  `PDF_INVALID` and friends ([#109], [#110]).
- Settings no longer shows a dead "native TTS" panel or a telemetry fiction;
  the AI-TTS setup is reachable without a document open ([#105], [#109],
  [#110]).
- Session restore lands on the correct page of the correct document
  ([#104], [#114]).
- Deleting a book attempts to clear its cached audio — files and metadata
  (best-effort; a cache failure is logged and never blocks the delete)
  ([#107]).
- Offline CMaps (above) removed the last outbound egress besides ElevenLabs
  ([#97]).

### Changed / engineering

- Test coverage ratchets raised to CI-measured floors (lines/branches/etc.;
  [#96]).
- The E2E toolchain lives in one pinned place — the flake devShell ([#101]);
  all packaged lanes share one hermetic profile entry point ([#99]).
- The security contract is executable: a test asserts the Tauri CSP,
  capability allowlist, and fs scope ([#90]); `SECURITY.md` documents the only
  outbound egress (ElevenLabs) with file:line receipts.
- Secrets hygiene: API keys are session-only ([#73]); a secret scanner guards
  the repo.
- CodeQL actually runs — it had never executed once before it moved to the
  self-hosted runner ([#116]) — and the repository ends this cycle with zero
  open code-scanning alerts ([#132]).
- The packaged user gate has a three-stage trust anchor and parser-based
  workflow checkers, so a lane cannot report green by measuring its own
  harness ([#119]).
- Release evidence is exact-SHA and fail-closed: a private real-book corpus
  lane opens five full-length PDFs, ties each displayed cover to its cached
  bytes, and refuses to run from a dirty tree or to clean resources it does
  not own ([#130], [#131]). No private bytes, titles, hashes, or paths enter
  this repository or its CI artifacts.

### Known limitations (see `docs/KNOWN_LIMITATIONS.md` for the full list)

- **Fixture-vs-live TTS**: packaged E2E drives a deterministic fixture engine,
  not live ElevenLabs. The live path needs an API key and is not exercised in
  CI.
- **Linux artifact reality**: AppImage + deb only; no macOS/Windows packaged
  build or test exists. The close, cover, corpus and session evidence above is
  Linux/X11/WebKitGTK scoped.

### v0.2.0 release-note draft

> **Lectrice v0.2.0 — read aloud.**
>
> This release is the first big step past v0.1.0's "a reader that speaks":
> the home shows each book by its own first page and remembers where you
> stopped; one action resumes and narrates; highlights *and* your place
> survive a restart and a quick close; PDFs load fully offline (no CDN); the
> shortcuts panel tells the truth; and the interface now scales with your OS
> text size.
>
> **Platform:** Linux AppImage + deb. (macOS/Windows builds are not shipped
> in this release.)
>
> **Data:** the only outbound request is to ElevenLabs when you ask a page
> to be read aloud; the API key is session-only. Full contract in
> `SECURITY.md`.
>
> See `CHANGELOG.md` for the receipt-backed list.

## v0.1.0 — 21/06/2026

Initial tag. A Tauri 2.x desktop PDF reader with text highlighting and
AI text-to-speech (ElevenLabs) reading selected passages aloud. The tag
predates the offline-CMAP, library-progress, resume-and-play and close-flush
work listed above.

[#73]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/73
[#83]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/83
[#89]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/89
[#90]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/90
[#91]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/91
[#96]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/96
[#97]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/97
[#99]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/99
[#100]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/100
[#101]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/101
[#102]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/102
[#104]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/104
[#105]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/105
[#107]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/107
[#108]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/108
[#109]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/109
[#110]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/110
[#111]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/111
[#113]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/113
[#114]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/114
[#115]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/115
[#116]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/116
[#119]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/119
[#122]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/122
[#123]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/123
[#124]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/124
[#125]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/125
[#126]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/126
[#127]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/127
[#129]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/129
[#130]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/130
[#131]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/131
[#132]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/132
