# Local TTS improvement — research delta and ranked experiment plan

Research checkpoint: **12/09/2026, desktop**. Follows and does not rederive
`local-tts-sota-20260908.md` (08/09 shortlist authority, kept frozen). This
document records only **deltas since that checkpoint** and a **ranked,
bounded experiment plan** for the RX 5700 XT 8 GiB / RADV (Vulkan-first;
official ROCm does not support RDNA1/gfx1010). No benchmark number in this
document is a local hardware measurement; vendor/upstream figures are labeled
"published" and were not reproduced here. Every local number remains the
retained Magpie receipt from PR #194 (RTF 0.486–0.515, additional VRAM
1.32–1.36 GB, 24-byte first unit 2.07 s). Magpie is **not a live service**
(`127.0.0.1:5301` still refused connections 12/09/2026).

Method transparency: SearXNG was tried with three query angles plus one
simpler retry (12/09/2026 21:30–21:32 BRT); all upstream engines returned
suspended/denied (brave, duckduckgo, google, mojeek, qwant). Raw JSON
responses are retained in the run evidence dir. Research then used direct
canonical GitHub REST / Hugging Face API fetches with bounded timeouts; raw
responses, retrieval timestamps and file hashes are retained alongside. An
arXiv API query for chunking/prosody papers timed out on retry and was
dropped (flagged as an unknown; the prosody angle is grounded in primary
runtime sources and Lectrice's own code instead). Two research passes total,
per cap.

## Research delta since 08/09 (all retrieved 12/09/2026)

### Challenger runtime: qwentts.cpp is active and moved

Repository `ServeurpersoCom/qwentts.cpp` (MIT runtime; Qwen3-TTS weights and
12 Hz codec Apache-2.0):

- HEAD `2a688b414` (12/09/2026) "ggml: move off the deprecated precision
  setters"; ggml fork updates `779c7cb13` (11/09) and `6cb8a29c9` (03/09);
  `a69194fc8` (02/09) "qwen: make the worker the single owner of backend
  compute". ggml submodule pin: `7d0241063` (fork `ServeurpersoCom/ggml`).
- **Streaming** (README claim, our verification required): stateful
  frame-by-frame codec decode; the first audio callback fires **one frame
  after the first Talker step**, and the streamed output **matches the
  offline full decode exactly**. If confirmed on our GPU, this addresses
  TTFA and chunk-seam prosody at the engine level (one continuous LM pass —
  no per-chunk prosody reset inside a request).
- **Server**: `tts-server` is OpenAI-compatible; `response_format=pcm`
  streams s16le while generating, `wav` is one-shot; cloned voices register
  once (server-side WAV or pre-encoded latents); `seed` makes requests
  reproducible. This matches Lectrice's existing local HTTP/WAV contract
  shape without a new provider abstraction.
- **Quantization**: Q8_0 and Q4_K_M of the talker backbone (0.6B and 1.7B;
  base / customvoice / voicedesign), RVQ codec paths kept F32;
  `qwen-tokenizer-12hz` in Q4_K_M/Q8_0/BF16/F32.
- **Warm-start lever**: reference audio can be pre-encoded once into
  `.spk`/`.rvq` latents (`qwen-codec --talker`), skipping the speaker
  encoder and codec encode on every synthesis; the C ABI
  (`qt_extract_voice_ref`) does the same in-process.
- **Embedding**: public single-header C ABI (`qt_*`), C99 `-Werror` tested;
  shared-library target exports only `qt_*`.
- GGUF inventory (`Serveurperso/Qwen3-TTS-GGUF`, lastModified 09/09/2026,
  repo sha `b7ee2e8c7459…`) — **download sizes, not VRAM peaks**:
  0.6b-base-Q4_K_M 628,905,056 B; 0.6b-base-Q8_0 992,615,488 B;
  1.7b-base-Q8_0 2,079,448,256 B; 1.7b-customvoice-Q8_0 2,042,834,304 B;
  tokenizer-12hz-Q8_0 291,150,624 B; tokenizer-12hz-Q4_K_M 254,974,752 B.

### Upstream Vulkan backend: optimizations landing in exactly our decode shape

`ggml-org/llama.cpp`, PRs with label `vulkan` (631 merged lifetime), recent
merged: **#28457 "small M matrix optimizations for qwen" (10/09/2026)** —
small-M decode is the Qwen3-TTS talker shape; **#28426 dedicated iq4_xs
mat-vec shader** (09/09); **#25773 spec-constant matmul A-type** (09/09);
#28705 argsort data-race/OOB fix (11/09); #28618 `cpy_tensor_async` CPU-write
fix (10/09). **Unknown (flagged):** whether qwentts.cpp's 11/09 ggml fork
pull (`779c7cb13`, pin `7d0241063`) already includes #28457/#28426 — the R1
experiment pins and measures, it does not assume.

### Second challenger: VoxCPM2 on-device path moved but Vulkan is unverified

Canonical fork `tc-mb/llama.cpp-omni` (pushed 11/09/2026): VoxCPM2 "true
streaming for clone / continuation" (`164819778`, #91, 25/08) and
`--threads` applied to inference backends (`64d092c60`, #106, 27/08). Its
README documents only MiniCPM-o 4.5 with **CMake auto-detecting Metal or
CUDA** and a Token2Wav total published as RTF ~0.47× (NVIDIA GPU context) —
**no Vulkan claim and no VoxCPM2 GGUF section in the README**. The
flow-matching Token2Wav modules on RADV are therefore **unverified**; ranking
stays second and gated (R4).

### Baseline: unchanged

- `mudler/magpie-tts.cpp`: **no commits since 24/07/2026** — baseline runtime
  frozen; the retained PR #194 receipts remain the only measured numbers.
- NVIDIA Magpie model card: lastModified 09/09/2026 but content still lists
  **v2607 as latest** (v2602, v2512 previous) — a metadata touch, not a new
  release; the 08/09 "v2602-example vs v2607-card provenance gap" for our
  retained Q6 hash stands, unchanged.
- Supertone/supertonic-3: unchanged since 18/05/2026 — CPU fallback
  unchanged. OpenBMB/VoxCPM2 weights unchanged since 18/08/2026.

### Host runtime: current and unchanged

Live 12/09/2026: Vulkan API 1.4.354, driver 26.2.2, RADV NAVI10 (device
0x731f) — identical to the 08/09 checkpoint. Whether a newer Mesa stable
exists is **unverified** (freedesktop GitLab tags endpoint is behind
Anubis bot-protection; fetch retained). Not load-bearing: R1 tests on the
installed driver first.

### Lectrice's own pipeline (fix before switching — the actionable seam)

`src/domain/tts/text-chunking.ts` on main (9e037b15): regex sentence split
(`/[.!?]+[\s]*/`), 500-char max / 20-char min chunks, chunk-relative
offsets, IDs `chunk-<page>-<index>`, **no cross-chunk context carry and no
PT-aware abbreviation handling** — "Sr.", "Lt.", "R$ 1.500" and decimal
commas produce false sentence seams, which is precisely the
silence-gap / skip / repeat risk the acceptance gate measures. `tts.port.ts`
exposes chunk/utterance state only — **no word-mark or timestamp field**;
word marks today can only be duration-estimated and must stay labeled
estimated. Unmerged prior art exists: branch `188-source-aligned-prosody`
(175 files, +11,534 lines from the 08/09-era stack) — R0 should mine it
before writing anything new.

## Ranked experiment plan (serial, one variable at a time, no live-app change)

- **R0 — chunker v2 (pure domain, engine-independent, both engines benefit).**
  Sentence-boundary packing to ~300–450 chars with a hard cap; carry only the
  trailing partial sentence into the next chunk (no re-synthesis); preserve
  page + source offsets; PT-aware abbreviation/currency guards (Sr., Sra.,
  Ltda., R$, ordinals). Unit-test with public/self-authored PT-BR + EN
  fixtures. No new dependency. Mine `188-source-aligned-prosody` first.
- **R1 — qwentts.cpp Vulkan bring-up and measurement (isolated, non-production
  endpoint; native run needs the coordinator's grant).** Pin commit
  `2a688b414` + ggml `7d0241063`; `buildvulkan.sh`; measure 0.6B then 1.7B,
  Q8_0 first (fidelity), then Q4_K_M. Record TTFA cold/warm, uncached
  wall/audio RTF, p95 over ≥20 runs, peak VRAM/RSS; verify GPU use from RADV
  counters, not a "GPU" label. Break-even table from 08/09 applies: sustained
  2× needs p95 RTF < 0.500, 3× < 0.333, 4.5× < 0.222. Compare against the
  **measured** Magpie numbers, never vendor claims.
- **R2 — streaming and marks.** Drive `tts-server` `response_format=pcm`:
  measure first-audio latency and inter-chunk gap vs one-shot; expect the
  frame-continuous stream to collapse seam artifacts inside a request.
  Word marks remain duration-estimated per chunk (labeled as such) unless
  the engine proves real alignment (none documented — do not invent).
- **R3 — comparison gate.** Same public/self-authored EN+PT-BR fixture set
  (prose, dialogue, headings, numbers/currency/dates, abbreviations,
  footnotes, long paragraphs, cross-page continuation); blind A/B vs Magpie
  Q6_K baseline; packaged-journey control (voice select, Play/Pause/Read
  from here/Stop, page change, resume; no stale queue, no cloud fallback).
  Only after R3 may a default-switch PR be proposed — with Supertonic CPU
  kept as explicit rollback.
- **R4 — VoxCPM2 (gated).** Only if R1–R3 pass and PT quality holds: first
  verify any Vulkan path for llama.cpp-omni's VoxCPM2/flow-matching modules
  on RADV (today unverified). If unsupported: stop — CUDA routes are not
  available on this GPU. Do not spend on it before R1 lands.

## Exact acceptance criteria (no pass without the artifact)

1. **Pinning receipt**: engine commit + ggml pin, per-file model SHA-256,
   quantization, voice/speaker id, language, Mesa/driver version, measured
   GPU utilization — plus **license for weights AND runtime** (qwentts.cpp
   MIT; Qwen3-TTS weights + 12 Hz codec Apache-2.0; Magpie runtime MIT /
   weights NVIDIA Open Model License; Supertonic sample code MIT / model
   OpenRAIL-M; VoxCPM2 Apache-2.0).
2. **TTFA**: cold (process + model cold) and warm reported separately,
   mean + p95 over ≥10 runs. Challenger gate: warm TTFA ≤ 1.5 s for 0.6B,
   i.e. must beat the measured Magpie 24-byte first-unit 2.07 s.
3. **RTF**: uncached wall/audio at 1×/2×/3×/4.5× on the fixed fixture set;
   p50/p95; gate = p95 below break-even (1.000 / 0.500 / 0.333 / 0.222) for
   every speed claimed.
4. **Memory**: peak additional VRAM/RSS vs idle desktop snapshot; fail if
   total board usage > 7.0 GiB (8 GiB board shared with the desktop).
5. **Seam integrity**: no inter-chunk silence > 250 ms (measured from WAV,
   not assumed); no repeated or dropped words on the scripted fixture
   (human checklist; ASR WER permitted as labeled diagnostic only).
6. **Cancellation**: Stop mid-chunk → audio stops ≤ 300 ms and no stale
   queue item speaks afterwards (packaged-journey evidence).
7. **Soak**: ≥30 min continuous reading at target speed: zero underruns,
   flat RSS, no GPU hang, RTF distribution over time logged.
8. **Marks honesty**: real vs estimated word marks explicitly labeled in
   UI/receipt; estimated marks never described as measured alignment.
9. **Provenance**: every number from our runs; upstream/vendor figures only
   ever quoted as "published".

## Unknowns (flagged, not invented)

- Whether qwentts.cpp's fork pin includes Vulkan PRs #28457/#28426.
- PT-BR voice availability/quality in Qwen3-TTS CustomVoice (speaker list
  exists; language-coverage claims differ between sources — 10 vs 11
  languages incl. Mandarin dialects; must be listened to, not assumed).
- Vulkan support for llama.cpp-omni VoxCPM2 flow-matching modules (README
  documents CUDA/Metal only).
- Latest Mesa stable (GitLab bot-blocked 12/09); installed 26.2.2 is what
  will be tested.
- Whether Qwen3-TTS exposes native word alignment (none documented).
- Academic chunking/prosody citations (arXiv fetch timed out; angle grounded
  in primary runtime sources instead).

## Sources (retrieved 12/09/2026; raw copies + hashes in run evidence dir)

- qwentts.cpp README + commits — https://github.com/ServeurpersoCom/qwentts.cpp (HEAD `2a688b414` 12/09; ggml pin `7d0241063`)
- Qwen3-TTS-GGUF inventory — https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF (lastModified 09/09/2026, sha `b7ee2e8c7459…`)
- llama.cpp Vulkan merged PRs — https://github.com/ggml-org/llama.cpp (#28457, #28426, #25773, #28705, #28618 among 631 lifetime)
- llama.cpp-omni README + commits — https://github.com/tc-mb/llama.cpp-omni (pushed 11/09; #91 25/08, #106 27/08)
- Magpie model card — https://huggingface.co/nvidia/magpie_tts_multilingual_357m (v2607 latest; card text verified 12/09)
- Magpie runtime — https://github.com/mudler/magpie-tts.cpp (last commit 24/07/2026)
- Supertonic 3 — https://huggingface.co/Supertone/supertonic-3 (unchanged 18/05/2026)
- VoxCPM2 — https://github.com/OpenBMB/VoxCPM + https://huggingface.co/OpenBMB/VoxCPM2 (18/08/2026)
- Lectrice sources on main 9e037b15: `src/domain/tts/text-chunking.ts`, `src/ports/tts.port.ts`, branch `188-source-aligned-prosody`
- Retained local measurement (not re-measured): PR #194 receipts, `docs/evidence/182-magpie-real-page-20260828/` on branch `182-gpu-performance`
