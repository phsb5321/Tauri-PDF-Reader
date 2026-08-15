# Corpus negative controls

Last reconciled: 15/08/2026.

Replay (no packaged build or private corpus access):

```bash
bash scripts/corpus-negative-controls.sh
```

Expected result: **23 passed, 0 failed**.

## Contracts

- **NC0 — wiring:** the real runner sources the tested guards and retains the
  private-profile cleanup, exact confirmation-call oracle, and clean source-SHA
  receipt.
- **NC1 — build status:** a forced frontend/native build failure returns
  nonzero and records a build failure; a successful build returns zero.
- **NC2 — EPUB identity:** matching external-manifest identity passes;
  mutated or missing identity fails fatally.
- **NC3 — cover count:** exact N/N passes; missing and stale extra rows fail and
  record `cover-coverage`.
- **NC4 — cleanup:** no SHA-keyed cover remains passes; a stale file fails and
  records `cache-cleanup`.
- **NC5 — displayed/cache tie:** equal decoded-RGBA hashes pass; mismatch or
  one-sided evidence fails and records the appropriate cover failure.
- **NC6 — missing oracle:** a required selector/oracle absence returns nonzero
  and records the blocked condition; BLOCKED is never green.

The controls exercise the same `scripts/corpus-guards.sh` functions invoked by
the packaged runner. They do not inspect book bytes, titles, hashes, or paths.
The final release receipt must run these controls again from the same clean
merged SHA as the full private corpus journey.
