# Plan 259
## Technical Context
React 18 + native `<input type="range">`; existing CSS tokens; jest-dom
assertions (global setup). Facade: `useAiTts` mocked at the hook seam
(unit seam — NOT a transport/live-speed proof).

## Changes
1. `AiSpeedSlider.tsx`: exact `aria-valuetext`; off-lattice-truthful
   `formatSpeed`; disabled-reason derivation (parent-lock vs
   uninitialized, never crossed); `aria-describedby` + visible hint; dimmed
   disabled value.
2. `AiSpeedSlider.css`: focus-visible ring; pressed thumb; reduced-motion
   guard; wrap/min-width; tabular-nums; hint style; dimmed value.

## Verification (authored, UNRUN — 251 slot)
`pnpm vitest run src/components/playback-bar/AiSpeedSlider.test.tsx` +
`pnpm typecheck` + `make harness-status`. Original suites untouched.
