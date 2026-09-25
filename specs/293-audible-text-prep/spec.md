# Spec 293 — audible text-prep groundwork (de-hyphenation + reference verbalization)

## User Scenarios & Testing

**US1 — Hyphen-broken words read as one word.** When PDF extraction splits a
word at a line end ("dese-" + "jo continua"), narration speaks "desejo"
instead of two fragments. The normalized page string joins the fragments
without the hyphen or an interstitial space; segment offsets stay exactly
consistent with the new string (slice(text, start, end) === segment.text);
the joined word carries no prosodic boundary. Known limitation (documented,
tested): dictionary-free de-hyphenation also collapses compound splits
("well-" + "known" → "wellknown"); uppercase continuations and
paragraph/section gaps are never joined.

**US2 — Figure/section references speak as words.** "See Figure 3-1" reads
"see Figure three one" (EN); "Figura 2-4" reads "Figura dois quatro",
"Seção 10-2" reads "Seção dez dois" (pt-BR). The reference prefix word
passes through untouched (it is pronounceable as-is); the hyphenated digit
composite is replaced by per-group integer words over an exact source range,
"range-preserving like the existing number grammar". Ambiguous bare
composites ("range 2026-09-15", "config 3-1", "Figure 3-1a") are never
touched; dotted refs ("Figure 3.1") keep the existing decimal behavior.

**US3 — Zero added latency (MANDATE 23/09).** Both wins are pure synchronous
string transforms inside code paths that already run before the TTS request:
no new awaits, no I/O, no new state, no change to narration-start sequencing.
Latest-wins/OPEN_BUSY belong to 294-open-instant (untouched here). A measured
pathology guard (50k-char page, wall clock bound) proves no pathological
regex behavior; it is a guard, not a speed claim.

**Testing (existing vitest style, co-located):** `src/lib/pdf-text.test.ts`
gains soft-join cases (join/no-join/boundary suppression/offset consistency/
paragraph refusal/annotate companion/compound edge) and one measured
no-pathology guard; `src/lib/speech-normalization.test.ts` gains EN + pt-BR
reference cases (positive, multi-ref, multi-hyphen, case/abbrev forms,
negative identifier/range/letter-suffix cases, exact range preservation).
The dead t2M corpus dependency is satisfied by these inline pair fixtures
(12 pairs across both wins); the full t2M corpus remains out of scope here.

## Technical Context

Branch `293-audible-text-prep` (worktree `tauri-pdf-reader-293-audible-text-prep`,
base `adf01e2c`). Owned product files: `src/lib/pdf-text.ts`
(`buildPdfText` join at the bare-space site + the matching-side companion in
`annotatePdfTextLayer`), `src/lib/speech-normalization.ts` (new `"reference"`
rule literal + reference pre-pass in `findSpeechNumberReplacements`).
`.rule` has no consumers outside the grammar (verified), so the union
extension is safe. The one-space normalized model's offset contract is
preserved: de-hyphenation adjusts the previous segment's `end`/`text`
together so slice equality holds; span annotation falls back to the
hyphen-stripped key only when the exact key cannot match (existing
divergent-span behavior untouched). VM103 CI is down — local gates
(`pnpm lint`, `pnpm typecheck`, `pnpm test`) are the acceptance bar before
the PR (queue behind the merge shepherd; never claim green not run).
