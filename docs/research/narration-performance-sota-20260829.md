# Narration performance, motion, and enunciation — SOTA review

Date: 29/08/2026 · Host: desktop (AMD Radeon RX 5700 XT, RADV/Vulkan)
Scope: the four defects raised for the reader — cold start when a book is
opened, no audio surplus, jumpy zoom, weak read-along highlight, and speech
enunciation that still sounds disconnected.

Every claim below is either quoted from a primary source or measured on this
host. Measurements are reproducible with the commands shown.

---

## 1. Enunciation and throughput share one root cause

### What we do today

`tools/magpie/lectrice_magpie_bridge.py` splits every request at
`PREFERRED_CHUNK_UTF8_BYTES = 300`, then for each chunk spawns a **fresh
`magpie-cli say` process** (`_run_chunk`), waits for a WAV, and concatenates
the WAVs (`concatenate_pcm16_wavs`). Each chunk therefore:

- reloads the GGUF and re-uploads 527.5 MiB of weights to the GPU;
- starts generation from a cold state with **no memory of the previous
  chunk** — the same `--seed 42` every time;
- ends with a hard cut that concatenation splices to the next cold start.

The pinned CLI confirms there is no alternative surface:

```
$ magpie-cli --help
subcommands:
  info  --model <gguf>
  say   --model <gguf> --text <text> [--lang] [--speaker] [--seed] [--output] [--threads]
  bench --model <gguf> ...
```

No server mode, no session, no context/history flag, no sampling flags.

### What the model is designed to do

NVIDIA's own documentation for this model family describes a **longform
inference** path built exactly for this problem
(<https://docs.nvidia.com/nemo-framework/user-guide/latest/speech_ai/magpietts-longform.html>):

> Magpie-TTS supports generating speech for long text inputs by processing
> them in smaller, sentence-level chunks while maintaining prosodic
> continuity across the entire utterance.

The mechanism is a `LongformChunkState` carried between chunks:

```python
@dataclass
class LongformChunkState:
    history_text: Optional[torch.Tensor] = None            # (B, T)
    history_context_tensor: Optional[torch.Tensor] = None  # (B, T, E)
```

> **Context Preparation**: Prepend history text and encoder context from
> previous chunks to maintain prosodic continuity.

Tuning constants (`LongformConfig`): `history_len_heuristic = 20` history
tokens retained, `short_sentence_threshold = 35` (skip the attention prior for
short sentences), and the trigger threshold is **45 words for English**
(~20 s of audio) — chunks are split on `. ? ! ...` with abbreviation handling.

**Our architecture discards precisely the mechanism the model ships to keep
prosody continuous, and it splits ~6× finer than the model's own threshold.**

### Measured cost of the current split

`magpie-cli say`, Q6_K, Vulkan, speaker John, `--threads 22`, seed 42:

| text bytes |   wall |  audio | RTF (wall/audio) |
| ---------: | -----: | -----: | ---------------: |
|         12 | 1.20 s | 0.84 s |        **1.438** |
|         75 | 4.66 s | 4.69 s |        **0.994** |
|        170 | 4.34 s | 9.85 s |        **0.441** |

A 12-byte fragment synthesizes _slower than realtime_. A 170-byte span is
**3.3× more efficient per second of audio**. Fixed per-process overhead
(model load + Vulkan upload) is ≈0.6 s and is paid once per chunk.

So the small-chunk design costs us **both** naturalness and throughput. One
change fixes both.

### Recommended direction

1. **Chunk on sentences, not bytes** — target the model's own regime
   (≈45 English words) instead of 300 bytes, subject to the provider ceiling.
2. **One persistent worker** — keep a single warm process/session per voice
   instead of process-per-chunk; the 0.6 s load and the 527.5 MiB upload are
   then paid once per session, not once per chunk.
3. **Carry context across chunks** — the upstream `magpie-tts.cpp` must expose
   the history text/encoder context that `LongformChunkState` describes. This
   is an upstream capability gap, not a configuration knob: it requires
   extending the pinned CLI (we already proved a patched CLI can expose extra
   generation options, at upstream `3008ff73`).
4. **Cross-fade the joins** — until (3) lands, a short equal-power cross-fade
   at concatenation boundaries removes the audible cold-start seam that plain
   PCM splicing leaves behind.

Items 1, 2 and 4 are implementable against the pinned binary today. Item 3
requires an upstream patch and must be gated behind blind listening scores,
per the existing promotion rule.

---

## 2. Audio surplus and warm start

The reader currently synthesizes only after Play, and `AiPlaybackBar` keeps a
**count-based** look-ahead (`lookaheadUnits`, `prefetches: Map`). Two problems:

- a count of chunks is not a duration — with the RTF spread measured above,
  "2 chunks ahead" can mean 1.7 s or 20 s of surplus;
- nothing is warm when a book is opened, so the first Play pays document
  parse + text extraction + planning + model load + synthesis serially.

**SOTA framing** (streaming-TTS/jitter-buffer practice): target a _duration_
of decoded audio ahead of the playhead, adapt it to measured production speed,
and separate _time-to-first-audio_ from _steady-state surplus_. A producer that
runs at RTF 0.44 generates 1 s of audio per 0.44 s, so a modest lead grows on
its own; the buffer only needs to absorb variance, not the whole page.

**Recommended design**

- Replace `lookaheadUnits` with a **seconds-of-audio target** (e.g. warm 20 s,
  ceiling 60 s), computed from produced-vs-consumed duration.
- Adapt the target from the measured trailing RTF: if RTF > 0.8, deepen the
  buffer; if RTF < 0.3, shrink it to bound memory and wasted work.
- **Warm on book selection**, but split by egress class:
  - _always_ — open the document, render page 1, extract text, build the
    prosody plan, resolve the voice/route, probe the local engine, warm the
    audio cache lookup. None of this emits text off-device.
  - _local route only_ — pre-synthesize the opening span so Play is instant.
  - _cloud routes (ElevenLabs/Groq)_ — **no pre-synthesis**. The product rule
    is that PDF text leaves the machine only after explicit Play or "Read from
    here"; pre-buffering to a cloud provider would break it. Warm everything
    local and start cloud synthesis on the Play gesture.

That asymmetry is deliberate and should be visible in the UI so the local
route's instant start is understood as a privacy consequence, not a bug.

---

## 3. Smooth zoom

Our `PdfViewer` re-renders the canvas on every zoom change behind a debounce
(`renderDebounceRef`, `RENDER_DEBOUNCE_MS`) and has no intermediate visual —
so zoom reads as a stall then a jump.

pdf.js solves this with a **two-phase update**, visible in
`web/pdf_page_view.js` (`update({ scale, drawingDelay })`):

```js
const postponeDrawing = drawingDelay >= 0 && drawingDelay < 1000;
if (postponeDrawing || onlyCssZoom) {
  if (postponeDrawing && ...) {
    this.cancelRendering({ keepTextLayer: true, cancelExtraDelay: drawingDelay, ... });
  }
  this.cssTransform({ redrawTextLayer: !postponeDrawing, hideTextLayer: postponeDrawing, ... });
  return;
}
```

The technique, in order:

1. `#setDimensions()` and set the `--scale-factor` custom property so the text
   layer stays geometrically aligned at the new scale;
2. **immediately** `cssTransform(...)` the _existing_ canvas — the user sees a
   continuous scale with zero render latency (a stretched bitmap);
3. **postpone** the expensive re-render by `drawingDelay`, cancelling any
   in-flight render so a continuous gesture does not queue N renders;
4. when the gesture settles, render at the true scale and swap in the sharp
   canvas;
5. `maxCanvasPixels` / restricted scaling keeps CSS-only zoom when a true-scale
   canvas would exceed the platform canvas limit.

This maps cleanly onto our renderer: keep `calculateRenderPlan`, add the
CSS-transform preview phase and a generation-guarded deferred re-render. It
also composes with the existing reduced-motion requirement — under
`prefers-reduced-motion: reduce` the preview transform is applied without a
transition, so movement is instant but never blank.

---

## 4. Read-along highlight

Hard platform constraint first. `::highlight()` accepts **only** these
properties (MDN, <https://developer.mozilla.org/en-US/docs/Web/CSS/::highlight>):

> `color`, `background-color`, `text-decoration` and its associated
> properties, `text-shadow`, `-webkit-text-stroke-color`,
> `-webkit-text-fill-color` and `-webkit-text-stroke-width`

No padding, no border-radius, no transform, no transition/animation. Any
design that assumes a rounded animated chip is not implementable through the
Custom Highlight API — it would need a DOM overlay, which is what the current
code was right to avoid.

Today we register exactly one highlight, painted as a solid inverted chip:

```css
::highlight(tts-current-word) {
  background-color: var(--color-speak);
  color: var(--color-on-accent);
  text-decoration: underline 2px var(--color-on-accent);
}
```

A single hard word chip is the weakest usable read-along: it inverts colour
against the page, gives no sense of where the sentence is going, and forces the
eye to chase a jumping block.

**Recommended design** — two registered highlights with explicit priority
(`Highlight.priority`), which is the established pattern in read-along readers:

- `tts-active-sentence`: a low-contrast background tint over the whole spoken
  run, no colour inversion. It gives the eye a stable landing zone and makes
  the scroll band meaningful.
- `tts-current-word`: on top, a stronger background plus a thick underline in
  the accent colour, **without** flipping the foreground colour where contrast
  already passes.

Because the sentence range is exactly the `SpokenRun` source range we already
compute, and the word range is the mapped range we already resolve, this needs
no new geometry — only a second `Highlight` registration and a priority.

---

## Priority

Ranked by measured leverage:

1. **Sentence-sized chunks + one warm worker + join cross-fade** — fixes
   enunciation seams and multiplies throughput (RTF 1.44 → 0.44 measured).
2. **Duration-based surplus + warm-on-selection (local-only pre-synthesis)** —
   removes the cold start without breaking the egress rule.
3. **CSS-transform zoom preview + deferred sharp re-render** — proven pdf.js
   technique, contained in `PdfViewer`.
4. **Two-tier sentence/word highlight** — small diff, large perceived gain.
5. **Upstream context carry (`LongformChunkState` equivalent)** — the real
   naturalness ceiling, but it needs a patched engine and must clear blind
   listening before promotion.
