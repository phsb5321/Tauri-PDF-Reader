# DELIVERY — 258 voice controls (p19 / ex-lectrice-cache-glm), 15/09/2026

Baseline `35801daa`, branch `258-voice-controls`, sole write root
`/home/notroot/Documents/Code/personal/tauri-pdf-reader-258-voice-controls`.
254 worktree + frozen cache files untouched (byte-identical for 252 review).

## Authored (NOT executed locally; no install, no run)

| File | sha256 |
|---|---|
| `src/components/playback-bar/AiVoiceSelector.tsx` | see freeze note below |
| `src/components/playback-bar/AiVoiceSelector.css` | see freeze note below |
| `src/components/playback-bar/AiVoiceSelector.test.tsx` | see freeze note below |

Hashes are recorded in the single READY message to 251 and in
`reports/freeze-258.md` (single source of truth for this increment).

## What changed (functional, not cosmetic)

- Provider/voice grouping via native `<optgroup>` (ElevenLabs/Local/Groq) —
  reuses `AiVoiceInfo.provider`; no new data, no new primitives.
- Truthful states: explicit placeholder instead of first-option fallback;
  error note from `initError`/`error` when uninitialized; "Loading voices…" /
  "No voices available" when empty; pending-only `aria-busy`.
- p16 contract honored: `setVoice` resolves void → outcome rendered from
  store state only; failure keeps prior selection visible; no success
  announcement; store errors never cleared by fulfillment.
- Dual-mount fix: unique per-instance id via `useId` (bar + cockpit); scoped
  locators in tests; p14 coordination noted.
- Styling: existing tokens only, focus-visible keyboard parity,
  hover/active/disabled/pending feedback, `prefers-reduced-motion`, narrow-
  width shrink. No token/theme globals touched, no disabled-lie cosmetics.

## Honest limits

- Not typechecked/linted/run here (251 owns execution) — first evidence from
  the serialized slot; repairs only on failing receipt (max 2 measured).
- Flash-authored: needs exact-head Codex Sol review; not accepted by my prose.
- No backend/clock work claimed; no invented acoustic/perf acceptance.

## Remaining caps

- 258 increment: 0 repairs used (2 granted only on failing receipt).
- 254: frozen, budget exhausted earlier stays exhausted.
