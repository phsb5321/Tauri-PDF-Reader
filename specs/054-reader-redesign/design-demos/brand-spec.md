# Lectrice · Reader Direction Brand Spec

> Captured: 30/07/2026  
> Source of truth: `docs/brand/brand-spec.md` and the running macOS build  
> Asset completeness: complete for direction prototypes

## Core assets

### Logo

- App-tile mark: `../../../public/lectrice-mark.svg`
- Geometry: three nested 45°/90° chevrons, monoline, strictly angular
- Minimum size: 16px
- Do not round, stretch, shadow, redraw, or recolor outside the palette.

### Product UI

- Current macOS empty state: `../research/current-empty-state.png`
- Real fixture page: `assets/e2e-fixture-page-1.png`
- The page is the hero. It must remain visually dominant and must not be replaced by
  a generic document illustration.

## Palette

### Dark

- Crust: `#11111b`
- Mantle: `#181825`
- Base: `#1e1e2e`
- Surface: `#313244`
- Text: `#cdd6f4`
- Secondary text: `#a6adc8`
- App blue: `#89b4fa`
- Voice mauve: `#cba6f7`

### Light

- Base: `#eff1f5`
- Mantle: `#e6e9ef`
- Crust: `#dce0e8`
- Text: `#4c4f69`
- Secondary text: `#6c6f85`
- App blue: `#1e66f5`
- Voice mauve: `#8839ef`

Every direction may derive lighter/darker states with `color-mix()` or `oklch()`,
but may not invent an unrelated accent. Blue identifies navigation and app actions.
Mauve identifies speech, timing, and active listening.

## Typography

- Shipped display/wordmark: Space Grotesk 500/700
- Shipped body/UI: IBM Plex Sans 400/500/600
- Shipped data: IBM Plex Mono 400/500
- Prototype offline fallback: `Arial`/system sans and `ui-monospace` are acceptable
  only when the local font files are unavailable; production keeps self-hosted fonts.

## Geometry and motion

- Radii: 0–4px for chrome; 8px maximum for contained surfaces.
- One restrained ease-out transition language.
- The only signature motion is an active voice pulse in mauve.
- Thin rules, sharp alignment, and clear planes are preferred over card stacks.

## Product personality

- Local-first and quiet
- Voice-forward but not audio-player-first
- Developer-grade restraint
- Honest page, progress, and status surfaces

## Prohibited

- Gradient wallpaper, glassmorphism, neon glow
- Emoji icons
- Bounce easing
- Generic bento dashboard
- Fake statistics, fake library data, or fake AI capabilities
- Large decorative illustrations
- Raw colors not derived from this spec

