# Spec 053 — Deterministic delivery harness

## Goal

Provide one locally reproducible, fail-closed path from a scoped product slice
to deterministic checks, a real native reader smoke, a different-family
adversarial review, and an auditable evidence report:

```text
spec slice → deterministic checks → product smoke → adversarial review → evidence report
```

This slice reuses the repository's existing tests, alignment gate, native
Tauri/WebDriver smoke, fixture PDF, and TTS fixture. It does not add a second
test stack or simulate reader state from the browser.

## User stories

### US1 — One delivery front door (P1)

As a maintainer, I can discover and run the normal deterministic checks with
`make verify`, the full local proof with `make verify-full`, and the complete
different-family delivery gate with `make gate`.

### US2 — Real reader acceptance path (P1)

As a maintainer, I can run a bounded native smoke that:

1. obtains a test PDF path from a debug-only Rust fixture command;
2. opens it through the production local-file/PDF.js and library-persistence
   paths;
3. renders and extracts its intended text;
4. clicks the real visible play control and invokes the real Tauri TTS command;
5. consumes backend-provided word marks and observes synchronized highlighting;
6. pauses, resumes, and stops through visible controls;
7. navigates previous/next and seeks by page input;
8. restarts/reopens and restores the persisted page;
9. injects one debug-only backend TTS failure, shows an accessible error, then
   dismisses it to a clean idle state.

The fixture makes no provider request and emits no audio-device output.

### US3 — Evidence that fails closed (P1)

As a reviewer, I receive per-step logs/status, planted-fault red→green proofs,
the candidate SHA, an independent Qwen verdict bound to that candidate, and a
report that is generated only when every required gate passed.

## Functional requirements

- **FR-001**: Add a small self-documenting Makefile; the repository currently
  has no Makefile or justfile.
- **FR-002**: A doctor target must detect the supported platform and required
  tools before expensive work.
- **FR-003**: Every required gate must write a log and exact exit status under
  ignored `.artifacts/`; the report must reject missing/non-zero statuses.
- **FR-004**: The product smoke must drive the built Tauri app through
  WebDriver. It must not use the old browser bridge to set production stores or
  synthesize playback events.
- **FR-005**: The fixture PDF must be opened by `pdfService.loadDocument(path)`
  and the existing library service, not by URL or an artificial document.
- **FR-006**: Speech must begin from the visible play control, traverse
  `ai_tts_speak_with_timestamps`, and use backend marks that are monotonic and
  cover the requested text.
- **FR-007**: Pause/resume/stop, page navigation/seek, restart persistence,
  injected error, and cleanup must use bounded waits.
- **FR-008**: Icon-only playback controls need accessible names and the playback
  error needs alert semantics.
- **FR-009**: PDF-path and TTS-failure helpers must compile only under the
  existing non-default `e2e-tts-fixture` feature. Release builds must retain the
  existing compile-time fixture guard.
- **FR-010**: Native smoke state must live under temporary XDG directories and
  be cleaned on success, failure, or signal.
- **FR-011**: `make gate` must run a fresh, sanitized, read-only Qwen review of
  the candidate diff. Tool failure, `BLOCK`, or an unrecognized first line
  fails closed; raw output is retained.
- **FR-012**: This slice must not modify workflows, release/signing,
  capabilities, filesystem scope, production credentials, or network policy.
- **FR-013**: Normal verification must remain sequential and resource-bounded
  per this repository's `AGENTS.md`.

## Success criteria

- `make doctor` reports a supported Linux native-smoke environment.
- `make test-fast` passes targeted harness/frontend/backend checks.
- A planted break to the production play/IPC wire makes the native smoke fail;
  restoring the wire makes it pass.
- A planted `BLOCK` makes the adversarial verdict gate fail and a planted
  `PASS` makes it pass.
- `make verify-full` produces green deterministic/build/smoke evidence.
- `make gate` records an initial `PASS` from Qwen and generates a report bound
  to the candidate SHA.

## Deliberate deferrals

- Audio-timeline seeking is not a current Lectrice product capability. This
  smoke proves page-position seeking; audio seek semantics need a dedicated
  product spec.
- Audible waveform/voice quality remains a bounded human check.
- Kernel network isolation is deferred because this sandbox cannot bring up
  loopback inside an unshared namespace; the fixture remains network-independent.
- New SCA, fuzz, and mutation frameworks are deferred until a measured target
  and planted fault justify them.
- WebDriver cannot operate a native GTK file dialog. A debug-only Rust command
  supplies the fixture path, after which the production file/PDF/library flow
  is used.

## Reversal

Revert the eventual squash merge in one PR:

```bash
git revert <squash-merge-sha>
```
