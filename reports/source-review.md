# 255 — Historical pre-hook source review

This section preserves the pre-hook snapshot and its original hashes/status. It is not current-head authority. Subsequent hooks,8f/d27 reviews and the measured CI failure/import-only exception are recorded in `reports/DELIVERY.md`. The old source manifest remains historical; no raw8/8 parity is claimed after formatting. The new import-corrected source is unverified.

15/09/2026. GeneratorOpenAI; reviewer full `zai/glm-5.3`, public judge, `avoidFamily=openai`, bounded120s. New checker fully inlined; actual package diff and existing Vitest integration block/import/root context supplied. Three axes: correctness/regression ALLOW; test/reward-hacking ALLOW; security/data-loss ALLOW. No blocking source findings. This is not a runtime, CI, merge or perfect-score verdict.

Pre-hook source identifiers (historical):

- package.json: `1f7d7a9c3554b836305add8a47a3e2aab3b468e5c1a4c30555223dea3c7caf25`
- tools/test/analysis-enforcement.test.mjs: `890dee0bcbdace433891ebd452e0f16aa704b2b7d572497909b4582f74ed8ba9`
- `src/__tests__/integration/verify-receipt.test.ts`: `d0d1bf830aacc2a6e84a8b8f1478d2dc06e2e6414b3f91706cd42f3dd3fb9483`

Nonblocking observations: confirm CI Node20's test-concurrency support in the actual run; nested timeouts5s fail red on excessive delay; Bash is an explicit Linux CI prerequisite; exact script-string pin deliberately requires review for future legitimate flag changes. No threshold/exclusion/test weakening recommended or applied.

After review was launched, authorized251 final2 evidence arrived: actual baseline exit1, candidate exit0/3of3, source+baseline8of8 unchanged,225 restored/window158/restore0,4.267s. These log values were read directly from the durable slot directory. Wrapper/type/lint/hooks/CI still unexecuted; code uncommitted/unmerged. Prior candidate/diagnostic RED logs preserved;2/2 budget exhausted, no additional repair authorized.

Separate native-policy review: same different-family route ALLOWed the exact additive main-only CodeQL all-severity POST before application. Active rule23477091/effective API and original-rule parity verified; details in reports/DELIVERY.md and external codeql-enforcement-receipt.json. Native policy is diff-bounded and not proof of zero legacy findings.
