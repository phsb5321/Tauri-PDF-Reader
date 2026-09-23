# Plan 293 — audible text-prep groundwork

## Technical Context

Pure-domain, synchronous, zero-dependency string work in the two modules the
mission names. The normalize-string/offsets contract of `BuiltPdfText` is the
load-bearing invariant (highlights + TTS share it), so de-hyphenation is
implemented as a join-time rewrite with paired segment adjustment, and the
span-annotation side gets a hyphen-stripped fallback key instead of a new
matching algorithm. Reference verbalization reuses `integerWords` and the
existing replacement shape exactly. MANDATE 23/09 (speed of light): no new
awaits/IO/state anywhere in these paths; `useOpenPdf.ts` untouched (294's
OPEN_BUSY lane); one measured wall-clock pathology guard included.

## Slices

1. `pdf-text.ts` — `isSoftHyphenJoin` guard (letter-hyphen end + lowercase
   continuation; join kind `null`/`line` only), join-time hyphen drop with
   `segments[last].{end,text}` adjustment, boundary suppression on the join,
   and the `annotatePdfTextLayer` stripped-key fallback.
2. `speech-normalization.ts` — `"reference"` rule literal, per-locale
   reference patterns (en: figure(s)/fig(s)/section(s)/sec(s); pt-BR:
   figura(s)/fig(s)/se[çc]ção~es variants/sec(s)), composite
   per-group `integerWords` verbalization, pre-pass with exact digit-range
   replacement and main-pass overlap skip.
3. Tests co-located in the two existing test files (12 inline pairs + the
   no-pathology guards).
4. Local gates green → PR queued for the merge shepherd.

## Risks

- Compound splits ("well-known") collapse without a dictionary — documented
  and tested as accepted behavior of the spec'd rule.
- Leading-zero ref groups ("3-01") verbalize as "three one" — documented
  limitation; extend later if a real PDF demands it.
- Span fallback could mis-anchor a divergent hyphen-terminated span at a
  later identical prefix — same risk class the exact-key matcher already
  accepts; monotonic `searchStart` keeps it ordered.
