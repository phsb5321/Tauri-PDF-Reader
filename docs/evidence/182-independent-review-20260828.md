# Issue #182 independent review record

## Generator and subject

- Generator family: OpenAI
- Base: `origin/188-source-aligned-prosody`
- First reviewed final head: `1c8274f`
- Product repair: `4453baa`
- Post-repair executable head: `6cb46b4229da678af422c23118afa245d652199a`

## Capable different-family first pass

The Anthropic reviewer returned `VERDICT: BLOCK` with two actionable findings:

1. **BLOCKER — reader page changes did not invalidate the private no-mark queue/highlight clock.** Native Stop ran, but an old estimated completion could speak the previous page’s successor and Continuous could dispatch a second stale prefetch.
2. **MAJOR — bridge idempotency replay could replace “Latest uncached” with a ~5 ms cache result.** Missing generated-audio duration also rendered as a perfect `0.000 RTF`.

The reviewer cleared the remaining planner, explicit-Play privacy, provider-switch, bridge digest/Unicode/WAV/idempotency, typed metadata, and evidence surfaces.

## Repairs

- `AiPlaybackBar` invalidates queue generation when the shared page authority differs from the queue page; natural auto-page clears the completed queue first.
- Every native stopped event clears the estimated highlight store.
- Deferred Continuous page-turn regression proves no later prefetch or speech dispatch.
- Local `X-Cache-Hit` crosses the synthesizer result; only `from_cache == false` updates performance.
- RTF is optional when audio duration is unavailable; UI displays unavailable rather than zero.
- Cached-replay and missing-duration tests pin both truth contracts.
- Both packaged actors delete an old receipt before launch. The real-model lane starts a fresh pinned service so a prior bridge replay cannot masquerade as an uncached sample.

Post-repair evidence:

- exact full verification: 11/11 at `6cb46b4`;
- mandatory hook: 410 Rust tests plus all contracts;
- deterministic packaged Performance journey: PASS at `4453baa`;
- fresh-service real Magpie packaged journey: PASS at `affb815`;
- retained fail-first stale-receipt/cache-replay traces under `182-magpie-packaged-real-attempts-20260828/`.

## Final gate availability

No final `ALLOW` exists. The exact repaired repo-aware Anthropic rerun was killed after 1,200 seconds with exit 143. A smaller isolated capable fallback was refused before spawn because no fresh different-family bearer was available. DeepInfra remains unfunded. These are unavailable gates, not approvals.

**Current verdict: BLOCKED — independent final ALLOW unavailable.**
