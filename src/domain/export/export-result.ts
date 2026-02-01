/**
 * Export result domain entities
 *
 * Defines entities for audio export operations.
 */

/** Supported export formats */
export type ExportFormat = "mp3" | "m4b";

/** Chapter strategy options */
export type ChapterStrategy = "page" | "document";

/** Result of an audio export operation */
export interface ExportResult {
  success: boolean;
  outputPath: string;
  format: ExportFormat;
  totalDurationMs: number;
  chapterCount: number;
  fileSizeBytes: number;
  exportedAt: string;
}

/** Export phase constants */
export const ExportPhase = {
  LOADING: "loading",
  CONCATENATING: "concatenating",
  EMBEDDING: "embedding",
  WRITING: "writing",
  COMPLETE: "complete",
  ERROR: "error",
} as const;

export type ExportPhaseType = (typeof ExportPhase)[keyof typeof ExportPhase];

/** Progress update during export */
export interface ExportProgress {
  phase: ExportPhaseType;
  currentChunk: number;
  totalChunks: number;
  percent: number;
  estimatedRemainingMs: number;
  error?: string;
}

/** Options for exporting audio */
export interface ExportOptions {
  documentId: string;
  format: ExportFormat;
  outputPath: string;
  includeChapters: boolean;
  chapterStrategy: ChapterStrategy;
  voiceId?: string;
}

/** Readiness check result for export */
export interface ExportReadiness {
  ready: boolean;
  coveragePercent: number;
  missingChunks: MissingChunkInfo[];
  estimatedDurationMs: number;
  estimatedFileSizeBytes: number;
}

/** Information about a missing cache chunk */
export interface MissingChunkInfo {
  pageNumber: number;
  chunkIndex: number;
  textPreview: string;
}

/**
 * Create default export options
 */
export function createDefaultExportOptions(
  documentId: string,
  outputPath: string,
): ExportOptions {
  return {
    documentId,
    format: "mp3",
    outputPath,
    includeChapters: true,
    chapterStrategy: "page",
  };
}

/**
 * Calculate progress percentage
 */
export function calculateExportPercent(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

/**
 * Check if export is complete
 */
export function isExportComplete(progress: ExportProgress): boolean {
  return progress.phase === ExportPhase.COMPLETE;
}

/**
 * Check if export failed
 */
export function isExportError(progress: ExportProgress): boolean {
  return progress.phase === ExportPhase.ERROR;
}

/**
 * Get a human-readable phase description
 */
export function getPhaseDescription(phase: ExportPhaseType): string {
  switch (phase) {
    case ExportPhase.LOADING:
      return "Loading cached audio...";
    case ExportPhase.CONCATENATING:
      return "Joining audio files...";
    case ExportPhase.EMBEDDING:
      return "Adding chapter markers...";
    case ExportPhase.WRITING:
      return "Writing output file...";
    case ExportPhase.COMPLETE:
      return "Export complete!";
    case ExportPhase.ERROR:
      return "Export failed";
    default:
      return "Processing...";
  }
}
