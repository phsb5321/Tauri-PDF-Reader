/**
 * AudioExportDialog Component (T088)
 *
 * Dialog for exporting cached audio to audiobook files.
 * Includes readiness checking, format selection, and progress tracking.
 */

import { useState, useCallback, useEffect } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import {
  audioExportCheckReady,
  audioExportDocument,
  audioExportCancel,
} from "../../lib/api/audio-export";
import type {
  ExportFormat,
  ChapterStrategy,
  ExportReadiness,
} from "../../domain/export/export-result";
import { useExportProgress } from "../../hooks/useExportProgress";
import { ExportProgress } from "./ExportProgress";
import "./AudioExportDialog.css";

interface AudioExportDialogProps {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
  voiceId?: string;
}

type DialogState =
  | "checking"
  | "ready"
  | "not-ready"
  | "exporting"
  | "complete"
  | "error";

export function AudioExportDialog({
  documentId,
  documentTitle,
  onClose,
  voiceId,
}: AudioExportDialogProps) {
  const [dialogState, setDialogState] = useState<DialogState>("checking");
  const [readiness, setReadiness] = useState<ExportReadiness | null>(null);
  const [format, setFormat] = useState<ExportFormat>("mp3");
  const [includeChapters, setIncludeChapters] = useState(true);
  const [chapterStrategy, setChapterStrategy] =
    useState<ChapterStrategy>("page");
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const {
    progress,
    lastResult,
    reset: resetProgress,
  } = useExportProgress({
    onComplete: () => {
      setDialogState("complete");
    },
    onError: (err) => {
      setError(err);
      setDialogState("error");
    },
  });

  // Check readiness on mount
  useEffect(() => {
    async function checkReadiness() {
      try {
        const result = await audioExportCheckReady(documentId, voiceId);
        setReadiness(result);
        setDialogState(result.ready ? "ready" : "not-ready");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to check export readiness",
        );
        setDialogState("error");
      }
    }
    checkReadiness();
  }, [documentId, voiceId]);

  const handleExport = useCallback(async () => {
    setError(null);
    resetProgress();

    try {
      // Show save dialog
      const extension = format === "mp3" ? "mp3" : "m4b";
      const defaultFileName = `${documentTitle.replace(/[^a-zA-Z0-9]/g, "_")}.${extension}`;

      const filePath = await save({
        defaultPath: defaultFileName,
        filters: [
          format === "mp3"
            ? { name: "MP3 Audio", extensions: ["mp3"] }
            : { name: "M4B Audiobook", extensions: ["m4b"] },
        ],
      });

      if (!filePath) {
        return; // User cancelled
      }

      setDialogState("exporting");

      await audioExportDocument(
        documentId,
        format,
        filePath,
        includeChapters,
        chapterStrategy,
        voiceId,
      );

      // Success is handled by the useExportProgress hook
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      setDialogState("error");
    }
  }, [
    documentId,
    documentTitle,
    format,
    includeChapters,
    chapterStrategy,
    voiceId,
    resetProgress,
  ]);

  const handleCancel = useCallback(async () => {
    setIsCancelling(true);
    try {
      await audioExportCancel();
    } finally {
      setIsCancelling(false);
      setDialogState("ready");
    }
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && dialogState !== "exporting") {
        onClose();
      }
    },
    [onClose, dialogState],
  );

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
      return `${mb.toFixed(1)} MB`;
    }
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div
      className="audio-export-dialog-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-export-dialog-title"
    >
      <div className="audio-export-dialog">
        <div className="audio-export-dialog__header">
          <h2 id="audio-export-dialog-title">Export Audiobook</h2>
          <button
            className="audio-export-dialog__close"
            onClick={onClose}
            aria-label="Close"
            disabled={dialogState === "exporting"}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="audio-export-dialog__content">
          {dialogState === "checking" && (
            <div className="audio-export-dialog__loading">
              <div className="audio-export-dialog__spinner" />
              <span>Checking export readiness...</span>
            </div>
          )}

          {dialogState === "not-ready" && readiness && (
            <div className="audio-export-dialog__not-ready">
              <div className="audio-export-dialog__coverage">
                <span className="audio-export-dialog__coverage-label">
                  Cache Coverage
                </span>
                <span className="audio-export-dialog__coverage-value">
                  {readiness.coveragePercent.toFixed(0)}%
                </span>
              </div>
              <p className="audio-export-dialog__message">
                Not all audio has been cached yet. Continue listening to cache
                the remaining {readiness.missingChunks.length} chunks before
                exporting.
              </p>
              {readiness.missingChunks.length > 0 &&
                readiness.missingChunks.length <= 5 && (
                  <ul className="audio-export-dialog__missing-list">
                    {readiness.missingChunks.map((chunk, i) => (
                      <li key={i}>
                        Page {chunk.pageNumber}, Chunk {chunk.chunkIndex + 1}
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          )}

          {(dialogState === "ready" || dialogState === "complete") &&
            readiness && (
              <>
                <div className="audio-export-dialog__info">
                  <p>
                    Export <strong>{documentTitle}</strong> as an audiobook
                    file.
                  </p>
                  <div className="audio-export-dialog__stats">
                    <span>
                      Duration: {formatDuration(readiness.estimatedDurationMs)}
                    </span>
                    <span>
                      Size: ~{formatSize(readiness.estimatedFileSizeBytes)}
                    </span>
                  </div>
                </div>

                <div className="audio-export-dialog__options">
                  <div className="audio-export-dialog__option-group">
                    <label className="audio-export-dialog__label">Format</label>
                    <div className="audio-export-dialog__radio-group">
                      <label className="audio-export-dialog__radio">
                        <input
                          type="radio"
                          name="format"
                          value="mp3"
                          checked={format === "mp3"}
                          onChange={() => setFormat("mp3")}
                        />
                        <span>MP3</span>
                      </label>
                      <label className="audio-export-dialog__radio">
                        <input
                          type="radio"
                          name="format"
                          value="m4b"
                          checked={format === "m4b"}
                          onChange={() => setFormat("m4b")}
                        />
                        <span>M4B (Audiobook)</span>
                      </label>
                    </div>
                  </div>

                  <div className="audio-export-dialog__option-group">
                    <label className="audio-export-dialog__checkbox">
                      <input
                        type="checkbox"
                        checked={includeChapters}
                        onChange={(e) => setIncludeChapters(e.target.checked)}
                      />
                      <span>Include chapter markers</span>
                    </label>
                  </div>

                  {includeChapters && (
                    <div className="audio-export-dialog__option-group">
                      <label className="audio-export-dialog__label">
                        Chapter Style
                      </label>
                      <div className="audio-export-dialog__radio-group">
                        <label className="audio-export-dialog__radio">
                          <input
                            type="radio"
                            name="chapterStrategy"
                            value="page"
                            checked={chapterStrategy === "page"}
                            onChange={() => setChapterStrategy("page")}
                          />
                          <span>One chapter per page</span>
                        </label>
                        <label className="audio-export-dialog__radio">
                          <input
                            type="radio"
                            name="chapterStrategy"
                            value="document"
                            checked={chapterStrategy === "document"}
                            onChange={() => setChapterStrategy("document")}
                          />
                          <span>Single chapter</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

          {dialogState === "exporting" && progress && (
            <ExportProgress
              progress={progress}
              onCancel={handleCancel}
              isCancelling={isCancelling}
            />
          )}

          {dialogState === "complete" && lastResult && (
            <div className="audio-export-dialog__complete">
              <div className="audio-export-dialog__success-icon">
                <SuccessIcon />
              </div>
              <p>Audiobook exported successfully!</p>
              <p className="audio-export-dialog__path">
                {lastResult.outputPath}
              </p>
            </div>
          )}

          {error && dialogState === "error" && (
            <div className="audio-export-dialog__error">
              <ErrorIcon />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="audio-export-dialog__footer">
          <button
            className="audio-export-dialog__button audio-export-dialog__button--secondary"
            onClick={onClose}
            disabled={dialogState === "exporting"}
          >
            {dialogState === "complete" ? "Close" : "Cancel"}
          </button>
          {dialogState === "ready" && (
            <button
              className="audio-export-dialog__button audio-export-dialog__button--primary"
              onClick={handleExport}
            >
              Export
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="icon" aria-hidden="true">
      <path
        d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"
        fill="currentColor"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 16 16" className="error-icon" aria-hidden="true">
      <path
        d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z"
        fill="currentColor"
      />
      <path
        d="M7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.552.552 0 01-1.1 0L7.1 4.995z"
        fill="currentColor"
      />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg viewBox="0 0 24 24" className="success-icon" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 12l2.5 2.5L16 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
