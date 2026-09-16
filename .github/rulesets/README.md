# Repository rulesets

`main.json` is the versioned source of truth for the live GitHub ruleset.
Committing it alone does not change GitHub settings.

The rule requires pull requests, signed linear history, resolved review threads,
and strict up-to-date product/security checks; it blocks deletion and
force-push. Approval count remains zero so the solo maintainer can merge a
reviewed green PR.

Applied on 26/08/2026 as ruleset `21615185` after the macOS runner security
review found the repository had no live branch protection.

Create or update:

```bash
# First application
gh api repos/phsb5321/Tauri-PDF-Reader/rulesets \
  --method POST --input .github/rulesets/main.json

# Existing ruleset
gh api repos/phsb5321/Tauri-PDF-Reader/rulesets/21615185 \
  --method PUT --input .github/rulesets/main.json
```

Verify the effective rule, not just this template:

```bash
gh api repos/phsb5321/Tauri-PDF-Reader/rulesets/21615185
gh api repos/phsb5321/Tauri-PDF-Reader/rules/branches/main
```

Emergency reversal is `PUT` with `"enforcement":"disabled"`; never use an
admin merge, force-push, or bypass as recovery.
