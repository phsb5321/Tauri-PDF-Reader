# 282 — Vector finishing

## Outcome

Ship the approved nightingale directions as reusable vectors, with readable optical cuts rather than scaled-down detail art.

## User Scenarios & Testing

### US1 — Reusable states and illustration

A designer can use the five approved poses and bird-on-books art on a shared grid without embedding a raster. Verify SVG shape, source hashes, ink/accent polarity, preserved trace transforms and render bounds; inspect actual 16/48px output. States target 24/48px and the illustration targets 48px or larger.

### US2 — Readable compact controls

A caller renders any branded icon at 16–23px without learning a new API; it automatically receives the simpler silhouette. At 24px and above the existing detail geometry remains. Component assertions exercise 16, 23, 24 and 48px; real rendered evidence proves the produced geometry, not a mock.

### US3 — Honest typography documentation

The brand spec distinguishes Fraunces wordmark artwork from the still-shipped Space Grotesk app display tokens. Verify the token file is unchanged and the pending migration is explicit.

## Acceptance

- Five individual states: idle, singing, paused, asleep, working; shared 24-unit square grid and common scale/baseline, usable at 24/48px. Ink silhouettes; only the moon/voice may be vermilion. Preserve the source poses.
- All six existing branded icons automatically use a simplified cut below 24px. Preserve IconProps, exports, default size, currentColor, decorative accessibility, and general icons. Callers do not choose cuts.
- Trace the approved bird-on-books illustration; no raster assets or traced lettering ship.
- Preserve every potrace translate/negative-scale group and foreground polarity. Inspect every trace rendered at 16px and 48px; retain reproducible renders and assertions.
- Brand wordmark is Fraunces 600 (opsz 144, WONK); current app display font remains Space Grotesk. Token migration is explicitly pending and outside this slice.

## Non-goals

No state-machine wiring, theme-token migration, typography implementation, new controls, or unrelated product edits. The orchestrator reviews the PR.
