# Research: Fleet Alignment Recovery

**Date**: 2026-08-20
**Repository baseline observed**: `31b47c1113a0d184c960cef18cb52190efa4cd7b`; advanced during planning to `6b3fa9eaeb68ccc24b99d520df4a16d6dd02828c` by the recorded #147 sequence deviation.

No clarification question was required. The brief fixes the user outcome; live repository/release evidence resolves platform and current-state questions; the immutable graph resolves branch identity; the Constitution resolves delivery gates.

## R1 — Product north star

**Decision**: Rank all work against one complete first-reader loop: open a PDF, start narration, close normally with process termination, relaunch without acknowledged-data loss, and resume the same document/page.

**Rationale**: README and `docs/JOURNEY_EVIDENCE.md` establish Lectrice as a local-first PDF reader that reads aloud and already map each component journey. The missing authority is composition and queue ranking, not another visual objective.

**Alternatives considered**:

- Rank the dated home-audit gaps first: rejected because those gaps are polish unless they prevent the loop.
- Treat release v0.2.0 as sufficient acceptance: rejected because the release receipt is exact for its older tag, not current main.

## R2 — Fresh-profile narration and credential boundary

**Decision**: Keep credential-required narration as current product scope. A fresh/no-key state must provide an honest actionable setup path; configured or fixture-backed Play must cross the narration boundary. Do not persist the key and do not call its intentional absence a bug.

**Rationale**: `src/stores/ai-tts-store.ts` persists selected voice, speed, and auto-page preference while deliberately excluding `apiKey`; README explicitly states ElevenLabs requires a session-only API key. Product acceptance therefore includes setup/refusal plus successful Play, not credential-free audio by implication.

**Alternatives considered**:

- Persist the key to make every restart immediate: rejected because it weakens an explicit credential-hygiene decision and is outside recovery.
- Adopt Kokoro now: rejected for this recovery. `specs/055-kokoro-offline-voice/decision.md` proves the Python pipeline's timing contract, rejects the obvious JS/ONNX route at ≥0.44 s highlight error, and leaves embedded-interpreter/sidecar packaging as the genuine cost decision.
- Accept an honest refusal as “narration started”: rejected. Refusal is only the no-key branch; fixture/configured Play still must pass.

## R3 — Current release and platform scope

**Decision**: Scope automated acceptance to packaged Linux/WebKitGTK/X11 with the deterministic fixture.

**Rationale**: `v0.2.0` at `545c377` published verified AppImage/deb assets. `docs/KNOWN_LIMITATIONS.md` records macOS as buildable but not drivable and Windows as unproven. Live ElevenLabs is external and not exercised in CI.

**Alternatives considered**:

- Add Mac/Windows recovery acceptance: rejected as a new platform feature and impossible under current actor boundaries.
- Use a live API key in CI: rejected on credential/network nondeterminism and privacy grounds.

## R4 — PR #147 disposition and sequence breach

**Decision**: #147 is worthwhile post-release polish. Accept squash `6b3fa9e` despite its pre-079 landing; record the breach and update 079 normally rather than reverting. Before final `A`, land a targeted test-only repair for two later accepted oracle findings.

**Rationale**: Graph evidence proves local `2a0569d` and remote `511f70d` are patch-identical, so the review-requested form-control CSS fix was present on the PR head. Product/QA returned ALLOW and exact-head checks passed. A later DeepSeek Pro gate found two MAJOR false-greens in the sweep: active input value/enabled-submit states were never exercised, and `color(srgb)`/`color-mix()` parse failures were silently skipped. The CSS remains token-correct; repairing the oracle is lower-risk than reverting product code.

**Alternatives considered**:

- Treat dark-on-dark controls as automatically north-star blocking: rejected absent a packaged failure of the open/narrate/resume controls.
- Revert and re-land after 079: rejected as sequence theater.
- Believe the claim that `2a0569d` never shipped: refuted by range-diff, empty tree diff, and remote-head content.

## R5 — PR #152 disposition and stale measurement

**Decision**: #152 remains worthwhile post-release polish and frozen until 079 lands. Refresh it after #147, then rerun its card-fold/uncropped harness before any merge/close decision.

**Rationale**: Its remote head `cf488dc` is genuinely unmerged, but its measured geometry predates `31b47c1`, which inserted a larger resume composition above the grid. Textual mergeability cannot validate layout evidence. The existing harness is the cheapest correct re-measurement.

**Alternatives considered**:

- Close as duplicate because main's commit message mentions #152: refuted by file diff and `git cherry`; the mention is issue-level.
- Merge on the old table because checks are green: rejected; checks and measurements address different heads/surfaces.

## R6 — Complete-ref preservation and divergent tips

**Decision**: Preservation is complete under 23 exact `origin/preserve/20260820-*` refs. Every later inventory enumerates all local refs dynamically; no named-worktree count is accepted as complete. Content classifications remain evidence-specific rather than inferred from preservation.

**Rationale**:

- The first graph report's “3 local-only tips” was false because it scoped the scan to named worktrees.
- `/tmp/lectrice-local-only-tips-20260820.tsv` adds 19 omitted zero-remote-containing local tips. Those 19 plus 122/125/143 and deleted local 145 yield 23 preservation refs, independently verified with remote refs.
- Local 145/151 feature patches equal their remote PR-head patches; file-tree diffs are empty.
- `6594d40` tree equals merged #125 squash `03aca597`.
- `26939d9` tree equals merged #123 squash `ecefd016`.
- From their shared pre-feature base, the combined `143-fix-targetdir` feature diff has the same stable patch-id as merged #143 squash `8745d17e`. The branch is on a stale base, so its whole tree differs from the squash/current main; no tree-identity claim is made.
- Preservation protects provenance; it does not make an omitted tip duplicate or stale without a complete-ref disposition.

**Alternatives considered**:

- Keep the three-tip ledger: rejected by the held-out all-ref scan.
- Use ancestry or per-commit `git cherry` alone: rejected because squash merges erase direct ancestry and can change per-commit patch matching.
- Use a raw whole-tree diff to falsify 143 equivalence: rejected because base drift produces expected unrelated deltas; compare the common-base combined feature patch-id/range-diff.
- Replay preserved tips: rejected unless the durable complete-ref inventory proves an unsuperseded current outcome.
- Delete because tree content exists: rejected until topology and untracked/dirty work are both classified.

## R7 — Executable acceptance

**Decision**: Add one composed packaged north-star actor on one profile/revision, while retaining existing open/native-play/close/home lanes as component diagnostics.

**Rationale**: Separate lanes prove parts but cannot prove the cross-boundary composition or that the process ended before relaunch. The Constitution requires a runnable assertion for the user-visible claim.

**Alternatives considered**:

- Aggregate independent lane exit codes into one report: insufficient for continuity across one profile.
- Human visual confirmation: banned for a mechanizable state journey.

## R8 — Targeted-fix exemption

**Decision**: Allow a new-spec exemption only for the smallest root-cause repair of one already-named failing north-star scenario, with fail-before/pass-after evidence and no new outcome, dependency, persisted-data shape, or authority/security widening.

**Rationale**: This preserves speed for a regression without letting “targeted” become an unreviewed feature class. Normal CI, independent review, user gate, one worktree, and merge rules still apply.

**Alternatives considered**:

- No exemption: creates process overhead for a bounded regression.
- Broad “small diff” exemption: rejected because line count does not bound product/security scope.

## R9 — Two-phase tracked receipt

**Decision**: Freeze accepted main as `A`; run all non-receipt acceptance at `A`; create receipt-only child `R` with first parent `A`; at `R`, assert `HEAD^ == accepted_main_sha` and that `HEAD^..HEAD` changes only the enumerated receipt envelope.

**Rationale**: A tracked file cannot contain the SHA of the commit that contains itself. Any contract that requires `receipt SHA == HEAD` is physically self-referential and impossible.

**Alternatives considered**:

- Write a placeholder and amend with the resulting SHA: every amend changes the SHA again; rejected.
- Leave the receipt untracked/external: loses the required durable repository evidence.
- Bind to `HEAD` without naming it: too weak; unrelated changes could enter the receipt landing.

## R10 — Spec Kit integration

**Decision**: Accept the bundled Spec Kit 0.16.5 Pi integration update, all ten prompts, refreshed scripts/templates, and unchanged Constitution.

**Rationale**: `specify init . --integration pi --force` installed the upstream lifecycle offline. Pre/post Constitution SHA-256 is `408ebe4aef9304338d4100d170f8ac9c8fe87486cc686c22fd27d5e7758a4951`.

**Alternatives considered**:

- Hand-copy only missing prompts: rejected because it creates a mixed-version lifecycle.
- Rewrite the Constitution during initialization: forbidden; the initializer preserved it.
