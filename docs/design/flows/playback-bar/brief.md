# Brief — Playback bar, the voice's cockpit (Hi-Fi Design Slice)

## Surface

- **Screen / route:** `src/components/playback-bar/AiPlaybackBar.tsx` (1123 lines) as the app footer
  (`src/components/reader/ReaderView.tsx:375-385`), plus its satellites: `AiSpeedSlider.tsx`,
  `AiVoiceSelector.tsx`, `AiTtsSettings.tsx`, `NarrationCockpit.tsx` (4 tabs: Voice & route / Delivery
  / Performance / Selection, `NarrationCockpit.tsx:9-14`), and `src/components/audio-progress/`
  (`AudioCacheProgress.tsx`, `CacheProgressBar.tsx`).
  **Mount condition is the design fact:** it renders only when `pdfDocument && (!libraryShowing ||
playbackState !== "idle")` (`ReaderView.tsx:354, 375`) — audio started in the reader **keeps playing
  while the library is up**, and the bar stays so a reader over the home is never left without a stop
  (`ReaderView.tsx:349-353` comment).
- **Window:** 1200×800 default / 640×600 minimum. A footer: at 640 the bar must not eat the page —
  name the max collapsed height and hold it.
- **Reader context:** mostly **listening, hands-off, at ~1 m** — the state (playing/paused, which
  voice, what speed) must be legible at a glance without a mouse move. Occasionally **steering by
  keyboard chord**: Ctrl+Space play/pause, Esc stop (`AiPlaybackBar.tsx:849-865`; the buttons'
  tooltips say so — `:945, :954`). The voice state is the brand's second principle: while speaking,
  the accent shifts blue→mauve and the spoken sentence carries `--color-tts-highlight`.
- **States to cover (from the code):**
  - **no API key** — the setup bar: `AI_TTS_SETUP_MESSAGE` + "Configure" → `NarrationCockpit`
    (`AiPlaybackBar.tsx:882-913`; message from `src/lib/constants.ts:57`)
  - idle with key — play affordance (`IconSing`, `:973`)
  - playing — `IconPause` (`:947`), speed slider, voice selector, cache progress
  - paused / switching provider / loading — honest intermediate states (`switchingProvider`,
    `isLoading` gate controls-disabled, `:926`)
  - bar-over-library — playing while the home shows (mount condition above).

## Source spec

- `specs/196-narration-cockpit/` — the cockpit's own story.
- `specs/258-voice-controls/` + `specs/261-narration-controls/` — the control states.
- `specs/039-pitch-preserving-speed/` — why the speed slider's semantics are delicate (visual must
  not imply a plain rate knob).
- `specs/170-local-tts/` — voice routing context (local vs API).
- `docs/brand/brand-spec.md` — "blue is the app, mauve is the voice".

## Required deliverables

1. `index.html` — hi-fi mock of the bar in all five states, over a real page raster AND over the
   library (the bar-over-home state), at 1200×800 and 640×600.
2. `variants/` — exactly two named directions, justified by real use:
   - **Direction A — "Glance strip":** one-line persistent bar; everything but play/pause + progress
     collapses behind a single cockpit toggle. Justification: the listening reader is 1 m away with
     hands off — the bar's job is _state at a glance_, not controls; the cockpit opens only when they
     lean in to change voice or delivery.
   - **Direction B — "Touchdown cockpit":** bar expands in place (voice + speed + cache row) on
     approach/focus, collapses to a slim strip otherwise. Justification: the power listener adjusts
     speed/voice between chapters without leaving the page; a second surface to open is a tax paid
     dozens of times per session.
3. `review.md` — 5-dimension critique against renders at both sizes, with an explicit
   **1-m glance test**: playing vs paused must be distinguishable without reading any label (the
   nightingale/pause glyph + the mauve pulse carry it — `IconSing`/`IconPause`,
   `AiPlaybackBar.tsx:33, :947, :973`).

## Constraints

- **Numbers:** bar collapsed height stated and ≤ what the current `.ai-playback-bar` occupies (measure
  it; don't guess); play/pause ≥ 32×32px (it is the most-used control in the app); slider thumb ≥ 24px
  hit width; speed values rendered in `--font-family-mono` (data is mono — brand principle 3); Esc and
  Ctrl+Space affordances written in the tooltips exactly as the code does (`:945, :954`); cache
  progress (`CacheProgressBar.tsx`) honest — real buffered fraction, no fake streaming shimmer.
- **Copy pair (this surface):**
  > ✅ "AI TTS requires an ElevenLabs API key" + a "Configure" button that opens the cockpit
  > (`constants.ts:57`, `AiPlaybackBar.tsx:882-913` — names the exact missing thing and the exact way
  > to fix it)
  > ❌ "Unlock the magic of voice ✨ Set up now!" — marketing tone, names nothing, emoji.
  > Honesty rule (measured 21/09, vault note): narration is **not offline** — no variant may imply
  > offline capability; the API-key dependency stays visible.
- **Brand rules:** **mauve is the voice** — the playing state, the pulse, and nothing else; play
  control is the branded nightingale (`IconSing` — the mark itself means "read to me", spec 275);
  pause is a general icon (`IconPause`) because pausing is chrome, not meaning. Speed/voice/cache are
  general icons. No gradients, no waveform theatrics beyond the real cache/progress truth, tokens
  only, ease-out only.

## Real content

- Speed slider range/steps as shipped (`AiSpeedSlider.tsx`); voice names from `AiVoiceSelector.tsx`
  (real provider voice IDs, e.g. Rachel/Adam-class names, mono); cache copy from
  `AudioCacheProgress.tsx`; the setup message verbatim from `constants.ts:57`.

## Output location

```text
docs/design/flows/playback-bar/
├── brief.md
├── index.html
├── variants/
│   ├── direction-a.html
│   └── direction-b.html
└── review.md
```

## Out of scope

- TTS engine behaviour, prebuffering (`useTtsPrebuffer`), provider routing logic.
- The settings panel (own brief) — though `AiTtsSettings` renders inside both, this brief owns it in
  cockpit context only.
- The library surface it floats over.
