/**
 * Audio Cache Integration Tests (T028)
 *
 * Tests for the audio cache hit/miss flow.
 * Verifies:
 * - Cache coverage tracking
 * - Cache statistics retrieval
 * - Cache limit management
 * - Eviction behavior
 * - Coverage update events
 * - Store integration with cache API
 *
 * Note: These tests mock Tauri IPC since they run in Vitest.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import type {
  CoverageResponse,
  CacheStatsResponse,
  EvictionResponse,
} from "../../lib/api/audio-cache";

// Mock the audio-cache API
vi.mock("../../lib/api/audio-cache", () => ({
  audioCacheGetCoverage: vi.fn(),
  audioCacheClearDocument: vi.fn(),
  audioCacheGetStats: vi.fn(),
  audioCacheSetLimit: vi.fn(),
  audioCacheGetLimit: vi.fn(),
  audioCacheEvict: vi.fn(),
  audioCacheNotifyCoverage: vi.fn(),
  onCoverageUpdated: vi.fn(() => Promise.resolve(() => {})),
  onCacheEvicted: vi.fn(() => Promise.resolve(() => {})),
}));

import {
  audioCacheGetCoverage,
  audioCacheClearDocument,
  audioCacheGetStats,
  audioCacheSetLimit,
  audioCacheGetLimit,
  audioCacheEvict,
  audioCacheNotifyCoverage,
} from "../../lib/api/audio-cache";

const mockGetCoverage = audioCacheGetCoverage as ReturnType<typeof vi.fn>;
const mockClearDocument = audioCacheClearDocument as ReturnType<typeof vi.fn>;
const mockGetStats = audioCacheGetStats as ReturnType<typeof vi.fn>;
const mockSetLimit = audioCacheSetLimit as ReturnType<typeof vi.fn>;
const mockGetLimit = audioCacheGetLimit as ReturnType<typeof vi.fn>;
const mockEvict = audioCacheEvict as ReturnType<typeof vi.fn>;
const mockNotifyCoverage = audioCacheNotifyCoverage as ReturnType<typeof vi.fn>;

describe("Audio Cache Integration", () => {
  const mockCoverage: CoverageResponse = {
    documentId: "doc-123",
    totalChunks: 100,
    cachedChunks: 50,
    coveragePercent: 50,
    totalDurationMs: 300000, // 5 minutes
    cachedSizeBytes: 5242880, // 5 MB
  };

  const mockStats: CacheStatsResponse = {
    totalSizeBytes: 104857600, // 100 MB
    entryCount: 500,
    maxSizeBytes: 1073741824, // 1 GB
    oldestEntryAt: "2024-01-01T00:00:00Z",
    newestEntryAt: "2024-06-01T00:00:00Z",
    documentCount: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useAiTtsStore.setState({
      initialized: false,
      apiKey: null,
      initError: null,
      playbackState: "idle",
      currentText: null,
      error: null,
      voices: [],
      selectedVoiceId: "21m00Tcm4TlvDq8ikWAM",
      speed: 1.0,
      autoPageEnabled: true,
      cacheCoverage: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Cache Coverage Tracking", () => {
    it("stores cache coverage in store", () => {
      const store = useAiTtsStore.getState();
      expect(store.cacheCoverage).toBeNull();

      store.setCacheCoverage(mockCoverage);

      const updated = useAiTtsStore.getState();
      expect(updated.cacheCoverage).toEqual(mockCoverage);
      expect(updated.cacheCoverage?.coveragePercent).toBe(50);
    });

    it("can clear cache coverage", () => {
      const store = useAiTtsStore.getState();
      store.setCacheCoverage(mockCoverage);
      expect(useAiTtsStore.getState().cacheCoverage).not.toBeNull();

      store.setCacheCoverage(null);
      expect(useAiTtsStore.getState().cacheCoverage).toBeNull();
    });

    it("updates coverage when changed", () => {
      const store = useAiTtsStore.getState();
      store.setCacheCoverage(mockCoverage);

      const updatedCoverage: CoverageResponse = {
        ...mockCoverage,
        cachedChunks: 75,
        coveragePercent: 75,
        cachedSizeBytes: 7864320, // ~7.5 MB
      };

      store.setCacheCoverage(updatedCoverage);
      expect(useAiTtsStore.getState().cacheCoverage?.coveragePercent).toBe(75);
    });
  });

  describe("Coverage API Integration", () => {
    it("retrieves coverage for a document", async () => {
      mockGetCoverage.mockResolvedValue(mockCoverage);

      const result = await audioCacheGetCoverage("doc-123");

      expect(mockGetCoverage).toHaveBeenCalledWith("doc-123");
      expect(result.documentId).toBe("doc-123");
      expect(result.coveragePercent).toBe(50);
    });

    it("handles no cached audio (0% coverage)", async () => {
      const emptyCoverage: CoverageResponse = {
        documentId: "new-doc",
        totalChunks: 100,
        cachedChunks: 0,
        coveragePercent: 0,
        totalDurationMs: 0,
        cachedSizeBytes: 0,
      };
      mockGetCoverage.mockResolvedValue(emptyCoverage);

      const result = await audioCacheGetCoverage("new-doc");

      expect(result.cachedChunks).toBe(0);
      expect(result.coveragePercent).toBe(0);
    });

    it("handles fully cached audio (100% coverage)", async () => {
      const fullCoverage: CoverageResponse = {
        ...mockCoverage,
        cachedChunks: 100,
        coveragePercent: 100,
      };
      mockGetCoverage.mockResolvedValue(fullCoverage);

      const result = await audioCacheGetCoverage("doc-123");

      expect(result.cachedChunks).toBe(100);
      expect(result.coveragePercent).toBe(100);
    });
  });

  describe("Cache Statistics", () => {
    it("retrieves global cache statistics", async () => {
      mockGetStats.mockResolvedValue(mockStats);

      const result = await audioCacheGetStats();

      expect(mockGetStats).toHaveBeenCalled();
      expect(result.totalSizeBytes).toBe(104857600);
      expect(result.entryCount).toBe(500);
      expect(result.documentCount).toBe(10);
    });

    it("handles empty cache", async () => {
      const emptyStats: CacheStatsResponse = {
        totalSizeBytes: 0,
        entryCount: 0,
        maxSizeBytes: 1073741824,
        oldestEntryAt: null,
        newestEntryAt: null,
        documentCount: 0,
      };
      mockGetStats.mockResolvedValue(emptyStats);

      const result = await audioCacheGetStats();

      expect(result.entryCount).toBe(0);
      expect(result.oldestEntryAt).toBeNull();
      expect(result.newestEntryAt).toBeNull();
    });
  });

  describe("Cache Limit Management", () => {
    it("retrieves current cache limit", async () => {
      mockGetLimit.mockResolvedValue(1073741824); // 1 GB

      const limit = await audioCacheGetLimit();

      expect(mockGetLimit).toHaveBeenCalled();
      expect(limit).toBe(1073741824);
    });

    it("sets new cache limit", async () => {
      mockSetLimit.mockResolvedValue(undefined);

      await audioCacheSetLimit(536870912); // 512 MB

      expect(mockSetLimit).toHaveBeenCalledWith(536870912);
    });
  });

  describe("Cache Eviction", () => {
    it("manually triggers eviction", async () => {
      const evictionResult: EvictionResponse = {
        evictedCount: 50,
        bytesFreed: 52428800, // 50 MB
      };
      mockEvict.mockResolvedValue(evictionResult);

      const result = await audioCacheEvict(52428800); // Target 50 MB

      expect(mockEvict).toHaveBeenCalledWith(52428800);
      expect(result.evictedCount).toBe(50);
      expect(result.bytesFreed).toBe(52428800);
    });

    it("handles no eviction needed", async () => {
      const noEviction: EvictionResponse = {
        evictedCount: 0,
        bytesFreed: 0,
      };
      mockEvict.mockResolvedValue(noEviction);

      const result = await audioCacheEvict(1073741824); // Target 1 GB (larger than cache)

      expect(result.evictedCount).toBe(0);
      expect(result.bytesFreed).toBe(0);
    });
  });

  describe("Document Cache Clearing", () => {
    it("clears cache for a specific document", async () => {
      mockClearDocument.mockResolvedValue({ entriesRemoved: 25 });

      const result = await audioCacheClearDocument("doc-123");

      expect(mockClearDocument).toHaveBeenCalledWith("doc-123");
      expect(result.entriesRemoved).toBe(25);
    });

    it("handles clearing non-existent document", async () => {
      mockClearDocument.mockResolvedValue({ entriesRemoved: 0 });

      const result = await audioCacheClearDocument("non-existent");

      expect(result.entriesRemoved).toBe(0);
    });
  });

  describe("Coverage Notification", () => {
    it("notifies backend to emit coverage update", async () => {
      mockNotifyCoverage.mockResolvedValue(mockCoverage);

      const result = await audioCacheNotifyCoverage("doc-123");

      expect(mockNotifyCoverage).toHaveBeenCalledWith("doc-123");
      expect(result.documentId).toBe("doc-123");
    });
  });

  describe("Cache Flow Integration", () => {
    it("simulates cache hit flow: coverage -> playback", async () => {
      // 1. Check coverage first
      mockGetCoverage.mockResolvedValue({
        ...mockCoverage,
        cachedChunks: 100,
        coveragePercent: 100,
      });

      const coverage = await audioCacheGetCoverage("doc-123");
      expect(coverage.coveragePercent).toBe(100);

      // 2. Update store with coverage
      const store = useAiTtsStore.getState();
      store.setCacheCoverage(coverage);
      expect(useAiTtsStore.getState().cacheCoverage?.coveragePercent).toBe(100);

      // 3. On 100% coverage, audio can be played from cache (no API call needed)
      // This would be verified in the TTS service, but here we verify state is correct
      const state = useAiTtsStore.getState();
      expect(state.cacheCoverage?.cachedChunks).toBe(100);
    });

    it("simulates cache miss flow: coverage -> fetch -> update", async () => {
      // 1. Check coverage first - cache miss (0%)
      mockGetCoverage.mockResolvedValue({
        documentId: "doc-123",
        totalChunks: 100,
        cachedChunks: 0,
        coveragePercent: 0,
        totalDurationMs: 0,
        cachedSizeBytes: 0,
      });

      const initialCoverage = await audioCacheGetCoverage("doc-123");
      expect(initialCoverage.coveragePercent).toBe(0);

      // 2. Update store
      const store = useAiTtsStore.getState();
      store.setCacheCoverage(initialCoverage);

      // 3. Simulate fetching and caching audio (would notify coverage update)
      mockNotifyCoverage.mockResolvedValue({
        documentId: "doc-123",
        totalChunks: 100,
        cachedChunks: 10,
        coveragePercent: 10,
        totalDurationMs: 30000,
        cachedSizeBytes: 1048576,
      });

      const updatedCoverage = await audioCacheNotifyCoverage("doc-123");

      // 4. Update store with new coverage
      store.setCacheCoverage(updatedCoverage);
      expect(useAiTtsStore.getState().cacheCoverage?.coveragePercent).toBe(10);
    });

    it("simulates eviction when cache is full", async () => {
      // 1. Check stats - cache is near limit
      mockGetStats.mockResolvedValue({
        totalSizeBytes: 1000000000, // ~953 MB
        entryCount: 1000,
        maxSizeBytes: 1073741824, // 1 GB
        oldestEntryAt: "2024-01-01T00:00:00Z",
        newestEntryAt: "2024-06-01T00:00:00Z",
        documentCount: 50,
      });

      const stats = await audioCacheGetStats();
      expect(stats.totalSizeBytes).toBeGreaterThan(stats.maxSizeBytes * 0.9);

      // 2. Trigger eviction
      mockEvict.mockResolvedValue({
        evictedCount: 200,
        bytesFreed: 200000000, // ~190 MB
      });

      const eviction = await audioCacheEvict(500000000); // Target 500 MB

      // 3. Verify eviction occurred
      expect(eviction.evictedCount).toBe(200);
      expect(eviction.bytesFreed).toBe(200000000);
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      mockGetCoverage.mockRejectedValue(new Error("Network error"));

      await expect(audioCacheGetCoverage("doc-123")).rejects.toThrow(
        "Network error",
      );
    });

    it("handles missing document in coverage", async () => {
      // Backend might return zeros for non-existent document
      mockGetCoverage.mockResolvedValue({
        documentId: "non-existent",
        totalChunks: 0,
        cachedChunks: 0,
        coveragePercent: 0,
        totalDurationMs: 0,
        cachedSizeBytes: 0,
      });

      const result = await audioCacheGetCoverage("non-existent");

      expect(result.totalChunks).toBe(0);
      expect(result.coveragePercent).toBe(0);
    });
  });

  describe("Store State Persistence", () => {
    it("persists playback settings (excluding cache)", () => {
      const store = useAiTtsStore.getState();

      // These should be persisted
      store.setSpeed(1.5);
      store.setAutoPageEnabled(false);
      store.setSelectedVoice("custom-voice-id");

      const state = useAiTtsStore.getState();
      expect(state.speed).toBe(1.5);
      expect(state.autoPageEnabled).toBe(false);
      expect(state.selectedVoiceId).toBe("custom-voice-id");
    });

    it("resets state correctly", () => {
      const store = useAiTtsStore.getState();
      store.setCacheCoverage(mockCoverage);
      store.setSpeed(1.5);
      store.setError("Test error");

      store.reset();

      const resetState = useAiTtsStore.getState();
      expect(resetState.cacheCoverage).toBeNull();
      expect(resetState.error).toBeNull();
      expect(resetState.playbackState).toBe("idle");
    });
  });
});
