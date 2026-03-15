/**
 * Audio cache entry domain entity
 *
 * Defines the structure for cached TTS audio metadata.
 */

/** Metadata for a cached TTS audio file */
export interface AudioCacheEntry {
  cacheKey: string;
  documentId: string | null;
  pageNumber: number | null;
  chunkIndex: number | null;
  totalChunks: number | null;
  textHash: string;
  voiceId: string;
  settingsHash: string;
  filePath: string;
  sizeBytes: number;
  durationMs: number;
  createdAt: string;
  lastAccessedAt: string;
}

/** Cached audio data with entry metadata */
export interface CachedAudioData {
  entry: AudioCacheEntry;
  audioData: Uint8Array;
  wordTimings?: WordTiming[];
}

/** Word timing for synchronized highlighting */
export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  charStart: number;
  charEnd: number;
}

/** Overall cache statistics */
export interface CacheStats {
  totalSizeBytes: number;
  entryCount: number;
  maxSizeBytes: number;
  oldestEntryAt?: string;
  newestEntryAt?: string;
  documentCount: number;
}

/** Result of an eviction operation */
export interface EvictionResult {
  evictedCount: number;
  bytesFreed: number;
}

/**
 * Check if a cache entry belongs to a specific document
 */
export function belongsToDocument(
  entry: AudioCacheEntry,
  documentId: string,
): boolean {
  return entry.documentId === documentId;
}

/**
 * Calculate the age of a cache entry in milliseconds
 */
export function getCacheEntryAge(entry: AudioCacheEntry): number {
  const createdAt = new Date(entry.createdAt).getTime();
  return Date.now() - createdAt;
}

/**
 * Calculate the time since last access in milliseconds
 */
export function getTimeSinceAccess(entry: AudioCacheEntry): number {
  const lastAccess = new Date(entry.lastAccessedAt).getTime();
  return Date.now() - lastAccess;
}

/**
 * Check if cache is approaching the size limit
 */
export function isNearLimit(stats: CacheStats, threshold = 0.9): boolean {
  if (stats.maxSizeBytes === 0) return false;
  return stats.totalSizeBytes / stats.maxSizeBytes >= threshold;
}

/**
 * Calculate the percentage of cache used
 */
export function getCacheUsagePercent(stats: CacheStats): number {
  if (stats.maxSizeBytes === 0) return 0;
  return Math.round((stats.totalSizeBytes / stats.maxSizeBytes) * 100);
}
