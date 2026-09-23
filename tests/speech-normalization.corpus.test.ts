/**
 * Spoken-form corpus tests (spec 295 skeleton — test-only slice).
 *
 * Table-driven units prove the `shipped` pairs of `tests/spoken-form-corpus.ts`
 * against `findSpeechNumberReplacements`; pending pairs encode their targets as
 * `it.todo` so future slices flip them into real assertions. The property suite
 * pins the contract the highlight/cache story depends on: determinism, ordered
 * in-bounds ranges, digit-free spoken output, and idempotence over spliced text.
 *
 * Seeded fuzz follows `src/hooks/useTtsProviderRouting.property.test.ts`:
 * FC_SEED / FC_NUM_RUNS / FC_PATH override the defaults for replays.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { findSpeechNumberReplacements } from "../src/lib/speech-normalization";
import {
  PENDING_PAIRS,
  SHIPPED_PAIRS,
  type CorpusLocale,
  type SpokenFormPair,
} from "./spoken-form-corpus";

const seed = Number(process.env.FC_SEED ?? 20260923);
const numRuns = Number(process.env.FC_NUM_RUNS ?? 300);

describe("spoken-form corpus — shipped pairs", () => {
  it.each(SHIPPED_PAIRS)(
    '$id ($klass, $locale): "$input" → "$target"',
    (pair: SpokenFormPair) => {
      const replacements = findSpeechNumberReplacements(
        pair.input,
        pair.locale,
      );

      if (pair.target === pair.input) {
        // Deliberate refusal: the grammar leaves the token untouched.
        expect(replacements, `${pair.id} must stay blocked`).toHaveLength(0);
        return;
      }

      expect(replacements, `${pair.id} must fire exactly once`).toHaveLength(1);
      const [replacement] = replacements;
      expect(replacement.spokenText).toBe(pair.target);
      expect([replacement.sourceStart, replacement.sourceEnd]).toEqual([
        0,
        pair.input.length,
      ]);
    },
  );

  it("shipped targets stay in their locale's vocabulary", () => {
    for (const pair of SHIPPED_PAIRS) {
      if (pair.target === pair.input) continue;
      if (pair.locale === "en") {
        expect(pair.target, pair.id).not.toMatch(/vírgula|reais|centavos/u);
      } else {
        expect(pair.target, pair.id).not.toMatch(/\bpoint\b|\bdollars\b/u);
      }
    }
  });
});

describe("spoken-form corpus — pending pairs (future slices)", () => {
  for (const pair of PENDING_PAIRS) {
    const alt = pair.alternativeTarget
      ? ` [alt: ${pair.alternativeTarget}]`
      : "";
    it.todo(
      `${pair.id} (${pair.status}, ${pair.stage}): "${pair.input}" → "${pair.target}"${alt}`,
    );
  }
});

describe("speech normalization contract (seeded fast-check)", () => {
  const sourceArbitrary = fc.string({ maxLength: 120 });
  const localeArbitrary = fc.constantFrom<CorpusLocale>("en", "pt-BR");
  const runOptions = {
    seed,
    numRuns,
    path: process.env.FC_PATH,
    endOnFailure: true,
  };

  function splice(
    source: string,
    replacements: ReturnType<typeof findSpeechNumberReplacements>,
  ) {
    let spliced = source;
    for (const replacement of [...replacements].reverse()) {
      spliced =
        spliced.slice(0, replacement.sourceStart) +
        replacement.spokenText +
        spliced.slice(replacement.sourceEnd);
    }
    return spliced;
  }

  it("is deterministic and emits ordered, in-bounds, digit-free ranges", () => {
    fc.assert(
      fc.property(sourceArbitrary, localeArbitrary, (source, locale) => {
        const first = findSpeechNumberReplacements(source, locale);
        expect(findSpeechNumberReplacements(source, locale)).toEqual(first);

        let cursor = 0;
        for (const replacement of first) {
          expect(replacement.sourceStart).toBeGreaterThanOrEqual(cursor);
          expect(replacement.sourceEnd).toBeGreaterThan(
            replacement.sourceStart,
          );
          expect(replacement.sourceEnd).toBeLessThanOrEqual(source.length);
          cursor = replacement.sourceEnd;
          // The spoken form is words — karaoke projection must never see digits.
          expect(/\d/u.test(replacement.spokenText)).toBe(false);
        }
      }),
      runOptions,
    );
  });

  it("is idempotent: normalized text produces no further replacements", () => {
    fc.assert(
      fc.property(sourceArbitrary, localeArbitrary, (source, locale) => {
        const replacements = findSpeechNumberReplacements(source, locale);
        const spliced = splice(source, replacements);
        expect(findSpeechNumberReplacements(spliced, locale)).toEqual([]);
      }),
      runOptions,
    );
  });
});
