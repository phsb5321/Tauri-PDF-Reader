# 074 App-root reachability — historical same-family Sol review

Date: 01/08/2026 23:03 BRT
Reviewer: `gpt-5.6-sol`, read-only Codex session `019fc031-1f30-7093-8ab7-84e818012375`
Review class: same-family emergency degradation (Terra author → Sol reviewer), **not cross-family**.

## Verdict

**CHANGES REQUIRED** — no BLOCKER; one MAJOR.

The reviewer confirmed that the App-root assertion is honest: it renders `App`,
observes the default Library/Continue-reading surface, activates the rendered
entry, asserts the real `library_list_documents` IPC arguments and
`pdfService.loadDocument` path, and checks the real document-store page 213.
The demonstrated `<App /> → <div />` mutation makes the Library assertion fail.

### MAJOR — coverage ratchet must be measured in this test-only PR

`docs/coverage-budget.md` requires test-only additions to remeasure and ratchet
the applicable floor in the same PR. Iteration 36 recorded headroom, so merely
adding the test and deferring the ratchet would leave the regression gate behind
the new coverage. The review blocks merge until a serial coverage measurement
produces a baseline and the floor/docs are raised accordingly.

### Non-blocking gaps recorded by the reviewer

- The mock accepts unknown commands and does not assert the `id` passed to
  `library_heal_document`/`library_open_document`; existing wrapper contracts
  reduce this risk.
- `PdfViewer` is deliberately stubbed: this gate proves public-shell
  reachability, loading, and store page restoration, not PDF painting.
- The reviewer could not run Vitest in its read-only sandbox because Vite needs
  writable temporary/cache files (`EROFS`); this was an environment limitation,
  not a test failure.

## Resolution and provenance

This artifact preserves the initial review finding; it is not the current 074
disposition and is not an independent-family pass.

- On 02/08/2026, the coverage MAJOR was resolved by one isolated serial run:
  70 files and 890 tests passed; coverage measured 68.58% statements/lines,
  91.41% branches, and 70.65% functions. The checked-in floors were raised to
  68/68/91/70 respectively.
- A later same-family Terra review accepted the App-root outcome and coverage
  ratchet but found that the App fixture did not locally reset its shared IPC
  mock. The repair adds an owning `afterEach` `mockRestore()` and a
  deterministic same-lifecycle regression: the isolation module imports the
  App test, then inspects the exact exported mock before Vitest's unconditional
  end-of-file restoration. Without the local restore, the second test receives
  the permissive implementation; with it, the implementation is undefined.
- The independent-family gate remains unavailable. Do not treat either Sol or
  Terra evidence as a cross-family pass, and do not push or merge on this
  artifact alone.
