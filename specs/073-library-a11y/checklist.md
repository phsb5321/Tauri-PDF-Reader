# Checklist

- [x] Hexagonal boundaries unchanged; CSS/test only.
- [x] No direct Tauri `invoke()` added.
- [x] No capability, asset, or filesystem scope change.
- [x] No secrets, document contents, telemetry, or network behavior added.
- [x] Offline behavior unchanged; verification is fully local.
- [x] Frontend acceptance behavior is covered by a runnable assertion.
- [x] Backend is unchanged, so no backend test is required for this slice.
- [x] Accessibility impact is positive and numerically enforced.
- [x] Frontend lint, typecheck, full Vitest suite, targeted acceptance test, and
      diff check pass locally.
- [ ] Cross-family review is clean — **BLOCKED:** three Claude CLI attempts
      returned no verdict text. Quality/Terra will perform an independent
      same-family emergency review on the commit; label it as degraded coverage.
      Its pre-commit MAJOR (unmechanized `prefers-contrast: more`) was followed
      by a Terra FAIL on the committed diff: the synthetic overlay ignored CSS
      specificity and the translucent playback error banner missed AA after
      compositing. Both are repaired in the amended diff with discriminating
      cascade/scope and rendered-surface contracts. The next committed review
      found a further BLOCKER: runtime TSX `<style>` sheets were outside the
      inventory, hiding undefined warning/info roles and an invalid white-on-
      accent foreground. The inventory now parses only JSX style elements,
      fails closed on dynamic forms, and validates those sheets with the same
      token/foreground/size rules; the named components use measured semantic
      pairs. A new verdict is pending.
- [x] Rollback is one revert PR; see `rollback.md`.
