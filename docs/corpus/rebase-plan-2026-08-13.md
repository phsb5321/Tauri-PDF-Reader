# Corpus rebase plan — integration points 13/08/2026

Authoritative date: 13/08/2026 (BRT), 17:24. Branch: `125-corpus-runner` @ `b439646`
(base `8848fc3` = #121 merged). Prerequisite PR heads verified live 17:21 BRT.

## Prerequisite state (live)

| Gate     | PR                                                                                                                   | Head      | Files that intersect this branch                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| open     | #122 `124-macos-open`                                                                                                | `7a9464e` | `src/hooks/useOpenPdf.ts`, `src/services/pdf-service.ts` — **no file overlap** with branch                                                                        |
| contrast | #123 `125-contrast-aa`                                                                                               | `fd76850` | `src/components/library/DocumentCard.css`, `wdio.conf.mjs` — **no file overlap** (branch touches neither)                                                         |
| covers   | (PR not yet open) `121-cover-pipeline` pushed @ `6e8dbd6` (rebased onto 4fe30e3; feat `1c8cc1d` + backlog `6e8dbd6`) | —         | **`src/e2e-native-bootstrap.ts` (both touch)**; `DocumentCard.tsx/css` (my selectors' home); `pdf-service.ts` (shared with #122); new `e2e/cover-journey.e2e.mjs` |
| ci       | #119 `123-packaged-ci-owned`                                                                                         | `7729988` | `.github/**` + runner ops — no overlap                                                                                                                            |

## Verified compatibility (live diffs, 17:21)

1. **#122** adds `WRONG_DOCUMENT`/`OPEN_CANCELLED` open-flow states but does NOT
   change the `PDF_INVALID` string — the epub/corrupt negative controls' oracle
   is safe. Post-merge, corpus open benefits from the reauthorize flow.
2. **#123** is color-token only; `document-card-open` / `document-card-meta`
   classNames are TSX-side and untouched.
3. **Covers branch** keeps `.document-card-open` (DocumentCard.tsx:141,199) and
   `.document-card-meta` (:162,229) — the corpus card-open selectors survive.
   Its `DocumentCover.tsx` matches the corpus spec's cover selector
   (`[class*='DocumentCover']`).
4. **Covers bootstrap diff** does NOT touch `ipcDocumentRowPageByTitle` /
   `libraryListDocuments` — the corpus branch's IPC-throw probe (commit
   `cd696aa`) has **no textual conflict** with the covers restructure.

## Rebase plan (execute per merge, in order)

### When #122 merges (open)

1. `git fetch origin main && git rebase origin/main` — expected clean (no overlap).
2. Re-run `bash scripts/corpus-negative-controls.sh` → must stay 23/23.
3. Re-check `PDF_INVALID` still emitted for corrupt/epub inputs (grep pdf-service).

### When #123 merges (contrast)

1. Rebase — expected clean (CSS-only, no overlap).
2. Controls 23/23.
3. Spot-check `.document-card-open` visibility on the contrast theme (visual
   gate; packaged run still held, so this is a code-grounded check only).

### When covers PR opens AND merges (cover)

1. Rebase — the ONLY expected conflict surface is `src/e2e-native-bootstrap.ts`
   if both branches' hunks abut; resolution: keep covers' cover-probe
   additions AND the corpus IPC-throw (`res.status !== "ok"` → throw). Verify
   with `git diff` that `ipcDocumentRowPageByTitle` retains the throw.
2. **Cover phase flips from BLOCKED to live**: the corpus runner's cover-cache
   proof (`covers/{SHA}-*`, NC5 ties, cross-book distinctness) becomes
   assertable. Re-run controls 23/23; the BLOCKED legs remain valid only as
   negative tests.
3. Verify the covers cache filename (`{docId}-v{FORMAT_VERSION}-{width}x{height}.png`)
   matches the runner's `covers/${SHA}-*` glob (docId == content SHA — yes).
4. Update `docs/corpus/manifest-2026-08-13.md` known-limitations note if the
   cover surface changes the corpus journey's expectations.

### When #119 merges (ci)

- No branch impact (workflows only). No rebase needed beyond normal sync.

## Hold

Full private-corpus run remains HELD until open+cover+contrast merge. The
rebase plan above is executed per merge; the controls are re-run after EVERY
rebase; the packaged run is only eligible once all three gates land and the
23/23 controls still pass on the final head.

## Monitoring

PR-head monitor: `scripts/corpus-pr-monitor.sh` (background poll, logs head
changes to /tmp/lectrice-corpus-pr-heads.log). Rebase triggers: any of
#122/#123/covers-PR head changes OR merge events.

## Conflict map — 13/08/2026 17:52 BRT (exact heads, verified live)

Heads reviewed: contrast `a47d6ba` (+WIP contrast-capture), cover `7b4e76f` (+WIP:
cover-journey lane, cover.rs, cover-runner-contract, useCover), open local `980db38`
(PR head `7a9464e`). Corpus branch: `125-corpus-runner` (22 commits).

### File-overlap matrix (vs corpus branch files)

| Prereq   | Overlapping files                                     | Verdict                                 |
| -------- | ----------------------------------------------------- | --------------------------------------- |
| contrast | **none** (CSS, contrast lane, wdio.conf.mjs)          | no textual conflict                     |
| open     | **none** (useOpenPdf, ReaderView, pdf-service, tests) | no textual conflict                     |
| cover    | **`src/e2e-native-bootstrap.ts` ONLY**                | **textual conflict expected on rebase** |

### Bootstrap conflict (the one textual surface)

- Corpus hunk: `@@ -177,7 +177,13 @@` — the `ipcDocumentRowPageByTitle`
  throw (lines 174–186 of the corpus file).
- Cover hunks: `@@ -79,6 +79,12 @@` (interface cover-probe), `@@ -102,36`,
  `@@ -143,12`, `@@ -181,6 +205,17 @@` (installE2ENativeBootstrap).
- Old-line ranges overlap at 181–183 → **git will raise a conflict**.
- **Resolution (trivial, known)**: keep BOTH — the cover-probe additions in
  the interface + installE2ENativeBootstrap, AND the corpus IPC throw in
  `ipcDocumentRowPageByTitle`. Re-verify with `git diff` that the throw
  (`res.status !== "ok"` → throw) survives; then re-run 23/23 controls.

### Semantic integration points (no textual conflict, behavior-affecting)

1. **contrast wdio.conf.mjs = the cwd/bindings fix the corpus run NEEDS.**
   tauri-driver now spawns from `src-tauri` cwd (BINDINGS_PATH), fixing the
   "Failed to export TypeScript bindings" panic in packaged debug runs. The
   corpus packaged run is effectively BLOCKED until #123 merges (pre-#123 the
   lane would panic on launch). This is the "fix cwd by rebasing #123" item.
2. **cover e2e-profile.sh adds `XDG_CACHE_HOME="$E2E_PROFILE_DIR/cache"`.**
   The corpus runner sets its own per-book `XDG_CACHE_HOME="$BOOK_PROFILE"`
   AFTER sourcing e2e-profile.sh, so the corpus value wins and the post-verify
   cache checks (`$BOOK_PROFILE/com.lectrice.reader`) keep working — but only
   while the per-book override stays. Do NOT remove it on rebase.
3. **cover cache filename `{doc_id}-v{FORMAT_VERSION}.png`** (domain/cover.rs
   file_name) matches the corpus NC5 glob `covers/${SHA}-*` (doc_id == content
   SHA) → no naming break; the corpus cover phase flips BLOCKED→live on merge.
4. **open ReaderView.tsx changes** (reauth surface + session-restore test) do
   not touch any corpus-asserted element (Toolbar .document-title,
   PageNavigation input/.total-pages, library card classes). Post-merge
   code-grounded re-verify only.
5. **open + cover BOTH touch src/services/pdf-service.ts** — a two-way merge
   surface between THEM (not the corpus branch); whichever lands second must
   rebase against the other. Corpus is unaffected (does not touch that file).

### Rebase execution order (per merge, then controls 23/23 after EVERY rebase)

1. #123 contrast → brings the wdio cwd fix (corpus run unblocked).
2. #122 open → clean rebase; re-verify PDF_INVALID still emitted.
3. covers PR → the ONE expected textual conflict (bootstrap) with the known
   resolution above; cover phase flips live; re-verify cache naming + e2e-profile
   XDG_CACHE_HOME override retention.
