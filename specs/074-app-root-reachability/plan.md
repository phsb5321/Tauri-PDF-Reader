# Plan — App-root reading-home reachability

## Design

Add one integration-style jsdom assertion at the highest stable frontend root:
`App`. Keep PDF painting leaves mocked because the contract is shell
reachability and resume state, while retaining the real ReaderView, Library,
stores, and mockIPC boundary.

The slice predates the fleet SpecKit mandate; these artifacts record the frozen
acceptance and already demonstrated RED before the branch is committed.

## Test-first path

1. Render `App` with an in-flight 213/585 document returned by mockIPC.
2. Assert the Library and Continue reading semantics before interacting.
3. Activate the visible document button and assert PDF loading plus page 213 in
   the production document store.
4. Prove the reachability falsifier by temporarily replacing `App` output with
   an empty element; the Library assertion must fail.
5. Add explicit Testing Library cleanup after the serial suite exposed stale
   DOM across files.
6. Measure coverage once in an isolated serial process and ratchet all four
   integer floors to the measured baseline.

## Boundaries and risk

- No production or domain behavior changes; Tauri capabilities, security, and
  privacy are unchanged.
- Leaf mocks mean this test cannot claim PDF painting or process-bootstrap
  reachability. The packaged native journey remains in the user-gate backlog.
- The mock's permissive default is bounded by an exact assertion on the library
  list command and existing typed wrapper contracts.

## Rollback

Revert the single 074 commit. This removes only the App-root regression test,
global test cleanup, SpecKit evidence, and coverage-floor increase.
