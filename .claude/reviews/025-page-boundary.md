# Codex Adversarial Review — 025-page-boundary (P1 #7 pt.4)

- **Date:** 2026-05-31
- **Commit reviewed:** `73d3734`; test-strengthening amended to `f1c0619` (no production change).
- **Tool:** `codex exec --sandbox read-only` (Codex v0.134.0, gpt-5.5)
- **Scope:** `git diff origin/main...HEAD` — `src/lib/tts-tracking.ts` (+`resolveCharRange`), `src/components/pdf-viewer/TtsWordHighlight.tsx` (rewire `createWordRange`), `src/__tests__/unit/tts-range.test.ts`.

## Verdict: PASS

**BLOCKER / MAJOR / MINOR:** none.

Codex confirmed (and ran `tsc --noEmit` itself → passed):
- `resolveCharRange` correct: `charOffset >= total` → null; start uses `>` (exact node-boundary starts move to next node); end uses `>=` (exact-end not clamped); `target > total` clamps to the last node with `clamped: true`, **fixing the old "clamp to start node" bug**.
- `createWordRange` rewire is directionally correct: collects all text nodes, delegates the arithmetic, `setStart(nodes[startIndex], startOffset)` / `setEnd(nodes[endIndex], endOffset)`. Multi-node spans preserve the old intent; page-boundary overruns now reach the last text node instead of only the start node.
- No new deps, no `src-tauri`/capability/Tauri config change, no new `invoke`; the component imports only a `src/lib` util.

**TEST GAPS (Codex) — ADDRESSED in amend `f1c0619`:**
1. The overrun-clamp test (`[5,3], 6, 5`) was *vacuous* for proving the fix — the start node was already the last node, so old-bug and new-fix gave identical results. Replaced with `[5,3,4], 6, 10` → `endIndex 2, endOffset 4, clamped true` (old bug would have given `endIndex 1, endOffset 3`). Now distinguishes the fix.
2. Off-page tests covered `charOffset === total` but not `> total`. Added `resolveCharRange([5], 6, 2)` → null.
- Remaining (acceptable): no direct DOM test of `createWordRange`'s `Text[]` collection + `setStart/setEnd` — the CSS Highlight API is absent in jsdom, so the actual highlight render is a manual GUI check. The pure arithmetic (the risk) is fully tested.

No Codex re-run: test-only change addressing Codex's own notes; production logic unchanged. Verified here: `pnpm lint` 0 errors, `pnpm typecheck` exit 0, `pnpm exec vitest run …tts-range.test.ts` → 7/7 pass.

Full log: `/tmp/lectrice-025-codex.log`.
