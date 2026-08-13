# Changelog

All dates are the merge date of the PR that landed the change. "Receipt" links
to the PR body or the test that proved the change — this project's rule is
that a claim about behavior is backed by a runnable assertion, not a glance.

## Unreleased — v0.2.0 candidate

The tree between `v0.1.0` (21/06/2026) and today is the v0.2.0 candidate:
84 commits across ~46 PRs. **No tag has been cut for v0.2.0.** Cutting the tag
is a release decision (release.md) — this changelog documents what a release
would say, using the receipts that exist today.

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
- **Keyboard shortcuts panel derives from the real bindings** — the panel
  can no longer advertise a chord that does not exist ([#111]).
- **UI tracks OS text size**: rem replaces fixed-pixel font sizes across the
  app, enforced by a stylesheet oracle ([#83], [#108], [#111]).

### Fixed (selected, all with receipts)

- Closing the window no longer drops a pending highlight save: the
  close-flush protocol was added for both writers, and the packaged
  close-journey lane proves **highlights survive** a genuine window close
  inside the save debounce (dl1 PASS; [#113]). **Reading position is not yet
  proven** on that path (dl2-verify FAIL, per [#115]) and remains an open
  defect — see `docs/KNOWN_LIMITATIONS.md`.
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

### Known limitations (see `docs/KNOWN_LIMITATIONS.md` for the full list)

- **Fast-close verification position (track A)**: the close-flush protocol is
  shipped ([#113]) and **highlights survive** a driver-mediated genuine window
  close (dl1 PASS). **Reading-position persistence under fast close is an open
  defect** (dl2-verify FAIL, [#115]: relaunch lands on page 2 instead of 3).
  The E2E harness additionally cannot deterministically deliver `CloseRequested`
  (documented BLOCKED in `docs/agent-backlog-state.md`). Three separate
  facts: protocol has direct test coverage; dl1 passes the drivable path;
  dl2 fails it — and the harness has its own nondeterminism on top.
- **Fixture-vs-live TTS**: packaged E2E drives a deterministic fixture engine,
  not live ElevenLabs. The live path needs an API key and is not exercised in
  CI.
- **Linux artifact reality**: AppImage + deb only; no macOS/Windows packaged
  build or test exists.

### v0.2.0 release-note draft

> **Lectrice v0.2.0 — read aloud.**
>
> This release is the first big step past v0.1.0's "a reader that speaks":
> your library remembers where you stopped and resumes on one action;
> highlights survive restarts and a quick close (reading position on fast
> close remains an open defect — see KNOWN_LIMITATIONS); PDFs load fully
> offline (no CDN); the shortcuts panel tells the truth; and the interface
> now scales with your OS text size.
>
> **Platform:** Linux AppImage + deb. (macOS/Windows builds are not shipped
> in this release.)
>
> **Data:** the only outbound request is to ElevenLabs when you ask a page
> to be read aloud; the API key is session-only. Full contract in
> `SECURITY.md`.
>
> See `CHANGELOG.md` for the receipt-backed list.
>
> _Release gate: cutting v0.2.0 must also bump `package.json`,
> `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` from 0.1.0 to 0.2.0
> together — a tag on the current tree would publish artifacts that still
> identify as 0.1.0. The bump is intentionally NOT in this docs slice; it
> belongs to the release slice._

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
