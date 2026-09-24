# Vector finishing — 282

## Deliverables

- `public/brand/states/{idle,singing,paused,asleep,working}.svg`
- `public/brand/illustrations/empty-library.svg`
- `docs/brand/small-cuts/{play,library,bookmark,night,narrate,next}.svg`
- `src/ui/icons/lectrice-small-cuts.tsx`, selected by the existing branded exports in
  `src/ui/icons/lectrice-icons.tsx` whenever `size < 24`. `IconProps` is unchanged;
  default/24px-and-larger output is pinned to the original detail geometry.

State-machine wiring and app font migration are **not** part of this delivery.
Fraunces 600 / opsz 144 / WONK is the brand wordmark; the app display font remains
Space Grotesk in the unchanged `src/ui/tokens/typography.css`.

## Source and geometry

`vector-sources.json` records the two approved raster filenames, SHA-256 hashes,
panel crops, threshold and transforms. Sources remain in the project brand
archive under `brand-v2-2026-09-20/ai/`; no source raster is shipped in the app.

All state canvases are `viewBox="0 0 24 24"`. The five panels share source y=120,
`translate(1 0.8) scale(0.052)` and the same foot/perch baseline. Singing's voice
is shortened horizontally around its beak anchor so its bird is not shrunk to
fit a long line. Ink is `#14110D`; only voice/moon are `#C8462C`.

Dark-on-light artwork is thresholded directly: **no `-negate`**. The SVG body is
XML-validated and sliced from the root, not extracted with a non-greedy group
regex. Every original potrace `translate(0,H) scale(0.1,-0.1)` group survives.
The illustration uses the same two foreground masks and retains both books.

Compact UI birds reuse the existing favicon trace (no eye, feet or perch).
Library uses two separated book bars; narrate uses one heavier voice arc.
The small night bird was moved into the crescent's open area after the first
16px render showed it merging with the moon. Feather/flight use 192px renders
of the original detail geometry, black-foreground closing (ImageMagick `Open`
on grayscale), then retrace. Their original inputs are retained in
`source-icons/`. Flight keeps the original **left-facing** direction despite
its existing `IconForwardBird` / `next` names; changing that semantic mapping
is outside vector finishing and remains an integration follow-up.

## Render evidence — actually inspected at 16px and 48px

- [Native-size sheet](./vector-evidence/native-sizes.png): pixels displayed at
  their real dimensions, without enlargement.
- [Six asset traces](./vector-evidence/assets-inspection.png).
- [Six compact cuts, at both sizes](./vector-evidence/small-cuts-inspection.png).
- [Actual React output, small at 16 / detail at 48](./vector-evidence/icons-inspection.png).

Inspection sheets enlarge the **already-rasterized** 16/48px images with nearest
neighbour, not a fresh high-resolution rendering. `vector-evidence/` also holds
the individual transparent PNGs and actual React SVG exports.

Observed: birds remain upright and foreground-only; working wings, asleep moon,
paused left-facing head and singing mouth differ at 48px. At 16px, fine eyes,
feet and the hairline voice lose contrast. The state assets target **24/48px**;
the bird-on-books illustration targets **48px and larger**, not a 16px control.
At 16px its book stack reads only as a small base and the voice is faint. Use
`IconLibraryBird` for compact library controls instead. The small UI cuts
intentionally remove internal detail; the feather becomes a bold quill silhouette.

## Reproduce

Use the repo's pinned pnpm 10 dev shell, not host pnpm 11. ImageMagick, potrace
1.16 and librsvg must be on PATH for the offline art pipeline.

```bash
python3 tools/brand/trace-assets.py "$BRAND_SOURCE_DIR"
python3 tools/brand/build-small-cuts.py
pnpm exec prettier --write src/ui/icons/lectrice-small-cuts.tsx
BRAND_RENDER_DIR=docs/brand/vector-evidence/icons pnpm exec vitest run \
  src/ui/icons/lectrice-icons.test.tsx --maxWorkers=1 --minWorkers=1
python3 tools/brand/check-vectors.py
pnpm lint
pnpm typecheck
FC_SEED=20260921 pnpm test:fuzz
pnpm build
make harness-check
pnpm test:e2e:native
```

`check-vectors.py` asserts 36 render results: foreground coverage and bounds,
transparent corners, preserved transforms, square grid, and absence of raster
or executable SVG elements. It deliberately removes the trace transform and
adds an opaque background in two negative controls; both must be rejected.
These checks detect broken scale/polarity; visual inspection judges recognisability.

## Gate record

- Focused tests: **6 passed**; before implementation all six failed because
  small and detail geometry were identical. Boundaries: 16, 23, 24, 48px;
  currentColor, className, accessibility and pre-change detail hashes asserted.
- Vector oracle: **36 passed**, both negative controls rejected (`checks.json`).
- Lint: exit 0, **0 errors / 108 pre-existing warnings**; typecheck: exit 0.
- Fuzz: **8 tests / 4 files passed**, seed **20260921**, 100 runs per model.
  Replay: `FC_SEED=20260921 FC_NUM_RUNS=100 pnpm test:fuzz`.
- Frontend build: passed; unchanged bundle-size warning retained in log.
- Harness: complete branch-bound Spec Kit chain; passed.
- Packaged native gate: **1 spec passed**, `NATIVE_EXIT=0`; binary SHA-256 in
  `native-build-identity.txt`. It proves the existing 24px play control reaches
  backend marks/karaoke, not that unwired small cuts or new states are visible
  in the app. GStreamer appsink warning retained, not suppressed.
- Full verification: frontend suites, architecture, Rust format and Clippy
  passed; the warmed retry timed out at the Rust test stage after 1800 seconds.
  **Not a full pass**; backend/contract completion remains unverified.
- Independent GLM review: **blocked before spawn by a full queue**, no approval.
  [Exact release status](./vector-evidence/review-status.md); PR #234 stays draft.
