# 251 — integration plan

## Technical Context

Base: current main 047cc4f2e4d6deba6f65c2d37755235fe1f47f05. Frozen 248 is based on 86b03ba plus a 36-file inherited reader seed. `reports/evidence/source-preflight.json` pins all four candidate manifests; only 248 library-owned files are selected. Its library store baseline equals main; LibraryView differs by unrelated inherited Settings UI, which is excluded by applying only the authored diff against 248 HEAD. Existing Zustand, React, Vitest and library/shelf helpers suffice; no dependency or abstraction added.

## Minimal sequence

1. Preserve frozen 248 original file/hash evidence; check the exact two-file diff against main. Original GLM code/tests are not independently qualified yet.
2. Obtain full GLM-5.3 external evaluation of this OpenAI integration plan. No legacy Opus/Terra pipeline or extra author launched.
3. In the explicitly transferred serialized safe slot, replay the exact frozen 248 test and existing library regressions, then typecheck. Retain collection/fixture failures, not a green no-tests result. Existing controllers own close/restore; no worker controls services.
4. One original worker receives measured failures within 248's remaining two-round cap. Re-freeze and replay; do not rewrite its completed draft spec or import unrelated files.
5. Apply only the qualified store/LibraryView delta and regression test into 251. Keep `getFilteredDocuments` API; selector memo keys must be documents/query/order; existing mutation flows replace document arrays. Review module-level cache/lifetime and React external-store snapshot stability.
6. Run targeted lint/typecheck, unchanged library-store/search/resume/shelves regressions plus the imported tests, and seed-based fuzz in a bounded slot. Native journey remains blocked until an authorized packaged fixture/runner exists; never equate unit success to native acceptance.
7. Exact-head Codex Sol gate for Chinese-frontier-authored code covers correctness, regressions, requirement trace, security/data loss and reward hacking. Separately review any substantive OpenAI-generated integration correction using full GLM-5.3. Required verification/hooks/protected CI remain binding, no bypass or same-family done verdict. Safe merge only when all gates truly clear.

## Resource / ownership

Portfolio pB retains next 249-only slot and shared runner edits until explicit restoration/release. 251 then owns the queue including 252's requested small TS slice. Max315-second existing controller bound remains. No full suite/native/hydration by default, no live-reader mutation by workers, no global cleanup, no release action. Planning/source/hash checks are not product acceptance.

## Reversal

Before publication, reverse only the specific imported diff in 251; never reset a shared tree. If safely merged, one `git revert <squash-sha>` PR reverses this library-only slice.
