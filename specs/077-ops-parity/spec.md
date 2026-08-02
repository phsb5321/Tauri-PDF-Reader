# Spec 077 — Operational parity: session-only provider secret

**Feature Branch:** `077-ops-parity`
**Created:** 02/08/2026
**Status:** In progress
**Input:** DeliCasa operational-parity protocol plus Product and Quality audits.

## User scenarios and testing

### User Story 1 — Provider key stays in the current app session (P1)

As a reader, I can connect ElevenLabs without Lectrice storing my provider key
in WebView persistence or SQLite, including after upgrading from a version that
did persist it.

**Independent test:** plant a legacy version-0 `ai-tts-storage` payload with a
canary key, hydrate the production store, and prove the canary is absent from
state, local storage, session storage, recorded settings/SQLite persistence
calls and initialization calls. Set a new key, prove the persisted payload
contains only non-secret preferences, then construct/hydrate a fresh production
store and prove the key is null, auto-initialization stays at zero and the UI
requires re-entry.

### User Story 2 — Remote text transfer is explicit and accessible (P1)

As a keyboard or screen-reader user, before connecting ElevenLabs I am told
that AI TTS sends the text I ask Lectrice to speak to ElevenLabs. Closing or
cancelling sends no request; activating Connect is the explicit boundary.

**Independent test:** render the production settings component with mocked
ports. The disclosure is programmatically associated with the key field, the
key is password-masked by default, the visibility and close controls have
stable accessible names/state, no initialize call occurs before submit, cancel
stays at zero calls, and rapid duplicate submit through explicit Connect calls
initialize exactly once.

### User Story 3 — Operational debt remains honestly sequenced (P2)

As a maintainer, I can distinguish shipped controls, false-green controls,
missing controls, YAGNI items, and Pedro-gated workflow/sync work.

**Independent test:** every `present` row in `gap-matrix.md` names current file
evidence and a falsifier; gated work is unchecked and absent from the diff.

## Requirements

- **FR-001:** The persisted `ai-tts-storage` payload MUST NOT contain `apiKey`.
- **FR-002:** Hydration MUST strip `apiKey` from legacy persisted payloads
  before application effects can observe it.
- **FR-003:** A normal reset MUST clear in-memory key state; it MUST NOT claim
  to disconnect or erase the backend copy while the process is alive.
- **FR-004:** The key MUST never be passed to settings/SQLite persistence. A
  mocked frontend boundary MUST record every such call and find zero canary
  occurrences; no native schema or backend work is required.
- **FR-005:** After a current key is set, a fresh production-store hydration
  MUST expose `apiKey === null`, cause zero automatic provider initialization,
  and render the setup/re-entry state.
- **FR-006:** Non-secret voice, speed and auto-page preferences MAY remain
  persisted.
- **FR-007:** The first-connect UI MUST visibly and accessibly name ElevenLabs
  and disclose that requested PDF-derived text leaves the device for speech
  generation.
- **FR-008:** Connect MUST be the explicit network boundary; close/cancel and
  visibility toggles MUST cause no initialization request.
- **FR-009:** The key input MUST be `password`-masked by default. Secret
  visibility and close controls MUST have stable accessible names, and the
  visibility control MUST expose and test its pressed/state transition.
- **FR-010:** Rapid duplicate submission while initialization is pending MUST
  call initialize exactly once.
- **FR-011:** Tests MUST use an unmistakably invalid canary and mocked ports;
  no real key, PDF content or network is permitted.
- **FR-012:** No backend, database schema, Tauri capability, workflow, sync,
  Notes, service, token or dependency change is in scope.
- **FR-013:** Workflow/sync activation remains `[pending] Pedro` and MUST NOT be
  represented as completed or locally simulated.

## Edge cases

- Legacy storage has no version field, malformed state, a null key, or extra
  unknown fields.
- The user closes setup with a typed key, toggles visibility repeatedly, or
  submits twice while initialization is pending.
- Initialization fails: the key may remain in current-process memory for retry
  but must never be serialized.
- Existing non-secret preferences survive the storage migration.

## Success criteria

- **SC-001:** The legacy canary hydration test and current-write test both pass;
  searching storage snapshots and recorded settings/SQLite calls finds zero
  canary occurrences.
- **SC-002:** Targeted component tests prove zero initialization calls before
  explicit Connect and on cancel, then exactly one under rapid duplicate
  Connect submission; the input starts masked and its accessible state toggles.
- **SC-003:** After setting a current key, a fresh production-store hydration
  yields a null key, zero auto-initialization calls and re-entry-required UI.
- **SC-004:** Targeted lint, typecheck and tests exit 0 sequentially; `git diff
  --check` is clean.
- **SC-005:** Product and Quality return no BLOCKER/MAJOR on the immutable head.
- **SC-006:** A saved different-family verdict is bound to the exact base/head
  diff before push or merge; same-family Sol/Terra does not satisfy it.

## Non-goals / follow-ons

Gitleaks/Semgrep, SECURITY/privacy policy, diagnostic redaction, removal/cache
recovery, bundled offline CMaps, telemetry truthfulness, OS secret-store
persistence, evidence receipts, AGENTS/CLAUDE drift and supply-chain workflows
remain separate reversible slices. No public/generated Docs repository is
justified today.
