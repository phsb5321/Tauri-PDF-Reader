/**
 * Audio Export API (T085)
 *
 * Tauri commands for exporting cached audio to audiobook files.
 * Provides readiness checking, export execution, and cancellation.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  ExportReadiness,
  ExportResult,
  ExportFormat,
  ChapterStrategy,
} from "../../domain/export/export-result";

/**
 * Check if a document is ready for export
 *
 * Verifies that all audio chunks are cached and returns coverage information.
 *
 * @param documentId Document ID to check
 * @param voiceId Optional voice ID to filter by
 * @returns Readiness status with coverage details
 */
export async function audioExportCheckReady(
  documentId: string,
  voiceId?: string,
): Promise<ExportReadiness> {
  return invoke("audio_export_check_ready", { documentId, voiceId });
}

/**
 * Export document audio to a file
 *
 * Concatenates all cached audio chunks and embeds chapter markers.
 * Emits 'audio-export:progress' events during processing.
 * Emits 'audio-export:complete' event when finished.
 *
 * @param documentId Document ID to export
 * @param format Output format (mp3 or m4b)
 * @param outputPath Full path for the output file
 * @param includeChapters Whether to embed chapter markers
 * @param chapterStrategy How to create chapters ('page' or 'document')
 * @param voiceId Optional voice ID to filter cached audio
 * @returns Export result with file details
 */
export async function audioExportDocument(
  documentId: string,
  format: ExportFormat,
  outputPath: string,
  includeChapters: boolean = true,
  chapterStrategy: ChapterStrategy = "page",
  voiceId?: string,
): Promise<ExportResult> {
  return invoke("audio_export_document", {
    documentId,
    format,
    outputPath,
    includeChapters,
    chapterStrategy,
    voiceId,
  });
}

/**
 * Cancel an in-progress export
 *
 * @returns true if cancellation was requested, false if no export was in progress
 */
export async function audioExportCancel(): Promise<boolean> {
  return invoke("audio_export_cancel");
}
