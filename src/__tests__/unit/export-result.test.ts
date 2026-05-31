/**
 * Unit tests for the audio-export domain helpers (spec 006). Pure, previously
 * 0% covered.
 */
import { describe, it, expect } from "vitest";
import {
  ExportPhase,
  type ExportPhaseType,
  type ExportProgress,
  createDefaultExportOptions,
  calculateExportPercent,
  isExportComplete,
  isExportError,
  getPhaseDescription,
} from "../../domain/export/export-result";

const progress = (phase: ExportPhaseType): ExportProgress => ({
  phase,
  currentChunk: 0,
  totalChunks: 0,
  percent: 0,
  estimatedRemainingMs: 0,
});

describe("export-result domain", () => {
  it("createDefaultExportOptions defaults to mp3 + per-page chapters", () => {
    const o = createDefaultExportOptions("doc-1", "/out/book.mp3");
    expect(o).toMatchObject({
      documentId: "doc-1",
      outputPath: "/out/book.mp3",
      format: "mp3",
      includeChapters: true,
      chapterStrategy: "page",
    });
  });

  describe("calculateExportPercent", () => {
    it("guards divide-by-zero", () => {
      expect(calculateExportPercent(0, 0)).toBe(0);
      expect(calculateExportPercent(3, 0)).toBe(0);
    });
    it("rounds the percentage", () => {
      expect(calculateExportPercent(1, 4)).toBe(25);
      expect(calculateExportPercent(1, 3)).toBe(33); // rounds down
      expect(calculateExportPercent(2, 3)).toBe(67); // rounds up
      expect(calculateExportPercent(5, 5)).toBe(100);
    });
  });

  it("isExportComplete / isExportError reflect the phase", () => {
    expect(isExportComplete(progress(ExportPhase.COMPLETE))).toBe(true);
    expect(isExportComplete(progress(ExportPhase.WRITING))).toBe(false);
    expect(isExportError(progress(ExportPhase.ERROR))).toBe(true);
    expect(isExportError(progress(ExportPhase.COMPLETE))).toBe(false);
  });

  describe("getPhaseDescription", () => {
    it("describes every known phase", () => {
      expect(getPhaseDescription(ExportPhase.LOADING)).toBe(
        "Loading cached audio...",
      );
      expect(getPhaseDescription(ExportPhase.CONCATENATING)).toBe(
        "Joining audio files...",
      );
      expect(getPhaseDescription(ExportPhase.EMBEDDING)).toBe(
        "Adding chapter markers...",
      );
      expect(getPhaseDescription(ExportPhase.WRITING)).toBe(
        "Writing output file...",
      );
      expect(getPhaseDescription(ExportPhase.COMPLETE)).toBe(
        "Export complete!",
      );
      expect(getPhaseDescription(ExportPhase.ERROR)).toBe("Export failed");
    });
    it("falls back for an unknown phase", () => {
      expect(getPhaseDescription("bogus" as ExportPhaseType)).toBe(
        "Processing...",
      );
    });
  });
});
