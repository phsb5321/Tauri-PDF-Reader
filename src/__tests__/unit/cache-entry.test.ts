/**
 * Unit tests for the audio cache-entry domain helpers (spec 006). Pure logic
 * (age helpers stub Date.now for determinism), previously 0% covered.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  belongsToDocument,
  getCacheEntryAge,
  getTimeSinceAccess,
  isNearLimit,
  getCacheUsagePercent,
  type AudioCacheEntry,
  type CacheStats,
} from "../../domain/cache/cache-entry";

const entry = (over: Partial<AudioCacheEntry>): AudioCacheEntry => ({
  cacheKey: "k",
  documentId: "doc",
  pageNumber: 1,
  chunkIndex: 0,
  totalChunks: 1,
  textHash: "t",
  voiceId: "v",
  settingsHash: "s",
  filePath: "/f.mp3",
  sizeBytes: 0,
  durationMs: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastAccessedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const stats = (over: Partial<CacheStats>): CacheStats => ({
  totalSizeBytes: 0,
  entryCount: 0,
  maxSizeBytes: 0,
  documentCount: 0,
  ...over,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cache-entry domain", () => {
  it("belongsToDocument matches on documentId", () => {
    expect(belongsToDocument(entry({ documentId: "doc" }), "doc")).toBe(true);
    expect(belongsToDocument(entry({ documentId: "other" }), "doc")).toBe(
      false,
    );
    expect(belongsToDocument(entry({ documentId: null }), "doc")).toBe(false);
  });

  it("getCacheEntryAge is now minus createdAt", () => {
    const created = new Date("2026-01-01T00:00:00.000Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(created + 5000);
    expect(
      getCacheEntryAge(entry({ createdAt: "2026-01-01T00:00:00.000Z" })),
    ).toBe(5000);
  });

  it("getTimeSinceAccess is now minus lastAccessedAt", () => {
    const accessed = new Date("2026-01-01T00:00:00.000Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(accessed + 250);
    expect(
      getTimeSinceAccess(entry({ lastAccessedAt: "2026-01-01T00:00:00.000Z" })),
    ).toBe(250);
  });

  describe("isNearLimit", () => {
    it("is false when there is no max size", () => {
      expect(isNearLimit(stats({ totalSizeBytes: 100, maxSizeBytes: 0 }))).toBe(
        false,
      );
    });
    it("uses the 0.9 default threshold", () => {
      expect(
        isNearLimit(stats({ totalSizeBytes: 90, maxSizeBytes: 100 })),
      ).toBe(true);
      expect(
        isNearLimit(stats({ totalSizeBytes: 89, maxSizeBytes: 100 })),
      ).toBe(false);
    });
    it("honours a custom threshold", () => {
      expect(
        isNearLimit(stats({ totalSizeBytes: 50, maxSizeBytes: 100 }), 0.5),
      ).toBe(true);
      expect(
        isNearLimit(stats({ totalSizeBytes: 49, maxSizeBytes: 100 }), 0.5),
      ).toBe(false);
    });
  });

  describe("getCacheUsagePercent", () => {
    it("is 0 when there is no max size", () => {
      expect(
        getCacheUsagePercent(stats({ totalSizeBytes: 100, maxSizeBytes: 0 })),
      ).toBe(0);
    });
    it("rounds the usage percentage", () => {
      expect(
        getCacheUsagePercent(stats({ totalSizeBytes: 50, maxSizeBytes: 100 })),
      ).toBe(50);
      expect(
        getCacheUsagePercent(stats({ totalSizeBytes: 1, maxSizeBytes: 3 })),
      ).toBe(33);
    });
  });
});
