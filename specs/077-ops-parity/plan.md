# Plan 077 — Session-only provider secret

**Branch:** `077-ops-parity` | **Date:** 02/08/2026 | **Spec:** `spec.md`

## Summary

Use Zustand's existing persistence mechanism rather than adding a secret store:
persist only non-secret preferences and add a versioned migration that deletes
the legacy `apiKey` before rehydration. Keep the key in production state only
for the current process. Add the smallest accessible disclosure and explicit
Connect boundary to the existing settings form. No new dependency or backend.

## Technical context

- **Language:** TypeScript 5.6, React 18, Zustand 5.
- **Files:** `src/stores/ai-tts-store.ts`,
  `src/components/playback-bar/AiTtsSettings.tsx`, its existing CSS only if
  necessary, and targeted tests.
- **Testing:** Vitest + Testing Library with mocked Tauri/API ports; single
  worker/fork and sequential checks.
- **Constraint:** local frontend-only diff; no network/native/full-suite run
  until the targeted slice is reviewed.

## Constitution check

- Hexagonal boundaries: PASS — store/UI and existing hook boundary only.
- Typed IPC ratchet: PASS — no command or wrapper changes.
- Test first: REQUIRED — legacy-payload and pre-connect tests RED before code.
- Design system: PASS — reuse existing styles/tokens; no new component system.
- State management: PASS — retain the existing Zustand store.
- Verification discipline: PASS when the planted canary and zero-call boundary
  mechanize both claims; visual inspection is not evidence.

## Hypothesis and falsifier

**Hypothesis:** The provider key persists because `partialize` serializes
`apiKey`; a legacy payload can still rehydrate it after that field is merely
removed. Versioning/migrating the store to delete legacy keys, plus excluding
the key from current persisted state, contains it to the current process. The
settings form lacks egress disclosure; associating explicit disclosure with the
field/form and making Connect the only initializing action makes the boundary
honest and testable.

**Falsifier:** if a legacy canary reaches hydrated state/initialization or any
current persisted payload, containment is false. If initialize is called before
Connect or by cancel/visibility actions, the disclosure boundary is false.

## Implementation sequence

1. Write and run only the legacy/current-storage RED.
2. Write and run only the disclosure/no-call RED.
3. Add the minimum store migration and persisted-field change.
4. Add disclosure/accessibility labels without inventing consent services.
5. Run targeted ESLint, typecheck, both targeted tests, then diff checks.
6. Product and Quality review the immutable commit read-only.
7. Obtain a saved different-family review before any push/CI/merge decision.

## Rollback

One `git revert <077-squash-sha>` PR restores the prior frontend behavior. No
schema, stored user data or external service is created. A rollback would
reintroduce key persistence and must therefore be treated as a security
regression, not a routine preference.
