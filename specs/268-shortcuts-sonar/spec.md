# Feature Specification: 268 — shortcuts Sonar fix + announce frame cleanup

Post-merge follow-up to 262 (`c97a7cb`), which left the Sonar quality gate RED
with `new_violations = 2` on `KeyboardShortcuts.tsx`, and which exposed a
pre-existing state-update-after-teardown leak while its required Frontend /
Coverage check ran under load.

## User Scenarios & Testing

### US1 — The quality gate is clean again (P1)

The two new-code findings are gone without changing behaviour: the panel shows
the same keycaps and the same grouping, and the component no longer reads the
deprecated `navigator.platform` nor switches behaviour on a boolean parameter.
Tested by the existing 262 suite (8 cases) plus the DOM-context case, which now
stubs the **user agent** — the signal the code actually reads.

### US2 — An announcement never updates an unmounted tree (P1)

`useAnnounce` schedules a `requestAnimationFrame` whose callback sets state; the
frame was never cancelled on unmount, so a frame landing after teardown called
`setState` on an unmounted tree and react-dom then threw `window is not
defined`. The frame id is tracked and cancelled in the unmount cleanup
(the auto-clear timeout already was).

## Acceptance

- `vitest run keyboard-discoverability-262 + shortcut-consistency` → 8 passed.
- `vitest run hooks/useAnnounce` → 21 passed, including the new unmount case.
- Removing the `cancelAnimationFrame` call makes that suite fail (10 failed /
  11 passed) — the assertion is not vacuous.
- `pnpm lint` 0 errors, `pnpm typecheck` exit 0, `pnpm test:coverage` exit 0.
- Post-merge Sonar gate returns to `new_violations = 0`.

## Boundaries

Only the four already-changed files: `src/components/settings/KeyboardShortcuts.tsx`,
its 262 test, `src/hooks/useAnnounce.tsx`, and its test. No new dependency, no
config, no workflow, no behaviour change beyond cancelling a frame that should
never have outlived its component.
