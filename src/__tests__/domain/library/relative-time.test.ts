import { describe, it, expect } from "vitest";
import { formatRelativeReadTime } from "../../../domain/library/relative-time";

const NOW = new Date("2026-08-07T12:00:00Z");

describe("formatRelativeReadTime", () => {
  it("is null when there is no timestamp", () => {
    expect(formatRelativeReadTime(null, NOW)).toBeNull();
  });

  it("is null for an unparseable timestamp", () => {
    expect(formatRelativeReadTime("not-a-date", NOW)).toBeNull();
  });

  it("says today for the same calendar day", () => {
    expect(formatRelativeReadTime("2026-08-07T09:00:00Z", NOW)).toBe("today");
  });

  it("says today for a timestamp that is technically in the future (clock skew)", () => {
    expect(formatRelativeReadTime("2026-08-08T12:00:00Z", NOW)).toBe("today");
  });

  it("says yesterday for the previous calendar day", () => {
    expect(formatRelativeReadTime("2026-08-06T09:00:00Z", NOW)).toBe(
      "yesterday",
    );
  });

  it("counts days for the rest of the week", () => {
    expect(formatRelativeReadTime("2026-08-04T12:00:00Z", NOW)).toBe(
      "3 days ago",
    );
  });

  it("keeps counting days at a week boundary rather than switching to weeks", () => {
    expect(formatRelativeReadTime("2026-07-31T12:00:00Z", NOW)).toBe(
      "7 days ago",
    );
  });

  it("keeps counting days at a month boundary rather than switching to months", () => {
    expect(formatRelativeReadTime("2026-07-08T12:00:00Z", NOW)).toBe(
      "30 days ago",
    );
  });

  it("keeps counting days for a very stale book", () => {
    expect(formatRelativeReadTime("2026-06-08T12:00:00Z", NOW)).toBe(
      "60 days ago",
    );
  });
});
