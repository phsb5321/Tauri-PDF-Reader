/**
 * Reading progress — where a document sits between untouched and finished.
 *
 * The library already stores `current_page` per document and `useAutoSave`
 * keeps it current while reading. What was missing is the reading of that
 * number: which books are in flight, and which have been put down and never
 * picked back up.
 *
 * Deliberately structural rather than typed against `Document`: the domain
 * layer may not import from `lib`, and every caller only needs these three
 * fields.
 */

/** The fields progress is derived from. */
export interface ProgressSnapshot {
  currentPage: number;
  pageCount: number | null;
  lastOpenedAt: string | null;
}

export type ReadingState =
  /** Never opened, or opened but never turned a page. */
  | "unread"
  /** Somewhere in the middle. */
  | "reading"
  /** On or past the last page. */
  | "finished";

/**
 * Percent of the document read, 0–100. Zero when the page count is unknown —
 * a document registered without one has no denominator to divide by.
 */
export function progressPercent(doc: ProgressSnapshot): number {
  if (!doc.pageCount || doc.pageCount <= 0) return 0;
  const ratio = doc.currentPage / doc.pageCount;
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

/**
 * Where the document sits. `finished` is checked first, so a single-page
 * document counts as finished rather than never-started once it is opened.
 */
export function readingState(doc: ProgressSnapshot): ReadingState {
  if (doc.pageCount && doc.pageCount > 0 && doc.currentPage >= doc.pageCount) {
    return "finished";
  }
  // Page 1 is where every document starts, so it is not evidence of reading.
  return doc.currentPage > 1 ? "reading" : "unread";
}

/** Default number of books on the shelf of things in flight. */
export const CONTINUE_READING_LIMIT = 6;

/**
 * Books actually in flight, most recently opened first.
 *
 * Ties and missing timestamps keep their incoming order, so a caller that
 * hands over an already-sorted list gets a stable result.
 */
export function continueReading<T extends ProgressSnapshot>(
  documents: readonly T[],
  limit: number = CONTINUE_READING_LIMIT,
): T[] {
  if (limit <= 0) return [];

  return documents
    .filter((d) => readingState(d) === "reading")
    .map((doc, index) => ({ doc, index }))
    .sort((a, b) => {
      const byRecency = (b.doc.lastOpenedAt ?? "").localeCompare(
        a.doc.lastOpenedAt ?? "",
      );
      return byRecency !== 0 ? byRecency : a.index - b.index;
    })
    .slice(0, limit)
    .map(({ doc }) => doc);
}
