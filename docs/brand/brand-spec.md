# Lectrice · Brand Spec

> Captured: 2026-05-29 · Status: **shipped** (applied to tokens, fonts, icons, config)
> Visual board: [`lectrice-brand.html`](./lectrice-brand.html) (open in a browser)

---

## 0. Name

**Lectrice** /lɛk.tʁis/ — French for _a person (historically a woman) employed to read
aloud to someone_. The app **is** your lectrice: it reads your documents aloud.

### Why this name (it was earned, not guessed)

The differentiator is that it **reads aloud** (native TTS), so the name leads with the
reader-voice. Candidates were collision-checked against the TTS / ebook / PDF-reader
space — most obvious names were already taken by _directly comparable_ products:

| Rejected    | Why                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VoxPage** | Pedro's **own** existing Firefox extension (`phsb5321/VoxPage`, web-page TTS) — same space, self-collision. (It was the leftover `com.voxpage` identifier; now replaced.) |
| **Lectern** | Taken by `Acumane/lectern`: _"Listen to PDFs with natural TTS and read-along text"_ — almost the identical product.                                                       |
| **Lector**  | Taken (Qt ebook reader) + generic Spanish "reader".                                                                                                                       |
| **Murmur**  | Saturated — 7+ TTS / PDF-to-audiobook products.                                                                                                                           |
| **Cadence** | Category-clean but buried under Cadence Design Systems + Uber Cadence.                                                                                                    |

**Lectrice** returned zero same-space collisions, is distinctive, pronounceable, and its
meaning is a bullseye. Shares the _lect-_ ("read") root with the taken names but is the
unclaimed, more-elegant form.

- **Tagline:** Every page, read aloud.
- **Explainer:** The reader that reads to you.
- **Positioning:** A local-first desktop PDF reader that reads documents aloud — highlight
  a passage, press play, and let it turn the page for you.

---

## 🎯 Core assets

### Logo — **Mark A · Voice Channels** (chosen)

Three nested chevrons — a voice radiating / soundwave, abstract not a letter (Zed's mark
isn't a literal "Z" either). **Monoline, strictly angular** (45°/90°), no curves.

- Reusable source: [`lectrice-mark.svg`](./lectrice-mark.svg) (uses `currentColor`)
- App icon / favicon (crust tile + blue mark): [`../../public/lectrice-mark.svg`](../../public/lectrice-mark.svg)
- Two alternates explored on the board: **B · Spoken Page** (document → waveform) and
  **C · Aperture Tile** (negative-space V on an accent tile, used for the OS icon shape).

**Mark rules:** clearspace ≥ one chevron stroke · min 16px (use the tile below that) ·
mark in `--accent` (blue) or `--text`, never recolored off-palette · never rounded,
stretched, or shadowed.

### Wordmark

**Lectrice** in **Space Grotesk 700**, tracking −0.02em. Monochrome (`--text`); the mark
carries the colour (Zed-style). Mark sits left of the wordmark, clearspace = mark height.

---

## 🎨 Palette — Catppuccin Mocha (dark) / Latte (light)

Zed's _discipline_ (dark-first, one accent, restraint) in the house palette. Applied to
`src/ui/tokens/colors.css` — token names unchanged, values swapped.

**Surfaces (dark):** crust `#11111b` · mantle `#181825` · base `#1e1e2e` · surface0 `#313244`
**Text (dark):** text `#cdd6f4` · subtext0 `#a6adc8`

| Role                         | Dark            | Light           | Token             |
| ---------------------------- | --------------- | --------------- | ----------------- |
| **Primary accent — the app** | blue `#89b4fa`  | blue `#1e66f5`  | `--color-accent`  |
| **Voice — active TTS**       | mauve `#cba6f7` | mauve `#8839ef` | `--color-speak`   |
| Error                        | red `#f38ba8`   | `#d20f39`       | `--color-error`   |
| Warning                      | peach `#fab387` | `#fe640b`       | `--color-warning` |
| Success                      | green `#a6e3a1` | `#40a02b`       | `--color-success` |

**The one idea:** _blue is the app, mauve is the voice._ While speaking, the accent shifts
blue → mauve; the spoken-sentence highlight is `--color-speak` @ 16% (`--color-tts-highlight`).
Hover/alpha are derived with `color-mix()` so no off-palette hex is ever invented.

---

## ✍️ Typography — self-hosted (`@fontsource`, local-first, no CDN)

| Role               | Family                                                   | Token                   |
| ------------------ | -------------------------------------------------------- | ----------------------- |
| Display / wordmark | **Space Grotesk** (500/700)                              | `--font-family-display` |
| Body / UI          | **IBM Plex Sans** (400/500/600) — Zed's actual body face | `--font-family`         |
| Mono / data        | **IBM Plex Mono** (400/500)                              | `--font-family-mono`    |

Imported in `src/ui/tokens/index.css`. Replaced the `-apple-system` / `SF Mono` stacks
(incl. a hardcoded `body` font in `src/styles/App.css`).

---

## 📐 Geometry & motion

- **Radii lean tight:** 0 (logo/tile) · 4px chrome · 8px cards (cap). 12/16 retired from brand surfaces.
- **Motion ease-out only.** `--easing-bounce` aliased to `--easing-default` in `motion.css`
  (retired — it was on the anti-slop banlist). Only signature motion: the mauve speaking-pulse.

---

## 🧭 Principles

1. **Local-first, quiet** — no accounts/cloud/telemetry; the document is the hero.
2. **The voice is the feature** — blue is the app, mauve is the voice; speaking state always visible.
3. **Developer-grade restraint** — mono for data, one accent, sharp geometry.
4. **Honest surfaces** — real page, real waveform, real progress; no skeuomorphic book.

## ⛔ Don't

No gradients/glassmorphism/neon glow · no emoji icons · no bounce easing · no `100vh` hero ·
no raw hex in components (tokens only).

---

## Shipped (this PR)

- [x] Name **Lectrice** (collision-vetted) → `productName`, window title, `index.html`, README, `package.json`
- [x] Identifier `com.voxpage.pdf-reader` → `com.lectrice.reader`
- [x] Logo Mark A + app icons regenerated via `tauri icon` (desktop/Win/iOS/Android)
- [x] `colors.css` → Catppuccin (Latte/Mocha) + `--color-speak`
- [x] `typography.css` + `@fontsource` self-hosted fonts
- [x] `motion.css` bounce retired · `App.css` body font tokenized
