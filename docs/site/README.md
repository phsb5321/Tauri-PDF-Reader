# Lectrice landing page

A standalone brand page: `index.html`, one stylesheet, two SVGs, two self-hosted variable fonts and two original running-app screenshots. No build, JavaScript, analytics, CDN, app bundle changes or hosting configuration.

## Open

Open `index.html` directly, or from the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory docs/site
# http://127.0.0.1:8080
```

Deploy only `index.html`, `style.css` and `assets/` together. No deployment was performed. `docs/site/` keeps marketing beside the brand documentation, away from the root Vite entry point and Tauri product code; it can be copied to any static host without changing the application build.

## Sources and fidelity

- Copy and install commands: repository `README.md`; macOS details link to `docs/macos-nix.md`.
- Approved identity: vermilion nightingale on paper; README banner's optical alignment. The wordmark is live **Fraunces 600**, `opsz=144`, `SOFT=0`, `WONK=1`; body is **Newsreader**. All website chrome colours are paper `#F4EFE4`, ink `#14110D`, vermilion `#C8462C`. Product screenshots retain the real application's colours; they are not tinted, composited, re-encoded or downscaled as files. Responsive CSS changes display size only; each links to its full-size original.
- `assets/nightingale.svg`: exact path/group geometry from `docs/brand/lectrice-mark.svg`, uniformly filled vermilion. The source actually has a black fill despite its `currentColor` comment; only this standalone copy changes colour.
- `assets/favicon.svg`: byte-identical to `public/lectrice-mark-small.svg`, the optical cut for 16–24 px.
- `assets/reader.png`: approved **Dark** `reader-hero-alice-dark-1440x900.png`, raw attempt-7 restored by the capture owner after rejecting a blank-canvas attempt-8. `assets/reader-light.png`: approved **Light** `reader-hero-alice-light-1440x900.png`. Both from `lectrice-shots`, copied byte-for-byte (`cmp` passed). Real Alice in Wonderland PDF, page 4/111, saved Yellow highlight, playback stopped, no toast. The document page stays white in both themes. These are main-branch captures, not a claim about exact tagged-release pixels. Frozen source/build/approval facts and both SHA-256 values live in [`product-shots.json`](product-shots.json).
- Fonts: exact provided `brand-v2-2026-09-20/fonts/Fraunces[SOFT,WONK,opsz,wght].ttf` and `Newsreader[opsz,wght].ttf`, converted with FontTools to WOFF2, no subsetting or axis removal. Upstream OFL notices copied from `google/fonts/ofl/{fraunces,newsreader}/OFL.txt` accompany them. Font copyrights remain embedded.

Source TTF SHA-256:

```text
Fraunces  177ff6c0f14e5550a3c624247cd1189611d4eb65d000b14944c63d967958abbb
Newsreader 8a08d13f8a6c0d51be379a60af84f945f65369a67e509ee3c3bdcc421254d7c1
```

Reconvert, with `BRAND_DIR` pointing to that original asset directory:

```sh
uv run --with 'fonttools[woff]' python - <<'PY'
import os
from pathlib import Path
from fontTools.ttLib import TTFont
for family in ('Fraunces', 'Newsreader'):
    font = TTFont(next((Path(os.environ['BRAND_DIR']) / 'fonts').glob(family + '*.ttf')))
    font.flavor = 'woff2'
    font.save(Path('docs/site/assets') / (family.lower() + '.woff2'))
PY
```

## Honesty and intentional omissions

PDF reading/viewing/highlighting work offline. Current narration is explicitly a cloud round-trip to ElevenLabs, requiring an API key; offline voice is a roadmap item, **not shipped**. No Lectrice account is required; this is not a claim that the voice provider needs no account. The operator confirmed this distinction on 21/09/2026.

The initial typographic illustration was removed following the operator's request for prints of the real program. The orchestrator's explicit decision on 21/09/2026 is **Dark as the dominant full-width hero, Light as the supporting second figure**: Dark is the default appearance and a stronger contrast against paper; Light demonstrates a real in-app theme change. Both are plainly framed with factual captions and full-size links. Speaking-state captures (unreleased local Magpie), obsolete fixture heroes, the clipped dark 960 capture and rejected incomplete-repaint/blank-canvas attempts stay out. Library captures remain with the capture owner for later selection. No interface imagery is generated here. The app/site theme mismatch is an acknowledged product/brand gap, not concealed by editing screenshots. The raster seal/five-state bird sheet are omitted because they are direction studies, not finished vector assets, and add no necessary information here. No fake Linux installation commands, public notarized Mac installer, Windows package, or version pin is advertised. GitHub destinations remain the real README destinations.

The legacy app palette/Space Grotesk sections of `docs/brand/brand-spec.md` still describe the application, not this new website. Their reconciliation belongs to the app rebrand slice; product source is untouched here.

## Reproduce verification

Requires Python Playwright and a local Chrome/Chromium; this is a **test dependency**, not a website build/runtime dependency:

```sh
python3 docs/site/verify.py --out docs/brand/website-evidence
# Optional: --chrome /path/to/chrome
```

On the verified desktop, Playwright's installed interpreter is
`~/.local/share/uv/tools/playwright/bin/python`.

The test starts an isolated loopback HTTP server, closes it on exit, and fails on asset/network/console errors, off-palette colours, changed mark geometry, font fallback, install-command drift, broken anchors, overflow at 1440/768/390/320 px and 200% text, failed keyboard navigation, extra/repeating animation, or reduced-motion activity. It also opens the file:// delivery path. Evidence includes content hashes, browser version, actual CDP-reported custom fonts, motion offsets and screenshots. A failed rerun removes any previous PASS receipt.

### Visual evidence — 21/09/2026

Evidence: [`../brand/website-evidence/`](../brand/website-evidence/).

- `desktop.png`, `tablet.png`, `mobile.png`, `narrow.png`: complete responsive layouts.
- `assets.png`: real Fraunces/Newsreader, detail mark, optical-small favicon at native sizes, and both approved product captures.
- `product-hero.png`, `product-light.png`: the Dark hero and Light supporting figure in plain website frames, with factual captions and full-size links.
- `voice-{start,middle,end}.png`: the one 3.6-second CSS speaking-line reveal.
- `reduced-motion.png`: no animation, complete static line.
- `text-200.png`, `keyboard-focus.png`, `install-expanded.png`: reflow, visible focus and keyboard-operated installation disclosure.
- `verification.json`: executable assertions and exact asset hashes (commit records the checked-out HEAD; hashes identify any pre-commit files).

`product-shots.json` freezes per-asset provenance, including Dark's approved raw attempt-7 restoration, rather than treating all capture attempts as equivalent. The verifier requires exactly the approved Dark/Light pair, checks both original SHA-256 values and 1440×900 dimensions, rejects speaking-state metadata, checks full-size links and ensures no CSS filter is applied. The failed replay is an acknowledged capture flake, not a successful capture claim or a reason to edit pixels.

These PNGs are opened by the vision-capable author, not passed to the text-only review lane. Initial visual inspection caught the voice-line anchor depending on text height at enlarged text; it now tracks the bird's width. Browser testing also corrected an overly strict anchor test: near the document end the browser cannot align a section to viewport top, so the test asserts that its heading is visible instead.

App fuzz/native journeys are **not applicable** to this docs-only surface, not skipped-green; no packaged-app behavior or release-readiness claim is made. Repository harness, hooks and required CI gates remain unchanged. Site work is reversible as one squash-commit revert PR.
