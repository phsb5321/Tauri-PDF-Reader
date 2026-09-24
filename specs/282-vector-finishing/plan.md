# Plan

Generator family: OpenAI. Exact-head independent review: full GLM-5.3, public fleet-code packet only; no vault prose or private context. The installed speckit-make runtime still pins unavailable Anthropic/older model names, so use its plan → implementation → executable verification → different-family review stages without that stale launcher.

## Technical Context

React 18.3 / TypeScript 5.6 / Vite; existing IconProps and iconPairs are the public interface. Offline production uses ImageMagick, potrace 1.16 and librsvg; Python uses only its standard library. No new app dependencies. Public asset SVGs use viewBox 0 0 24 24; checked-in small cuts and generated JSX share one build script.

## Implementation sequence

1. Crop the approved source panels, isolate dark foreground via grayscale threshold, separate red accents, trace with potrace, retain the balanced SVG body (including nested transforms). Normalize onto a common 24-unit state grid. Retain source hashes and crop recipes in a manifest.
2. Reuse the shipped favicon silhouette for bird icon cuts. Simplify existing feather/flight traces through raster morphology and retracing rather than inventing new illustrations. Keep detail branches unchanged. Store small-cut geometry in one JSX module behind existing exports.
3. Add focused tests for the size boundary, inherited colour, geometry, and unchanged decorative accessibility. Render the actual React icon output plus asset SVGs with librsvg at 16/48px; retain native-size and nearest-neighbour inspection sheets. Assert foreground bounds, transparent corners and trace groups.
4. Run lint, typecheck, targeted tests, fuzz, build, harness and applicable packaged user gate. Record specific unavailable gates as BLOCKED, never green. Publish PR and evidence to orchestrator.

## Constitution check

UI-only geometry; no IPC, domain, adapters, state transitions, dependencies, tokens or coverage policy changed. Standalone brand assets use the approved palette; React icons inherit currentColor. Visual judgement supplements deterministic checks, not replaces them.
