# Local TTS: state of the art and Lectrice's actual GPU

Research checkpoint: **08/09/2026, desktop**. This is a source-backed shortlist,
not a new listening study or a claim that all candidates have run here.

## Decision in one paragraph

Keep **Magpie Q6_K / Vulkan** as the hardware-measured baseline; benchmark
**Qwen3-TTS 0.6B, then 1.7B, via qwentts.cpp/Vulkan** as the most practical
challenger. Consider **VoxCPM2 GGUF** after those. Keep **Supertonic 3** as an
explicit CPU fallback, with Kokoro/Pocket as alternatives rather than forcing
GPU use on tiny models. Fish S2 Pro is an expressive quality reference, not a
sensible full-precision default on this 8 GB AMD board. Do not change the live
provider until a real EN/PT-BR long-form comparison and packaged-app gate pass.

## Hardware and current operational truth

- Live `vulkaninfo --summary`: **AMD Radeon RX 5700 XT**, RADV NAVI10,
  Mesa **26.2.2**, Vulkan **1.4.354**. Discrete AMD GPU, not NVIDIA.
- amdgpu sysfs: **8,573,157,376 bytes total VRAM**, approximately 8 GiB;
  initial snapshot about 2.42 GB used. Available VRAM fluctuates with desktop use.
- RDNA1/gfx1010 is absent from AMD's current official ROCm support matrix.
  CUDA/FlashAttention/FlashInfer installation instructions are not proof of an
  AMD route. Prefer a tested native Vulkan runtime over unsupported ROCm workarounds.
- **No service answered `127.0.0.1:5301` at this checkpoint.** The bridge's
  documented candidate binary/model directory is absent. Historical benchmark
  receipts are still committed, but these are not current service-health proof.
  No model, service, driver, or application installation was changed in this run.

## Candidate comparison

“Published” below means the upstream author's claim, not a reproduced result.
A runtime's license and the model-weight license are separate.

| Candidate                                  | Current capability                                                                                                                                                                           | Path on this machine                                                                                                                                                                                 | License / limitation                                                                                                                                                                                                                        | Priority                                        |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Magpie Multilingual**                    | Latest card: v2607, released 21/07/2026, 12 languages including Portuguese; 5 preset voices; long-form sliding window. Card now says **364M**, although repository name says 357m.           | `mudler/magpie-tts.cpp`, GGUF Q6_K, Vulkan/RADV. Only shortlisted model with retained measurements on this exact GPU.                                                                                | Runtime MIT; weights NVIDIA Open Model License. Latest release removes zero-shot cloning. Pinned local hash must be matched to upstream revision, not assumed latest.                                                                       | **Baseline / first restore candidate**          |
| **Qwen3-TTS 0.6B / 1.7B**                  | 10 languages including Portuguese. CustomVoice, cloning; 1.7B adds instruction control / VoiceDesign. Official published end-to-end synthesis latency claim as low as 97 ms.                 | Community **qwentts.cpp** supports Vulkan, Q8_0/Q4_K_M and streaming codec decode; not restricted to CUDA. **Not benchmarked here.**                                                                 | Model + codec Apache-2.0; runtime MIT. Official latency is not an RX 5700 XT guarantee; codec/KV/activations also consume memory.                                                                                                           | **First challenger**                            |
| **VoxCPM2**                                | 2B, 30 languages including Portuguese, voice design/cloning, 48 kHz. Published RTF about 0.30 on RTX 4090 or 0.13 with accelerated serving.                                                  | Upstream links `llama.cpp-omni` for GGUF CPU/Metal/CUDA/**Vulkan**. No local AMD measurement.                                                                                                        | Apache-2.0. Upstream's separate Q8_0/M4 Pro example reports RTF **1.76**, which is slower than real time under the standard definition. Runtime/hardware matter.                                                                            | **Second challenger**                           |
| **Fish Audio S2 Pro**                      | 4B slow-AR + 400M fast-AR, 80+ languages; Portuguese tier 2; fine-grained expressive tags and multi-speaker context.                                                                         | Published SGLang/CUDA serving is not this board's runtime. About **8.8 GB for 4.4B fp16 weights alone**, before codec/cache: not a full-precision fit. A quantized/ported route needs its own proof. | **Fish Audio Research License**, noncommercial/research use; commercial use requires separate permission. Open weights is not unrestricted FOSS.                                                                                            | **Quality reference; not default**              |
| **Chatterbox Flash / Nano / Multilingual** | Flash: ~520M block diffusion, streaming; published 103 ms first packet and RTF as low as 0.076. Nano: 110M, published 3× real time on 8 CPU cores.                                           | Flash's advertised fast path uses FlashInfer/CUDA graphs (also MLX); no verified Vulkan path found in the inspected primary docs. Nano is CPU-oriented.                                              | MIT. **Flash and Nano are English-only**; Portuguese belongs to the distinct ~500M Multilingual model.                                                                                                                                      | **English experiment / multilingual watchlist** |
| **Supertonic 3**                           | About 99M across public ONNX assets, 31 languages including Portuguese; improved reading stability/repeat-skip behavior.                                                                     | Lightweight ONNX **CPU**, no GPU requirement. A documented prior Lectrice fallback, not an active listener today.                                                                                    | Sample code MIT; **model OpenRAIL-M**, not MIT. Published CPU figures are not new desktop measurements.                                                                                                                                     | **Practical explicit fallback**                 |
| **Kokoro 82M**                             | Small multilingual model, useful packaging/latency baseline. Existing Lectrice fixture work documents Python token timestamps.                                                               | CPU/ONNX or Python; GPU is optional rather than necessary.                                                                                                                                           | Apache-2.0 weights. Python timestamps were chunk-relative; inspected JS/ONNX path lacked them, with approximately **0.44 s** error from proportional timing in the retained test. Recheck current runtime before claiming exact read-along. | **Alignment-aware fallback**                    |
| **Pocket TTS**                             | Current upstream README lists English, French, German, Portuguese, Italian, Spanish; ~100M English baseline and larger non-English variants. Do not repeat the old English-only description. | CPU-first streaming; upstream ~6× real-time claim is on M4, not this x86 GPU.                                                                                                                        | Model-card access returned HTTP 401 in this research; model/voice licenses and access need independent confirmation before redistribution.                                                                                                  | **Portable CPU experiment**                     |

Qwen's published GGUF files make a bounded experiment attractive: CustomVoice
0.6B Q4_K_M is **604,878,080 bytes**, 1.7B Q4_K_M is **1,182,631,296 bytes**,
and the separate Q8_0 tokenizer/codec is **291,150,624 bytes**. These are
**download sizes, not peak VRAM measurements**. No files were downloaded beyond
small public documentation/metadata.

Other relevant families checked: Fun-CosyVoice3 0.5B and older F5/VibeVoice
references remain valid comparative baselines, but this run did not establish a
better tested RDNA1 deployment path or a language/throughput advantage over the
shortlist. A paper/leaderboard win alone does not settle reader suitability.

## What our retained Magpie benchmark actually proves

PR #194 retains the full JSON and raw GPU samples under
`docs/evidence/182-magpie-real-page-20260828/` (available on branch
`182-gpu-performance`, not merged into main at this checkpoint):

- Model SHA-256:
  `8291ffde2e13e2e9221a000669b5f7814c7ecc858eb0a1a9de8ee77d8da05736`.
- Held-out page: **2,232 UTF-8 bytes**, defensively split into bounded units.
- Audio **133.70 s**, synthesis wall **64.94–68.84 s**.
- Standard **RTF = wall / generated audio = 0.486–0.515**.
- Additional VRAM **1.32–1.36 GB**; repeated GPU-device handle observations.
- A deliberately short 24-byte first unit took **2.07 s**.
- Previous whole-page assertion crash was avoided by bounded chunking. This is
  not evidence that unbounded text is safe or that chunk seams sound natural.
- The bridge advertises EN/PT-BR voices and **no native word marks**. A correct
  source mapping plus duration-estimated marks must not be described as an
  acoustically measured word alignment.

**Important version distinction:** the NVIDIA model card's NeMo-Speech.cpp example
uses **v2602 f16 GGUF**, while the latest model card describes **v2607**. Neither that
example nor a secondary summary identifies the revision of our retained Q6 hash.
Do not label our measurement v2602 or v2607 without reading model provenance.

### Faster narration changes the throughput requirement

To sustain playback speed `s`, synthesis must satisfy **RTF < 1/s**, including
usable pipeline overhead and an adequate safety margin:

| Playback speed | Maximum break-even RTF |
| -------------- | ---------------------: |
| 1×             |                  1.000 |
| 2×             |                  0.500 |
| 3×             |                  0.333 |
| 4.5×           |                  0.222 |

Magpie's retained result is comfortable for **1×**, borderline around **2×**,
and does **not** prove sustained 3×–4.5× narration. A warm cache or prebuffer
can hide this temporarily; it cannot manufacture long-run synthesis capacity.

## Minimum comparison before changing the default

Use the existing local HTTP/WAV contract and test fixtures, not a new provider
abstraction. Run models serially in isolated, non-production endpoints.

1. Pin runtime commit, model/codec hashes, quantization, voice, language, driver
   and hardware. Verify actual GPU use, not just a “GPU” setting label.
2. Use the same **public or self-authored** EN/PT-BR material: prose, dialogue,
   headings, numbers/currency/dates, abbreviations, footnotes, long paragraphs,
   and cross-page continuation. No private books sent to remote providers.
3. Record cold start separately from warm **time to first audible audio**;
   report uncached wall/audio RTF, peak VRAM/RSS and repeated-run distributions.
4. Extend to at least 30 minutes of generated reading, measuring queue underruns
   at the selected playback speed, leaks, skips/repeats and cancellation latency.
5. Blind A/B naturalness and pronunciation scoring; ASR/WER is an omission and
   intelligibility diagnostic, not a substitute for listener preference.
6. Public-control packaged journey: select voice, Play, Pause, Read from here,
   Stop, change page, resume; source highlight identity, no stale queue, no cloud
   fallback or secret persistence. Identify measured versus estimated timestamps.
7. Promote only after the bounded tests and capable different-family review
   pass. Keep an explicit tested CPU rollback route; do not silently switch.

## Sources and evidence limitations

SearXNG was tried with three query angles, then one simpler retry; its upstream
engines returned no results (rate limits/access denial/CAPTCHA/connection errors).
Research therefore used direct canonical model cards, repositories and GitHub/HF
metadata, not an invented comprehensive web-search result.

- [Magpie model/version/license](https://huggingface.co/nvidia/magpie_tts_multilingual_357m)
- [Magpie community Vulkan runtime](https://github.com/mudler/magpie-tts.cpp)
- [Official NeMo-Speech.cpp](https://github.com/NVIDIA/NeMo-Speech.cpp)
- [Qwen3-TTS official models](https://github.com/QwenLM/Qwen3-TTS)
- [qwentts.cpp Vulkan runtime](https://github.com/ServeurpersoCom/qwentts.cpp)
- [Qwen GGUF file inventory](https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF/tree/main)
- [VoxCPM2](https://github.com/OpenBMB/VoxCPM)
- [Fish S2 Pro model/license](https://huggingface.co/fishaudio/s2-pro)
- [Chatterbox Flash](https://huggingface.co/ResembleAI/chatterbox-flash)
- [Chatterbox Nano and variant distinctions](https://huggingface.co/ResembleAI/chatterbox-nano)
- [Supertonic 3 model/license](https://huggingface.co/Supertone/supertonic-3)
- [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M)
- [Pocket TTS current README](https://github.com/kyutai-labs/pocket-tts)
- [CosyVoice](https://github.com/FunAudioLLM/CosyVoice)
- [AMD official compatibility matrix](https://rocm.docs.amd.com/en/latest/compatibility/compatibility-matrix.html)

Local raw-source archive (18 successful fetches, retained Pocket HTTP 401,
timestamps and SHA-256 manifest):
`~/.local/state/fleet-coordination/lectrice-ux-tts-20260908/evidence/sources/`.
A bounded public GLM extraction helped organize these sources; the parent checked
claims against originals and rejected its unsupported attribution of the retained
Magpie run to v2602. No universal quality-SOTA verdict or fresh local-model
benchmark is claimed.
