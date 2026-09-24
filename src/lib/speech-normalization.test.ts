import { describe, expect, it } from "vitest";
import {
  findSpeechNumberReplacements,
  type SpeechNumberLocale,
} from "./speech-normalization";

function spoken(source: string, locale: SpeechNumberLocale): string {
  const edits = findSpeechNumberReplacements(source, locale);
  let result = "";
  let cursor = 0;
  for (const edit of edits) {
    result += source.slice(cursor, edit.sourceStart) + edit.spokenText;
    cursor = edit.sourceEnd;
  }
  return result + source.slice(cursor);
}

describe("source-aligned speech number normalization", () => {
  it("speaks the reported English year and grouped result count", () => {
    const source =
      "In early 2022, the search returned over 91,000 unique results.";
    expect(spoken(source, "en")).toBe(
      "In early two thousand twenty-two, the search returned over ninety-one thousand unique results.",
    );
    expect(findSpeechNumberReplacements(source, "en")).toEqual([
      {
        sourceStart: 9,
        sourceEnd: 13,
        spokenText: "two thousand twenty-two",
        rule: "integer",
      },
      {
        sourceStart: 40,
        sourceEnd: 46,
        spokenText: "ninety-one thousand",
        rule: "integer",
      },
    ]);
  });

  it("normalizes canonical English decimals, percent, USD/EUR, and time", () => {
    expect(
      spoken("Revenue rose 12.5% to $1,234.50 at 16:16; €20 remained.", "en"),
    ).toBe(
      "Revenue rose twelve point five percent to one thousand two hundred thirty-four dollars and fifty cents at sixteen sixteen; twenty euros remained.",
    );
  });

  it("normalizes canonical pt-BR grouping, decimals, percent, BRL, and time", () => {
    expect(
      spoken(
        "Em 2022, foram 91.000 resultados; subiu 12,5% para R$ 1.234,50 às 16:16.",
        "pt-BR",
      ),
    ).toBe(
      "Em dois mil e vinte e dois, foram noventa e um mil resultados; subiu doze vírgula cinco por cento para mil duzentos e trinta e quatro reais e cinquenta centavos às dezesseis horas e dezesseis minutos.",
    );
  });

  it("leaves ambiguous or identifier-like forms unchanged", () => {
    const source =
      "Versions 2.4.1 and 192.168.0.1, IDs 007 and 1234567890, bad 12,34,567.";
    expect(spoken(source, "en")).toBe(source);
    expect(findSpeechNumberReplacements(source, "en")).toEqual([]);
  });

  it("does not consume letters around a number or the wrong locale grouping", () => {
    expect(spoken("A2022 B 1.234,50 C", "en")).toBe("A2022 B 1.234,50 C");
    expect(spoken("A2022 B 1,234.50 C", "pt-BR")).toBe("A2022 B 1,234.50 C");
  });

  it("emits ordered non-overlapping UTF-16 source ranges", () => {
    const source = "😀 2022 and $20";
    const edits = findSpeechNumberReplacements(source, "en");
    expect(
      edits.map((edit) => source.slice(edit.sourceStart, edit.sourceEnd)),
    ).toEqual(["2022", "$20"]);
    expect(edits[0]?.sourceStart).toBe(3);
    for (let index = 1; index < edits.length; index += 1) {
      expect(edits[index - 1].sourceEnd).toBeLessThanOrEqual(
        edits[index].sourceStart,
      );
    }
  });
});

describe("figure/section reference verbalization (spec 293)", () => {
  it("speaks English hyphenated reference composites as integer groups", () => {
    expect(spoken("See Figure 3-1 for details.", "en")).toBe(
      "See Figure three one for details.",
    );
    expect(spoken("Section 12-3", "en")).toBe("Section twelve three");
    expect(spoken("FIGURE 3-1", "en")).toBe("FIGURE three one");
    expect(spoken("fig. 3-1", "en")).toBe("fig. three one");
  });

  it("speaks pt-BR references with Portuguese integer words", () => {
    expect(spoken("Figura 2-4", "pt-BR")).toBe("Figura dois quatro");
    expect(spoken("Seção 10-2", "pt-BR")).toBe("Seção dez dois");
    expect(spoken("seções 1-2 e seções 1-3", "pt-BR")).toBe(
      "seções um dois e seções um três",
    );
    // A bare composite without a reference word stays untouched.
    expect(spoken("seções 1-2 e 1-3", "pt-BR")).toBe("seções um dois e 1-3");
  });

  it("handles multiple references and multi-hyphen composites", () => {
    expect(spoken("Figure 3-1 and Figure 3-2", "en")).toBe(
      "Figure three one and Figure three two",
    );
    expect(spoken("Figure 3-1-2", "en")).toBe("Figure three one two");
  });

  it("preserves exact source ranges like the number grammar", () => {
    expect(findSpeechNumberReplacements("Figure 3-1", "en")).toEqual([
      {
        sourceStart: 7,
        sourceEnd: 10,
        spokenText: "three one",
        rule: "reference",
      },
    ]);
  });

  it("never touches bare composites, identifiers, letter suffixes, or dotted refs", () => {
    expect(spoken("range 2026-09-15 changed", "en")).toBe(
      "range 2026-09-15 changed",
    );
    expect(spoken("config 3-1 stays", "en")).toBe("config 3-1 stays");
    expect(spoken("Figure 3-1a", "en")).toBe("Figure 3-1a");
    expect(spoken("Figure 3.1", "en")).toBe("Figure three point one");
  });

  it("keeps reference-heavy pages fast (measured pathology guard, not a benchmark)", () => {
    const source = Array.from(
      { length: 2500 },
      (_, i) => `Figure ${i % 9}-${i % 5} and ${i} counts`,
    ).join(", ");
    const started = performance.now();
    const edits = findSpeechNumberReplacements(source, "en");
    const elapsedMs = performance.now() - started;
    expect(edits.length).toBeGreaterThan(2500);
    expect(elapsedMs).toBeLessThan(500);
  });
});
