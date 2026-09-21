# Plan — brand website

## Technical Context

One plain HTML page and CSS file under `docs/site/`, separate from Vite's root and the Tauri bundle. Relative asset paths make this directory independently copyable to any static host. No hosting configuration or product code changes.

## Design and sources

Use the approved README banner as the optical lockup reference, keeping a real HTML Fraunces wordmark and separate traced SVG. Convert the provided variable TTFs losslessly to WOFF2 with FontTools (no subsetting); retain OFL notices. Copy the small-cut favicon. Draw only the simple voice-line curve, not a replacement bird. Use Newsreader body and three colour tokens. Editorial rules/space, no cards, shadows or invented product screenshots.

README is the capability and command source. Offline viewing/highlighting/local persistence are separate from ElevenLabs narration (API key + text egress). The operator confirmed this split and font conversion on 21/09/2026. Omit raster seal/states and new product imagery; the read-along is explicitly a typographic illustration, not an app screenshot or working player.

## Verification

Browser-driven assertions plus screenshots: fonts loaded/actually used, all local assets decoded, no third-party requests, desktop/tablet/mobile/200%-text reflow, keyboard/anchor navigation, finite motion and reduced motion, source geometry, palette, README commands, and optical-size/typography proof sheet. Open all generated screenshots with vision. Save evidence in the project's vault brand folder, not scratch.

## Review / constitution

OpenAI generator; full GLM-5.3 text review checks requirement trace, correctness/accessibility, and privacy/security. Initial plan-review launch refused before spawn (queue saturated); no approval asserted. Final exact-head review still required. Run harness and targeted site checks; app journey is not applicable because app behavior is unchanged, not skipped-green. Existing CI gates remain unchanged. Safe-class squash merge only on required green checks and resolved review.
