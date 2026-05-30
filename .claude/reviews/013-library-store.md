# Codex Adversarial Review — Spec 013 (Library Store Query Tests)

- **Date:** 2026-05-30
- **Tool:** `codex exec --sandbox read-only` (codex-cli 0.133.0)
- **Final verdict (round 2):** pass — 0 BLOCKER/MAJOR/MINOR.

## Round 1

No BLOCKER. **MAJOR:** the recent-sort test didn't prove `lastOpenedAt` wins
over `createdAt` — the fixture's expected order matched what a broken
createdAt-only sort would also produce. MINOR: filePath case-insensitivity
relied on lowercase input; default-branch untested.

## Fixes

- Added `sorts by recent using lastOpenedAt over createdAt` with a
  discriminating fixture (id a: createdAt 2026-01 / lastOpenedAt 2026-05; id b:
  createdAt 2026-03 / lastOpenedAt 2026-02) → asserts `['a','b']`; a
  createdAt-only sort would give `['b','a']`.
- filePath filter test now uses a mixed-case query (`TaXeS`) → covers filePath
  case-insensitivity too.
- Default-branch MINOR skipped: `sortOrder` is typed `SortOrder`
  (`recent|created|title`); an out-of-range value isn't reachable, and `recent`
  (the `default:` arm) is already tested.

## Round 2

> BLOCKER none. MAJOR none. The new fixture discriminates correctly
> (lastOpenedAt → ['a','b'] vs createdAt-only ['b','a']). MINOR none. Production
> code unchanged. VERDICT: pass.

12 tests pass; typecheck clean. Test-only.
