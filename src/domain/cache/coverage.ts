/**
 * Coverage statistics domain entities
 *
 * Defines entities for tracking audio cache coverage per document.
 */

/** Coverage statistics for a document's audio cache */
export interface CoverageStats {
  documentId: string;
  totalChunks: number;
  cachedChunks: number;
  coveragePercent: number;
  totalDurationMs: number;
  cachedSizeBytes: number;
  lastUpdated: string;
  pageStats?: PageCoverageStats[];
}

/** Coverage statistics for a single page */
export interface PageCoverageStats {
  pageNumber: number;
  totalChunks: number;
  cachedChunks: number;
  coveragePercent: number;
  durationMs: number;
}

/**
 * Create empty coverage stats for a document
 */
export function emptyCoverageStats(documentId: string): CoverageStats {
  return {
    documentId,
    totalChunks: 0,
    cachedChunks: 0,
    coveragePercent: 0,
    totalDurationMs: 0,
    cachedSizeBytes: 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Calculate coverage percentage from counts
 */
export function calculateCoveragePercent(
  cached: number,
  total: number,
): number {
  if (total === 0) return 0;
  return Math.round((cached / total) * 100);
}

/**
 * Check if a document is fully cached
 */
export function isFullyCached(stats: CoverageStats): boolean {
  return stats.cachedChunks === stats.totalChunks && stats.totalChunks > 0;
}

/**
 * Format coverage as a human-readable string
 */
export function formatCoverage(stats: CoverageStats): string {
  if (stats.totalChunks === 0) {
    return "No audio cached";
  }
  return `${stats.coveragePercent}% cached (${stats.cachedChunks}/${stats.totalChunks} chunks)`;
}

/**
 * Format duration as human-readable string
 */
export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
}

/**
 * Format bytes as human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}
