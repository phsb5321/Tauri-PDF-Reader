# Plan — Spec 053

## Design

1. Add a `.NOTPARALLEL`, strict-shell Makefile that composes existing checks.
2. Add small defensive shell helpers for doctor, evidence capture, report
   generation, and the external Qwen verdict.
3. Extend the existing `e2e-tts-fixture` Rust surface with:
   - a scoped fixture-PDF path;
   - one-shot speech failure injection;
   - deterministic pause/resume/stop behavior.
4. Change the native bootstrap to open the fixture via the real local-file and
   library paths, with observation-only browser state plus the single explicit
   failure control.
5. Extend the existing native-play WebDriver spec across render, speech marks,
   pause/resume/stop, navigation/seek, restart persistence, error, and cleanup.
6. Isolate native smoke state in temporary XDG directories, choose a free
   driver port, and replace blind startup sleeps with bounded readiness.
7. Add explicit accessible names and alert semantics required by the smoke.
8. Update the persistent loop skill and backlog handoff.

## Verification order

1. shell syntax and Makefile dry discovery;
2. verdict parser negative control (`BLOCK` red, `PASS` green);
3. targeted frontend and Rust tests;
4. lint and typecheck;
5. planted production-wire break: native smoke red→restore→green;
6. `make verify-full`;
7. clean candidate commit;
8. fresh Qwen review against `origin/main...HEAD`;
9. `make gate` and evidence report.

Run one heavy process at a time and use one frontend worker / Cargo `-j 1`.

## Non-goals

- no CI workflow changes;
- no production TTS/provider behavior changes;
- no capability or filesystem-scope widening;
- no release/signing/deployment work;
- no generic framework beyond the few shell entrypoints needed here.
