# Lectrice · Brand Spec

> Identity updated: 21/09/2026 · Vermilion nightingale on paper, Fraunces wordmark.
> [Current assets and GitHub application steps](./README.md).
> Product tokens/fonts below still describe the separately shipped UI.
> Historical board: [`lectrice-brand.html`](./lectrice-brand.html) (pre-v2, not current identity guidance).

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

### Logo — **the nightingale** (chosen)

A songbird in side profile, head raised, beak open mid-song, gripping a line. The product
_speaks_, so the mark is the thing that sings — **figurative**, not another abstract sound
glyph. Figurativeness is what carries logo recall (de Lencastre et al., 2023), and it is the
one register nobody in this category occupies.

Drawn with GPT through the browser fleet (identity `chatgpt-c`, ChatGPT Pro) and traced to a
single-colour vector path. **Design record:**
`1. Projects/Lectrice — Tauri PDF Reader/Brand v2 — research & three directions (2026-09-20).md`.

- Reusable source: [`lectrice-mark.svg`](./lectrice-mark.svg) (one path, neutral black source; explicitly paint it vermilion in compositions)
- App icon / favicon (paper tile + vermilion bird): [`../../public/lectrice-mark.svg`](../../public/lectrice-mark.svg)

**Mark rules:** clearspace ≥ the bird's tail width · min 16px (use the favicon cut below that) ·
**the mark is vermilion `#C8462C` on paper `#F4EFE4`** — the bird and the line it sings into are one
continuous gesture, and the accent stops being decoration and becomes the identity · ink `#14110D` is
reserved for **type** (wordmark, tagline, body) · a paper bird on an ink tile remains valid where a
dark surface is required (store tiles, dark docs), but it is the exception, not the default · never
recolored off-palette, never rounded, stretched, recoloured per-part, or shadowed.
**The mark is a trace — edit the path, never re-draw it freehand.**

#### Two cuts — optical sizing for the mark

The mark ships in two optical sizes, the same way a variable family ships several cuts. They were
compared as rasters at 16/24/32/48px, not chosen by eye at poster size:

| Cut         | File                                                                                                                                    | Use at     | Why                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| **detail**  | [`lectrice-mark.svg`](./lectrice-mark.svg) · [`../../public/lectrice-mark.svg`](../../public/lectrice-mark.svg)                         | **≥ 32px** | the perch, legs and finer tail read again at these sizes; the fuller drawing                         |
| **favicon** | [`lectrice-mark-small.svg`](./lectrice-mark-small.svg) · [`../../public/lectrice-mark-small.svg`](../../public/lectrice-mark-small.svg) | **≤ 24px** | perch, legs and eye removed and the open beak exaggerated, so the silhouette survives the pixel grid |

#### Icons — general and branded

The icon set ships as pairs (`src/ui/icons/lectrice-icons.tsx`), and the rule is what keeps it a system
rather than a mascot parade:

| Layer                      | Use for                                     | Example                                                         |
| -------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| **general**                | chrome — pure utility with no brand meaning | pause, gear, search, close, zoom                                |
| **branded** (bird-carried) | meaning — voice, reading, rest, direction   | play/read-aloud, library, bookmark, night mode, narration, next |

**The bird goes where the meaning is.** Birding a gear would cost legibility and buy nothing. Branded
icons reuse the logo's own traced geometry, so they stay on-brand by construction rather than by
convention. Both layers share the 24px box; the branded ones are the first candidates for a simplified
small-size variant below 24px (same two-cut logic as the mark).

The open singing beak is the **invariant** across both cuts — it is what identifies the mark at any size.
Below 32px the detail cut loses the beak to anti-aliasing; above 24px the favicon cut reads as coarse.
Use the favicon cut for `favicon.ico`-scale UI and the detail cut for everything larger.

### Wordmark

**Lectrice** in **Fraunces 600**, optical size **144**, **WONK on**, SOFT 0,
tracking −0.035em. Ink `#14110D` on paper `#F4EFE4`; the bird carries vermilion
`#C8462C`. Use the real local font, never image-model lettering. Align the wordmark
optically with the bird's body, not its full bounding box; the singing head rises
above the cap line. The [GitHub composition](../../.github/assets/lectrice-social-preview.html)
is a reproducible example. Space Grotesk below remains a product UI implementation
detail, not the identity wordmark.

---

## 🎨 Shipped product UI palette — Catppuccin Mocha / Latte

This section describes existing app tokens, **not marketing/identity artwork**.
Identity surfaces use paper `#F4EFE4`, ink `#14110D` type and vermilion `#C8462C`
bird/voice. Migrating product tokens is a separate slice.

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

## ✍️ Shipped product UI typography — self-hosted (`@fontsource`)

For identity artwork use Fraunces/Newsreader from [the asset index](./README.md).
The following table records the existing product implementation; it does not
supersede the wordmark specification above.

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
- [x] Logo **the nightingale** + app icons regenerated via `tauri icon` (desktop/Win/iOS/Android)
- [x] `colors.css` → Catppuccin (Latte/Mocha) + `--color-speak`
- [x] `typography.css` + `@fontsource` self-hosted fonts
- [x] `motion.css` bounce retired · `App.css` body font tokenized
