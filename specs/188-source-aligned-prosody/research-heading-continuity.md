# Heading delivery and long-form continuity research

**Measured:** 27/08/2026
**Trigger:** the real page heading “What This Book Is About” sounded like the first half of an interrupted phrase, and subsequent narration lacked human-like connection.

## Exact source finding

The screenshot OCR was confirmed against the local source PDF. PDF.js page 7 publishes:

| Item                      |        Font/height | Baseline | `hasEOL` |
| ------------------------- | -----------------: | -------: | -------: |
| `What This Book Is About` | `g_d0_f7`, 21.2475 |    700.5 |  `false` |
| `This book aims to fill…` |    `g_d0_f8`, 15.0 |    673.5 |   `true` |

The 1.416× size change, font change, and 27pt baseline gap are strong section evidence. Lectrice nevertheless required `hasEOL` before considering geometry, so it flattened the source to:

> `What This Book Is About This book aims to fill…`

The sentence splitter then continued through the heading until the paragraph’s first period. The model was therefore asked to deliver the heading as a non-final clause. The interrupted intonation is explained by the actual request, not by an assumed voice defect.

## Evidence synthesis

1. **Phrasing must follow semantic groups.** PauseSpeech reports that natural TTS needs a phrasing structure that groups words by semantic context; it predicts pause sequences and conditions word-level prosody on those phrase boundaries. A heading is its own intonational/discourse unit, not the prefix of the next sentence.
2. **Paragraph position and cross-sentence context matter.** ParaTTS explicitly models linguistic context, prosodic context, and sentence position; its paragraph speech was subjectively preferred to sentence-based synthesis and better rendered breaks/prosodic variation between consecutive sentences.
3. **Sentence quality does not imply paragraph quality.** ContextSpeech identifies ignored cross-sentence context as a root cause of long-form TTS deficiencies and reports improved paragraph voice quality/prosody when global text and speech context are retained.
4. **Paragraph prosody varies over the discourse.** Peiró-Lilja and Farrús model pitch decay, pitch range, speech-rate variation, and paragraph-break pauses; English/German perception tests favored paragraph-aware variants. This argues against treating every sentence as an acoustically unrelated clip.
5. **Supertonic already supports bounded multi-sentence units.** Its official `chunk_text` groups complete sentences within a 300-character default, and warns that very small chunks may produce poor quality. `TTS.synthesize` sends each resulting chunk to one model call. Lectrice’s one-sentence-per-request queue prevents that context from being used.
6. **Provider-native continuity should be used where available.** ElevenLabs documents `previous_text`, `next_text`, and previous/next request IDs specifically to improve continuity when concatenating generations; this is a later adapter slice, not a generic markup trick.

## Implementation decision

### Heading

- Recognize a section boundary from strong size + font + baseline-gap evidence even when PDF.js omits `hasEOL`.
- Keep the PDF/display source unchanged.
- Insert a spoken-only terminal period with `sourceStart/sourceEnd = null`.
- Synthesize the heading as its own short unit. This gives the model a terminal contour and preserves fast first audio.
- Carry the `section` boundary through IPC into native PCM normalization. The initial semantic target is 800ms total (50ms next-head + 750ms current tail), inside the audit's 700–1,000ms section grid. It is an explicit testable default, not a claim of listener preference; blind scoring remains authoritative.

For the measured page this becomes:

- display: `What This Book Is About`
- spoken: `What This Book Is About.`
- next spoken unit begins: `This book aims…`

### Connected body speech

- Preserve the first spoken unit as a short latency unit.
- Merge later complete sentences from the same paragraph into one request up to `min(provider bound, 300 UTF-8 bytes)`.
- Never merge across paragraph/section boundaries.
- Let the TTS model shape within-unit word timing, coarticulation, pitch, and sentence transition; do not inject fixed pauses between words.
- Continue edge-normalizing only the outer boundary between independent requests.

The 300-byte cap is deliberately more conservative than Supertonic’s 300-character default and prevents its internal chunker from creating an unobserved additional model boundary.

## Not selected

- No cloud LLM rewrite of book text.
- No capitalization-only heading rule.
- No generic SSML, breath tag, or word-by-word pause insertion.
- No claim that one heading pause or context size is human-preferred before blind listening.
- No larger Supertonic context than the documented default in this slice.

## Acceptance probes

- The exact PDF geometry produces a `section` boundary despite `hasEOL=false`.
- The source title remains unchanged while spoken text gains one unmapped period.
- The title remains the first short request and its native section boundary realizes 800ms ±50ms.
- Subsequent same-paragraph sentences are one ≤300-byte request.
- Paragraph/section boundaries prevent merging.
- Every spoken source word maps once to its original UTF-16 range.
- Packaged public Play observes the spoken heading and exact source highlight.

## Primary sources

- Hwang et al., **PauseSpeech: Natural Speech Synthesis via Pre-trained Language Model and Pause-based Prosody Modeling**: https://arxiv.org/abs/2306.07489
- Xue et al., **ParaTTS: Learning Linguistic and Prosodic Cross-Sentence Information in Paragraph-Based TTS**: https://arxiv.org/abs/2209.06484
- Xiao et al., **ContextSpeech: Expressive and Efficient Text-to-Speech for Paragraph Reading**: https://arxiv.org/abs/2307.00782
- Peiró-Lilja & Farrús, **Paragraph Prosodic Patterns to Enhance Text-to-Speech Naturalness**: https://www.isca-archive.org/speechprosody_2018/peirolilja18_speechprosody.html
- Supertonic official source, `utils.py::chunk_text` and `pipeline.py::TTS.synthesize`: https://github.com/supertone-inc/supertonic
- ElevenLabs TTS API continuity parameters and large-text guidance: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps and https://elevenlabs.io/docs/overview/capabilities/text-to-speech
