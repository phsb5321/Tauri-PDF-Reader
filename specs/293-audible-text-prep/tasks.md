# Tasks 293 — audible text-prep groundwork (T293-N ids)

- [x] T293-1 `pdf-text.ts`: soft-hyphen join in `buildPdfText` (guard,
      hyphen drop, paired segment adjustment, boundary suppression).
- [x] T293-2 `pdf-text.ts`: `annotatePdfTextLayer` hyphen-stripped fallback
      key (exact-key behavior otherwise unchanged).
- [x] T293-3 `speech-normalization.ts`: `"reference"` rule + per-locale
      figure/section patterns + composite verbalization pre-pass.
- [x] T293-4 tests in `src/lib/pdf-text.test.ts` (join/no-join/compound
      edge/offset consistency/annotate companion/pathology guard).
- [x] T293-5 tests in `src/lib/speech-normalization.test.ts` (EN + pt-BR
      pairs, negatives, exact ranges, pathology guard).
- [x] T293-6 `pnpm lint && pnpm typecheck && pnpm test` all green (local
      gates replace the downed vm103 CI).
- [x] T293-7 commit + push branch + open PR queued for the merge shepherd
      (never to main directly) + wave-dir receipt with artefact hashes.

Unchecked boxes are completed with evidence at freeze time; no claim without
the actual gate logs (run-dir receipt embeds their tails).
