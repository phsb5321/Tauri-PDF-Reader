# Spec 259 — speed control UX (readable, honest, keyboard-operable)

Branch `259-speed-control-ux` @ `35801daa`. Seat `lectrice-library-202`
(GLM Flash/max; READY = frozen only). Own files:
`src/components/playback-bar/AiSpeedSlider.{tsx,css}` +
`AiSpeedSlider.test.tsx`. Parent `AiPlaybackBar`/hooks/stores: READ-ONLY.

## User Scenarios & Testing

### US1 — Truthful value feedback (P1)
The slider announces the exact multiplier via `aria-valuetext`
("`<speed>× playback speed`") and shows it in the value span; lattice
values (1.25/1.5/…) keep their preset labels; off-lattice values stay
truthful up to two decimals (no rounding into a preset label).

### US2 — Honest disabled state (P1)
Parent lock (`disabled={isPlaying || isPaused || isLoading}`) is preserved.
When parent-disabled, the reason is visible AND announced:
"Speed is fixed while narration plays. Stop narration, then adjust speed."
When the provider is uninitialized: "Connect an AI provider…". The two
reasons never cross (no false uninitialized-while-playing claim). The
value span dims with the control. In-session speed is NOT claimed fixed
by cosmetics.

### US3 — Keyboard + affordance (P2)
Native range keyboard contract preserved (step 0.1 within
0.5–4.5 bounds; Arrow/Home/End native); `setSpeed` dispatches the stepped
value. Focus-visible ring (`--shadow-focus`), hover/pressed thumb
feedback, reduced-motion disables thumb animation, group wraps (no
clipping) at narrow widths, tabular-nums for a stable value width.

## Technical Context
Existing props/API only (`useAiTts` speed/setSpeed/initialized; parent
`disabled`); existing tokens (`--text-*`, `--accent-color`,
`--shadow-focus`, `--background-tertiary`); no new dependency, no popup
framework, no backend/parent edits. `setSpeed` catches/logs transport
failures and resolves — no backend success claim from the fulfilled
promise. Native-provider in-session speed remains unsupported (honest
disabled explanation), separate from any future backend clock work.
