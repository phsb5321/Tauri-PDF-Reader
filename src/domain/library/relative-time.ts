/**
 * Relative read time — "last read N days ago" from `Document.lastOpenedAt`.
 *
 * Pure and client-side: `lastOpenedAt` is already stored, so this is a
 * formatter over an existing field, not new persistence. Deliberately
 * literal day-count rather than week/month buckets even for a stale book —
 * "last read 60 days ago" stays exactly that, not "2 months ago" — per the
 * catch-up spec's explicit empty/near-empty-state table.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight of the given date's calendar day, in local time. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * @param lastOpenedAt ISO timestamp, or `null` if the document was never opened.
 * @param now Injectable clock for deterministic tests; defaults to `new Date()`.
 * @returns `null` when there is nothing to report (no timestamp, or an
 * unparseable one), so a caller can omit the clause entirely rather than
 * render a broken sentence.
 */
export function formatRelativeReadTime(
  lastOpenedAt: string | null,
  now: Date = new Date(),
): string | null {
  if (!lastOpenedAt) return null;

  const then = new Date(lastOpenedAt);
  if (Number.isNaN(then.getTime())) return null;

  // Calendar-day difference, not a raw 24h count, so "yesterday" matches what
  // the reader would call yesterday regardless of what time of day it is now.
  const diffDays = Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS);

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}
