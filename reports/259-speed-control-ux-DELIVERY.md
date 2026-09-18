# reports/DELIVERY.md — 259 speed control UX (lectrice-library-202, w1:pT)

## Receipt (actual tool times)
First tool 16:31:55 BRT · `zai/glm-5.3-flash/max` ✓ · ROOT
`/home/notroot/Documents/Code/personal/tauri-pdf-reader-259-speed-control-ux`
@ `35801daa` (clean, locked). Last source edit 16:45 BRT (this report
16:46). Wall interval only — no invented active-minute figure.

## Changed files (exact)
1. `src/components/playback-bar/AiSpeedSlider.tsx` — exact multiplier
   `aria-valuetext` + off-lattice-truthful value format; honest
   disabled-reason derivation (parent playback lock vs uninitialized,
   never crossed) announced via `aria-describedby` + visible hint;
   dimmed disabled value.
2. `src/components/playback-bar/AiSpeedSlider.css` — focus-visible ring
   (`--shadow-focus`), hover/pressed thumb feedback, reduced-motion guard,
   narrow-width wrap guard, tabular-nums value, dimmed/hint styles.
3. `src/components/playback-bar/AiSpeedSlider.test.tsx` — NEW, authored
   UNRUN (6 cases).
4. `specs/259-speed-control-ux/{spec,plan,tasks}.md`.

## Test path + command (251 slot)
`pnpm vitest run src/components/playback-bar/AiSpeedSlider.test.tsx` +
`pnpm typecheck` + `make harness-status`.

## Preserved invariants / honest limits
Parent disabled semantics untouched (`isPlaying || isPaused || isLoading`);
unsupported transitions stay disabled WITH an explanation; `setSpeed`
catch/logs/resolves — no backend-success claim; no in-session speed,
acoustic, or live-speed claim; unit seam only (labeled); no new
dependency/UI framework; parent and hooks untouched.

## Remaining gates
251 serialized slot execution; typecheck/harness; Codex Sol exact-head
review per COMMON; in-session speed backend prerequisite (open scope).

## Correction 1 (p16 static findings) — 16:47–16:52 BRT, source-only
1. **Quarter-lattice fix**: STEP 0.1 → **0.05** — every labeled preset
   (incl. 1.25/1.75) is exactly reachable; stored quarter values stay
   byte-exact in `range.value` (no step sanitization drift). Tests assert
   ACTUAL `input.value` for stored 1.25/1.75.
2. **Own keyboard handler** (deterministic, jsdom-testable): Arrow steps
   ±0.05 clamped to bounds, Home/End — a stored 1.2 + ArrowRight lands
   exactly on the labeled 1.25 (`setSpeed` asserted). Plain Resume
   semantics untouched.
3. **Reason precedence**: uninitialized wins over the parent playback
   lock (no false "narration plays" during setup); both cases tested.
4. `setSpeed` fulfilled ≠ backend success: already incorporated (handler
   awaits the hook contract; no success claim).
Test count: 8. Frozen pending 251 slot replay.

## p16 readback correction — 16:51–16:53 BRT (source-only)
1. Duplicate `const valueText` (compile blocker at :62/:100) — removed;
   single declaration.
2. Lock reason made NEUTRAL: "Speed can't change while a clip is active or
   loading. Stop narration, then adjust speed." — truthful for playing,
   paused, and loading locks alike (no false "narration plays" during
   setup/paused/provider-switch); uninitialized precedence retained and
   tested.
3. Keyboard test labeled source-level dispatch (the component's own
   handler); native range keyproof remains a separate gate.
Queued with READY via herdr-prompt (delivered + consumed). No execution.
