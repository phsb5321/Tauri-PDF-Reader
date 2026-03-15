/**
 * Audio Cache Repository Port
 *
 * Defines the contract for TTS audio cache persistence operations.
 */

import type { CacheStats, CoverageStats } from "../domain/cache";

/**
 * Response for clearing document cache
 */
export interface ClearDocumentResponse {
  success: boolean;
  entriesCleared: number;
  bytesFreed: number;
}

/**
 * Response for setting cache limit
 */
export interface SetLimitResponse {
  success: boolean;
  previousLimit: number;
  newLimit: number;
  evictedCount: number;
}

/**
 * Response for manual eviction
 */
export interface EvictResponse {
  success: boolean;
  evictedCount: number;
  bytesFreed: number;
}

/**
 * Repository interface for audio cache operations
 */
export interface AudioCacheRepository {
  /**
   * Get coverage statistics for a document
   */
  getCoverage(
    documentId: string,
    includePageStats?: boolean,
  ): Promise<CoverageStats>;

  /**
   * Clear cache for a specific document
   */
  clearDocument(documentId: string): Promise<ClearDocumentResponse>;

  /**
   * Get overall cache statistics
   */
  getStats(): Promise<CacheStats>;

  /**
   * Set cache size limit
   */
  setLimit(maxSizeBytes: number): Promise<SetLimitResponse>;

  /**
   * Manually trigger LRU eviction
   */
  evict(targetSizeBytes?: number, maxEntries?: number): Promise<EvictResponse>;
}
