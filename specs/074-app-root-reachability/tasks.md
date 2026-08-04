# Tasks — App-root reading-home reachability

- [x] T001 Freeze Pedro's home/progress/resume outcome at the public App root.
- [x] T002 Add the App-root test and demonstrate the empty-App RED falsifier.
- [x] T003 Restore production App and pass the targeted test.
- [x] T004 Add explicit Testing Library cleanup for cross-file DOM isolation.
- [x] T005 Run one audited isolated serial coverage measurement: 70 files and
      890 tests passed; 68.58 statements/lines, 91.41 branches, 70.65 functions.
- [x] T006 Ratchet floors to 68 statements/lines, 91 branches, 70 functions and
      record the measurement in `docs/coverage-budget.md`.
- [x] T007 Run targeted lint/typecheck/diff checks after the ratchet edit.
- [x] T008 Obtain Product review of these reconstructed SpecKit artifacts.
- [x] T009 Add fixture-owned IPC mock teardown and prove shared-mock isolation
      with a deterministic same-lifecycle RED/GREEN regression.
- [ ] T010 Obtain an independent-family adversarial review of the committed
      scoped diff; same-family Sol/Terra evidence is degradation only.
- [ ] T011 Hand Quality the amended commit SHA, exact commands/results, and
      falsifiers.

## TDD evidence

- RED mutation: with `App` temporarily returning an empty element,
  `pnpm exec vitest run src/__tests__/ui/app-root-reachability.test.tsx --pool=forks --poolOptions.forks.singleFork`
  failed at the missing Library heading.
- GREEN: restoring the production root made the same command pass 1/1.
- Isolation RED: with only the fixture-owned `mockRestore()` omitted,
  `pnpm exec vitest run --config tests/app-root-isolation.vitest.config.ts --pool=forks --poolOptions.forks.singleFork`
  failed because the isolation module read the App fixture's real permissive
  implementation from `mockInvoke.getMockImplementation()`.
- Isolation GREEN: after local `mockInvoke.mockRestore()`, the same command
  passed 1 file / 2 tests. `mockRestore()` is required because Vitest 2.1.9's
  `mockReset()` replaces the implementation with an empty function rather than
  making `getMockImplementation()` undefined.
- Coverage GREEN: `pnpm exec vitest run --coverage --pool=forks --poolOptions.forks.singleFork`
  passed 70 files / 890 tests in one isolated process.
