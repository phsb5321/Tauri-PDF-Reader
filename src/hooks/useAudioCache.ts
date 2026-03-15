/**
 * useAudioCache Hook (T049)
 *
 * Provides audio cache coverage fetching and real-time event subscription.
 * Automatically fetches coverage when documentId changes and subscribes
 * to coverage-updated events for real-time UI updates.
 */

import { useEffect, useCallback, useState } from "react";
import { useAiTtsStore } from "../stores/ai-tts-store";
import {
  audioCacheGetCoverage,
  onCoverageUpdated,
  type CoverageResponse,
  type CoverageUpdatedEvent,
} from "../lib/api/audio-cache";

export interface UseAudioCacheOptions {
  /** Auto-fetch coverage on mount and documentId change */
  autoFetch?: boolean;
}

export interface UseAudioCacheResult {
  /** Current coverage data from store */
  coverage: CoverageResponse | null;
  /** Coverage percentage (0-100) */
  coveragePercent: number;
  /** Whether initial fetch is in progress */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refresh coverage data */
  refresh: () => Promise<void>;
  /** Clear coverage from store */
  clear: () => void;
}

/**
 * Hook for accessing and managing audio cache coverage data.
 *
 * @param documentId - The document to fetch coverage for
 * @param options - Configuration options
 * @returns Coverage data and control functions
 */
export function useAudioCache(
  documentId: string | null,
  options: UseAudioCacheOptions = {},
): UseAudioCacheResult {
  const { autoFetch = true } = options;

  const coverage = useAiTtsStore((s) => s.cacheCoverage);
  const setCacheCoverage = useAiTtsStore((s) => s.setCacheCoverage);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch coverage from backend
  const fetchCoverage = useCallback(async () => {
    if (!documentId) {
      setCacheCoverage(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await audioCacheGetCoverage(documentId);
      setCacheCoverage(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch coverage";
      setError(message);
      console.error("[useAudioCache] Failed to fetch coverage:", err);
    } finally {
      setIsLoading(false);
    }
  }, [documentId, setCacheCoverage]);

  // Clear coverage from store
  const clear = useCallback(() => {
    setCacheCoverage(null);
  }, [setCacheCoverage]);

  // Auto-fetch on mount and documentId change
  useEffect(() => {
    if (autoFetch && documentId) {
      fetchCoverage();
    } else if (!documentId) {
      clear();
    }
  }, [documentId, autoFetch, fetchCoverage, clear]);

  // Subscribe to coverage-updated events for real-time updates
  useEffect(() => {
    if (!documentId) return;

    let unsubscribe: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unsubscribe = await onCoverageUpdated((event: CoverageUpdatedEvent) => {
          // Only update if event is for our document
          if (event.documentId === documentId) {
            // Create a partial coverage update
            const updatedCoverage: CoverageResponse = {
              documentId: event.documentId,
              totalChunks: event.totalChunks,
              cachedChunks: event.cachedChunks,
              coveragePercent: event.coveragePercent,
              // These are not in the event, preserve existing or default
              totalDurationMs: coverage?.totalDurationMs ?? 0,
              cachedSizeBytes: coverage?.cachedSizeBytes ?? 0,
            };
            setCacheCoverage(updatedCoverage);
          }
        });
      } catch (err) {
        console.error(
          "[useAudioCache] Failed to subscribe to coverage events:",
          err,
        );
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [
    documentId,
    coverage?.totalDurationMs,
    coverage?.cachedSizeBytes,
    setCacheCoverage,
  ]);

  // Calculate coverage percent (handle null coverage)
  const coveragePercent = coverage?.coveragePercent ?? 0;

  return {
    coverage,
    coveragePercent,
    isLoading,
    error,
    refresh: fetchCoverage,
    clear,
  };
}
