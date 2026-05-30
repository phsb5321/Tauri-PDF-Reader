/**
 * Unit tests for the audio-cache coverage domain helpers (spec 006).
 *
 * Pure functions (no IO): percentage rounding, full-cache predicate, and the
 * human-readable coverage / duration / bytes formatters. Previously 0% covered.
 */
import { describe, it, expect } from "vitest";
import {
  emptyCoverageStats,
  calculateCoveragePercent,
  isFullyCached,
  formatCoverage,
  formatDuration,
  formatBytes,
  type CoverageStats,
} from "../../domain/cache/coverage";

const stats = (over: Partial<CoverageStats>): CoverageStats => ({
  documentId: "doc",
  totalChunks: 0,
  cachedChunks: 0,
  coveragePercent: 0,
  totalDurationMs: 0,
  cachedSizeBytes: 0,
  lastUpdated: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("cache coverage domain", () => {
  describe("calculateCoveragePercent", () => {
    it("returns 0 when total is 0 (no divide-by-zero)", () => {
      expect(calculateCoveragePercent(0, 0)).toBe(0);
      expect(calculateCoveragePercent(5, 0)).toBe(0);
    });
    it("computes and rounds the percentage", () => {
      expect(calculateCoveragePercent(0, 10)).toBe(0);
      expect(calculateCoveragePercent(5, 10)).toBe(50);
      expect(calculateCoveragePercent(10, 10)).toBe(100);
      expect(calculateCoveragePercent(1, 3)).toBe(33); // 33.33 -> 33
      expect(calculateCoveragePercent(2, 3)).toBe(67); // 66.67 -> 67
    });
  });

  describe("isFullyCached", () => {
    it("is true only when all chunks are cached and there is at least one", () => {
      expect(isFullyCached(stats({ cachedChunks: 10, totalChunks: 10 }))).toBe(
        true,
      );
    });
    it("is false when partially cached", () => {
      expect(isFullyCached(stats({ cachedChunks: 5, totalChunks: 10 }))).toBe(
        false,
      );
    });
    it("is false for an empty document (0 of 0)", () => {
      expect(isFullyCached(stats({ cachedChunks: 0, totalChunks: 0 }))).toBe(
        false,
      );
    });
  });

  describe("formatCoverage", () => {
    it("reports no audio when there are no chunks", () => {
      expect(formatCoverage(stats({ totalChunks: 0 }))).toBe("No audio cached");
    });
    it("reports percent and chunk counts", () => {
      expect(
        formatCoverage(
          stats({ coveragePercent: 50, cachedChunks: 5, totalChunks: 10 }),
        ),
      ).toBe("50% cached (5/10 chunks)");
    });
  });

  describe("formatDuration", () => {
    it("formats sub-second as ms", () => {
      expect(formatDuration(0)).toBe("0ms");
      expect(formatDuration(999)).toBe("999ms");
    });
    it("formats seconds", () => {
      expect(formatDuration(1000)).toBe("1s");
      expect(formatDuration(5000)).toBe("5s");
    });
    it("formats minutes and seconds", () => {
      expect(formatDuration(65000)).toBe("1m 5s");
      expect(formatDuration(60000)).toBe("1m 0s"); // exact-minute boundary
    });
    it("formats hours and minutes", () => {
      expect(formatDuration(3600000)).toBe("1h 0m");
      expect(formatDuration(3900000)).toBe("1h 5m");
    });
  });

  describe("formatBytes", () => {
    it("formats zero", () => {
      expect(formatBytes(0)).toBe("0 B");
    });
    it("formats each unit with one-decimal rounding", () => {
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
      expect(formatBytes(1048576)).toBe("1 MB");
      expect(formatBytes(1073741824)).toBe("1 GB");
      expect(formatBytes(1649267441664)).toBe("1.5 TB"); // 1.5 * 1024^4 (off-boundary)
    });
  });

  describe("emptyCoverageStats", () => {
    it("zeroes every count and stamps the document id + an ISO timestamp", () => {
      const s = emptyCoverageStats("doc-42");
      expect(s.documentId).toBe("doc-42");
      expect(s.totalChunks).toBe(0);
      expect(s.cachedChunks).toBe(0);
      expect(s.coveragePercent).toBe(0);
      expect(s.totalDurationMs).toBe(0);
      expect(s.cachedSizeBytes).toBe(0);
      expect(typeof s.lastUpdated).toBe("string");
      expect(Number.isNaN(Date.parse(s.lastUpdated))).toBe(false);
    });
  });
});
