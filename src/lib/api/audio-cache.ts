/**
 * Audio Cache API
 *
 * Tauri commands for managing TTS audio cache.
 * Provides coverage tracking, statistics, and cache management.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Types

export interface CoverageResponse {
  documentId: string;
  totalChunks: number;
  cachedChunks: number;
  coveragePercent: number;
  totalDurationMs: number;
  cachedSizeBytes: number;
}

export interface CacheStatsResponse {
  totalSizeBytes: number;
  entryCount: number;
  maxSizeBytes: number;
  oldestEntryAt: string | null;
  newestEntryAt: string | null;
  documentCount: number;
}

export interface EvictionResponse {
  evictedCount: number;
  bytesFreed: number;
}

export interface ClearDocumentResponse {
  entriesRemoved: number;
}

// Commands

/**
 * Get audio cache coverage for a document
 *
 * Returns statistics about how much of the document's audio has been cached.
 */
export async function audioCacheGetCoverage(
  documentId: string,
): Promise<CoverageResponse> {
  return invoke("audio_cache_get_coverage", { documentId });
}

/**
 * Clear all cached audio for a document
 *
 * Removes all cached audio files and metadata for the specified document.
 */
export async function audioCacheClearDocument(
  documentId: string,
): Promise<ClearDocumentResponse> {
  return invoke("audio_cache_clear_document", { documentId });
}

/**
 * Get overall cache statistics
 *
 * Returns global cache statistics including total size, entry count, and limits.
 */
export async function audioCacheGetStats(): Promise<CacheStatsResponse> {
  return invoke("audio_cache_get_stats");
}

/**
 * Set the cache size limit
 *
 * Sets the maximum cache size in bytes. Triggers eviction if current size exceeds the new limit.
 *
 * @param maxSizeBytes Maximum cache size in bytes
 */
export async function audioCacheSetLimit(maxSizeBytes: number): Promise<void> {
  return invoke("audio_cache_set_limit", { maxSizeBytes });
}

/**
 * Get the current cache size limit
 *
 * @returns Maximum cache size in bytes
 */
export async function audioCacheGetLimit(): Promise<number> {
  return invoke("audio_cache_get_limit");
}

/**
 * Manually trigger cache eviction
 *
 * Evicts entries using LRU policy until cache size is under the target.
 *
 * @param targetSizeBytes Target cache size in bytes
 */
export async function audioCacheEvict(
  targetSizeBytes: number,
): Promise<EvictionResponse> {
  return invoke("audio_cache_evict", { targetSizeBytes });
}

// Event Types

export interface CoverageUpdatedEvent {
  documentId: string;
  coveragePercent: number;
  cachedChunks: number;
  totalChunks: number;
}

export interface CacheEvictedEvent {
  evictedCount: number;
  bytesFreed: number;
}

// Event Listeners

/**
 * Listen for cache coverage updates
 *
 * Fired when audio is cached or removed for a document.
 */
export function onCoverageUpdated(
  callback: (event: CoverageUpdatedEvent) => void,
): Promise<UnlistenFn> {
  return listen<CoverageUpdatedEvent>("audio-cache:coverage-updated", (event) =>
    callback(event.payload),
  );
}

/**
 * Listen for cache eviction events (T092)
 *
 * Fired when cache entries are evicted due to size limits.
 */
export function onCacheEvicted(
  callback: (event: CacheEvictedEvent) => void,
): Promise<UnlistenFn> {
  return listen<CacheEvictedEvent>("audio-cache:evicted", (event) =>
    callback(event.payload),
  );
}

/**
 * Notify backend to emit coverage update event (T046)
 *
 * Call this after storing audio to trigger frontend UI updates.
 */
export async function audioCacheNotifyCoverage(
  documentId: string,
): Promise<CoverageResponse> {
  return invoke("audio_cache_notify_coverage", { documentId });
}
