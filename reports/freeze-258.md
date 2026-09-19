# Freeze — 258 voice controls (single hash source of truth), 15/09/2026 16:54 BRT · r1 post-p16 (readback-applied)

Baseline `35801daa8657a8c0b72c3b06a04c994b6a46bc8c`, branch `258-voice-controls`.
Authored, frozen, NOT executed locally (251 serialized slot owns execution).

Incorporates ALL p16 corrections, including the 16:50 readback findings:
- resolve-void contract (no Promise-success claim; store-truth rendering),
- unique dual-mount ids (useId) + scoped locators,
- strict value binding / explicit placeholder (no first-option fallback),
- ACTUAL-state precedence: connecting > store error > quiet/empty;
  uninitialized-but-connecting now visible; loading tied to a real
  `connecting` connection (never invented/perpetual),
- visible error text beside a populated selector (backs aria-invalid),
- test-fixture leaks fixed: empty case asserts with explicit all-connected
  state; store-error test pins allConnected (no spread-through of a
  connecting fixture). 10 checks, no provider calls.

The 16:50 readback correctly caught a broken intermediate state (precedence
edit not applied while the closing errorMessage block was): superseded — the
applied source now declares connecting/errorMessage before both uses.

| File | sha256 |
|---|---|
| `src/components/playback-bar/AiVoiceSelector.tsx` | `d8d80468c7ac4a1ff8fc4cdc427d2859c6c0290554f5b8d30c9719348f4e34d3` |
| `src/components/playback-bar/AiVoiceSelector.css` | `df90dba042dc65ae7129f1536fdde9ad6f8c83c3995f54be9799382b95e69fd4` |
| `src/components/playback-bar/AiVoiceSelector.test.tsx` | `cf2dbbb4439238e28a6ce9d5e457dcf0e61f810671946a09a04606924126b9d9` (10 checks) |

Superseded (do not review): tsx `6d82e494…` / test `61a1001b…` / earlier
`67b60814…` intermediate.

Slot command (one runnable check):
`pnpm test:run -- src/components/playback-bar/AiVoiceSelector.test.tsx`
(synthetic hook fixtures, no provider calls, <30s single file.)

Caps: 258 post-freeze repairs 0/2 (only on a FAILING 251 receipt); these were
pre-admission authorship corrections from p16 source review. 254 frozen files
untouched. Flash-authored → exact-head Codex Sol review required; no
self-acceptance.
