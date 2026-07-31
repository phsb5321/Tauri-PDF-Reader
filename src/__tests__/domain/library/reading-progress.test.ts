import { describe, it, expect } from "vitest";
import {
  CONTINUE_READING_LIMIT,
  continueReading,
  progressPercent,
  readingState,
  type ProgressSnapshot,
} from "../../../domain/library/reading-progress";

const doc = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
  currentPage: 1,
  pageCount: 100,
  lastOpenedAt: null,
  ...over,
});

describe("progressPercent", () => {
  it("is the page ratio, rounded", () => {
    expect(progressPercent(doc({ currentPage: 25 }))).toBe(25);
    expect(progressPercent(doc({ currentPage: 1, pageCount: 3 }))).toBe(33);
  });

  it("is zero when the page count is unknown", () => {
    expect(progressPercent(doc({ currentPage: 40, pageCount: null }))).toBe(0);
    expect(progressPercent(doc({ currentPage: 40, pageCount: 0 }))).toBe(0);
  });

  it("never exceeds 100, even past the last page", () => {
    expect(progressPercent(doc({ currentPage: 120, pageCount: 100 }))).toBe(
      100,
    );
  });
});

describe("readingState", () => {
  it("calls page 1 unread — every document opens there", () => {
    expect(readingState(doc({ currentPage: 1 }))).toBe("unread");
  });

  it("calls a document with no page count and no turns unread", () => {
    expect(readingState(doc({ currentPage: 1, pageCount: null }))).toBe(
      "unread",
    );
  });

  it("calls anything past page 1 reading", () => {
    expect(readingState(doc({ currentPage: 2 }))).toBe("reading");
  });

  it("counts a turned page as reading even without a page count", () => {
    expect(readingState(doc({ currentPage: 12, pageCount: null }))).toBe(
      "reading",
    );
  });

  it("calls the last page finished", () => {
    expect(readingState(doc({ currentPage: 100, pageCount: 100 }))).toBe(
      "finished",
    );
  });

  it("treats a one-page document as finished once opened", () => {
    expect(readingState(doc({ currentPage: 1, pageCount: 1 }))).toBe(
      "finished",
    );
  });
});

describe("continueReading", () => {
  it("keeps only what is in flight", () => {
    const reading = doc({ currentPage: 50, lastOpenedAt: "2026-07-30" });

    const result = continueReading([
      doc({ currentPage: 1 }),
      reading,
      doc({ currentPage: 100, pageCount: 100 }),
    ]);

    expect(result).toEqual([reading]);
  });

  it("orders by most recently opened", () => {
    const older = doc({ currentPage: 10, lastOpenedAt: "2026-07-01" });
    const newer = doc({ currentPage: 10, lastOpenedAt: "2026-07-29" });

    expect(continueReading([older, newer])).toEqual([newer, older]);
  });

  it("keeps incoming order for ties and missing timestamps", () => {
    const first = doc({ currentPage: 10, lastOpenedAt: null });
    const second = doc({ currentPage: 20, lastOpenedAt: null });

    expect(continueReading([first, second])).toEqual([first, second]);
  });

  it("sorts documents with a timestamp ahead of those without", () => {
    const undated = doc({ currentPage: 10, lastOpenedAt: null });
    const dated = doc({ currentPage: 10, lastOpenedAt: "2026-01-01" });

    expect(continueReading([undated, dated])).toEqual([dated, undated]);
  });

  it("caps the shelf", () => {
    const many = Array.from({ length: CONTINUE_READING_LIMIT + 4 }, (_, i) =>
      doc({ currentPage: 10, lastOpenedAt: `2026-07-0${(i % 9) + 1}` }),
    );

    expect(continueReading(many)).toHaveLength(CONTINUE_READING_LIMIT);
    expect(continueReading(many, 2)).toHaveLength(2);
    expect(continueReading(many, 0)).toEqual([]);
  });

  it("does not mutate or reorder its input", () => {
    const input = [
      doc({ currentPage: 10, lastOpenedAt: "2026-07-01" }),
      doc({ currentPage: 10, lastOpenedAt: "2026-07-29" }),
    ];
    const snapshot = [...input];

    continueReading(input);

    expect(input).toEqual(snapshot);
  });

  it("returns nothing when everything is unread or finished", () => {
    expect(
      continueReading([doc({ currentPage: 1 }), doc({ currentPage: 100 })]),
    ).toEqual([]);
  });
});
