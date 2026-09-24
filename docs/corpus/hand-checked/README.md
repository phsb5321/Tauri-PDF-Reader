# Hand-checked PDF fixture corpus — layout contract

Gold fixtures for extraction-WER and the TTS-WER round-trip (design:
`tools/tts-wer-roundtrip.md`). Extends the private-corpus conventions of
`docs/corpus/manifest-2026-08-13.md`: **book bytes never enter git**. PDFs and gold sidecars
live in the external root; this directory carries the layout contract only (README, JSON
schema, synthetic examples).

## External layout

```text
$LECTRICE_REAL_PDF_CORPUS/
├── .lectrice-manifest.json          # existing registry: basename / sha256 / size / pages
└── gold/
    └── <basename>.gold.json         # one sidecar per fixture PDF (schema: gold.schema.json)
```

Sidecars and PDFs are mode `0600` on the operator host. Receipts and reports reference
sha256 only — no titles, no absolute paths, no page content. Round-trip outputs (WAV,
reports) go to the harness `--out` dir, never here.

## Composition (target: 20 pages — 10 en + 10 pt-BR)

One page per defect class per language wherever the defect occurs naturally (a page may
carry several tags):

| `defectTags` value                      | en  | pt-BR | In extraction gate?                                          |
| --------------------------------------- | --- | ----- | ------------------------------------------------------------ |
| `two-column`                            | 1   | 1     | yes (order inversions)                                       |
| `header-footer`                         | 1   | 1     | yes (leak counter)                                           |
| `table`                                 | 1   | 1     | yes                                                          |
| `footnote`                              | 1   | 1     | yes                                                          |
| `ligature`                              | 1   | 1     | yes                                                          |
| `hyphen-broken`                         | 1   | 1     | yes (join counter → 0)                                       |
| `math`                                  | 1   | 1     | yes                                                          |
| `ocr-required` (scanned, no text layer) | 1   | 1     | **excluded** — no OCR stage exists; known-limitation fixture |
| `clean-control` (single-column prose)   | 2   | 2     | yes (must score ~perfect)                                    |

Control pages make "harness broken" distinguishable from "extraction broken".

## Hand-check protocol (gold is never machine-generated)

1. **Pass 1 — transcribe** the page in true reading order into `goldText`: the _ideal
   narration text_ a perfect extractor would emit — hyphen-broken words **joined**
   (`dese- jo` on the printed page → `desejo` in gold), tagged header/footer/page-number
   spans **excluded** from `goldText` and recorded verbatim in `excludedSpans` (the leak
   counter's input), ligatures as the letters they stand for.
2. **Pass 2 — verify**: a second person, or a ≥24 h delayed self-check (breaks
   extractor/OCR priming). Sign-off recorded in the sidecar `checked` block.
3. **`spoken` units** — source→spoken pairs where speech diverges from display (same
   classes as the spoken-form corpus in slice 295): the round-trip's numeric-critical
   inputs.
4. **Register** the PDF in `.lectrice-manifest.json` (the fail-closed enumeration pattern of
   `scripts/corpus-enumerate.mjs` refuses unknown or changed inputs).
5. Fixture pages are public-domain or self-authored where quality allows; private pages are
   permitted because **every stage runs locally** — but no fixture text ever leaves the
   machine (no remote provider, no cloud ASR).

## What lives in git vs external

| In git (this directory)                                                    | External (0600, never in git)            |
| -------------------------------------------------------------------------- | ---------------------------------------- |
| `README.md` (this contract)                                                | `*.pdf` fixtures                         |
| `gold.schema.json`                                                         | `gold/*.gold.json` sidecars              |
| `example.gold.json` / `example.pt-BR.gold.json` (synthetic, self-authored) | `.lectrice-manifest.json`                |
|                                                                            | round-trip WAV + reports (→ `--out` dir) |

The synthetic examples are the schema smoke test, **not** scoring fixtures — their sha256 is
zero and no PDF backs them.
