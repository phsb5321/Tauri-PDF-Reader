# Checklist 077 — Session-only provider secret

- [x] Audit marker emitted before project mutation.
- [x] Worktree path ends in `-077-ops-parity`; main remains read-only.
- [x] Product classes the key S4 and PDF-derived text P3.
- [x] Quality/local-control gaps remain explicit and unclaimed.
- [ ] Legacy version-0 payload cannot rehydrate a key.
- [ ] Current persisted payload contains no key but retains safe preferences.
- [ ] Mocked settings/SQLite persistence calls contain zero canary occurrences.
- [ ] Fresh production-store hydration after setting a key yields null key,
  zero auto-initialization and re-entry-required UI.
- [ ] Reset wording/behavior does not claim backend disconnection.
- [ ] Disclosure names ElevenLabs and PDF-text egress, associated accessibly.
- [ ] Key input is password-masked by default; accessible show/hide state tracks
  the actual input type.
- [ ] Close/cancel/visibility cause zero initialization calls.
- [ ] Rapid duplicate Connect causes exactly one initialization call.
- [ ] Tests use invalid synthetic canary and mocked ports; no network/native.
- [ ] No backend, schema, capability, workflow, sync, Notes or dependency diff.
- [ ] Targeted lint, typecheck, tests, formatting and diff checks green.
- [ ] Product and Quality typed reviews bind the immutable head.
- [ ] Different-family typed verdict binds exact base/head/diff.
- [ ] Safe PR merged and confirmed `state=MERGED`, or honestly blocked before push.

**Rollback:** `git revert <077-squash-sha>` in one PR.
