# Rollback 008

All changes are configuration, metadata, and documentation — no schema, no data
migration, no generated-binding change.

## Full rollback
```bash
git revert <008-commit-sha>   # single commit
```

## Partial rollback (restore prior behavior fast)
- **fs reopen breaks for some path:** widen the offending token in
  `src-tauri/capabilities/default.json` `fs:scope.allow` (e.g. add
  `{ "path": "$DOWNLOAD/**" }`), or temporarily restore `{ "path": "**/*" }`.
  Rebuild.
- **Any asset-protocol regression (not expected):** restore
  `app.security.assetProtocol.scope` in `src-tauri/tauri.conf.json` to its prior
  value. Rebuild.

## Verification after rollback
`pnpm typecheck && pnpm lint:boundaries` and a Tauri build; open + reopen a PDF.

No state cleanup required — the app's SQLite DB and tts_cache are untouched by
this slice.
