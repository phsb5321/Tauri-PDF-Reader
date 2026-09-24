# Huashu Design — Lectrice Bootstrap Notes

Vendored from the global install `~/.claude/skills/huashu-design/` (upstream:
`alchaincyf/huashu-design` on GitHub, MIT, © Alchain Hust) so the design practice is **versioned with
the product** — every seat working this repo uses the same copy, matching DeliCasa's precedent
(`work/DeliCasa/DeliCasa-661-pnpm/.claude/skills/huashu-design/`). See `VENDORED-LICENSE-MIT.txt`
for upstream attribution.

## What is here

- `SKILL.md` — primary skill manifest (Chinese; agents execute it bilingually).
- `README.md` / `README.zh.md` — human overview.
- `references/` — 21 reference docs. The two Lectrice reaches for most:
  `critique-guide.md` (the 5-dimension rubric behind every `review.md`) and
  `content-guidelines.md` (anti-slop + copy rules).
- `scripts/` — export pipelines (`render-video.js`, `html2pptx.js`, `verify.py`, …).
- `assets/` — starter JSX frames (iOS / Android / macOS / browser, deck stage, design canvas,
  animations runtime) + SFX library. No Lectrice surface uses the phone frames — the app is desktop;
  the macOS/browser frames and `design_canvas.jsx` are the relevant ones.
- `demos/` — upstream reference HTML demos (patterns to clone, not to ship).
- `test-prompts.json` — upstream regression prompts.

## What is intentionally omitted (fetch on demand)

To keep the repo lean (1.9 MB instead of ~32 MB) we did **not** vendor:

- `assets/bgm-*.mp3` — 6 background-music tracks, ~30 MB
- `assets/showcases/**` — case-study PNG/HTML bundles, ~3.3 MB

If a task needs them (e.g. a narrated launch film), bootstrap on demand and keep them local-only:

```bash
TMPDIR_SKILL="${TMPDIR:-/tmp}/huashu-upstream-$$"
gh repo clone alchaincyf/huashu-design "$TMPDIR_SKILL" -- --depth 1
rsync -a "$TMPDIR_SKILL/assets/bgm-"*.mp3 assets/
rsync -a "$TMPDIR_SKILL/assets/showcases/" assets/showcases/
# Do NOT commit BGM mp3s or showcases back — they stay local-only.
```

## How Lectrice invokes it

1. The slice starts from a **per-flow brief** — `docs/design/flows/<flow>/brief.md` (see
   `docs/design/BRIEF-TEMPLATE.md`). Never from a blank page.
2. Brand input is `docs/brand/brand-spec.md` — vermilion-on-paper nightingale mark, Catppuccin
   Latte/Mocha tokens, Space Grotesk / IBM Plex, the bird-goes-where-the-meaning-is icon rule. Point
   the skill at it; do **not** let it infer a palette from memory (its Core Asset Protocol exists
   precisely to stop that).
3. The desktop adaptation: "Surface" means the component tree + window size (1200×800 default /
   640×600 min, `src-tauri/tauri.conf.json`) + input modality, not a phone URL.
4. **`review.md` is mandatory** (`docs/design/README.md`): the 5-dimension critique, written against
   the render at the real sizes. Text-only seats write briefs and hand the critique to a
   vision-capable seat.
5. Upstream's TTS pipeline (`scripts/tts-doubao.mjs`) needs a Volcengine key Lectrice does not use —
   leave it unconfigured; never commit secrets (`.gitignore` here already excludes `.env*`).
