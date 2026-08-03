# Rollback

Revert the eventual squash commit in a normal PR:

```bash
git revert <073-squash-commit>
```

The change has no data migration, persisted-state change, dependency update, or
backend side effect. Reverting restores the prior CSS fallbacks and token values.
