/**
 * ExportProgress Component (T087)
 *
 * Displays progress during audio export with phase indicator and progress bar.
 */

import type { ExportProgress as ExportProgressType } from "../../domain/export/export-result";
import { getPhaseDescription } from "../../domain/export/export-result";
import "./ExportProgress.css";

interface ExportProgressProps {
  progress: ExportProgressType;
  onCancel: () => void;
  isCancelling?: boolean;
}

export function ExportProgress({
  progress,
  onCancel,
  isCancelling = false,
}: ExportProgressProps) {
  const phaseDescription = getPhaseDescription(progress.phase);
  const isComplete = progress.phase === "complete";
  const isError = progress.phase === "error";

  // Format remaining time
  const formatTime = (ms: number): string => {
    if (ms <= 0) return "";
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `~${seconds}s remaining`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes}m remaining`;
  };

  return (
    <div
      className="export-progress"
      role="progressbar"
      aria-valuenow={progress.percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="export-progress__header">
        <span className="export-progress__phase">{phaseDescription}</span>
        {!isComplete && !isError && progress.estimatedRemainingMs > 0 && (
          <span className="export-progress__time">
            {formatTime(progress.estimatedRemainingMs)}
          </span>
        )}
      </div>

      <div className="export-progress__bar-container">
        <div
          className={`export-progress__bar ${isComplete ? "export-progress__bar--complete" : ""} ${isError ? "export-progress__bar--error" : ""}`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="export-progress__footer">
        <span className="export-progress__chunks">
          {progress.currentChunk} / {progress.totalChunks} chunks
        </span>
        <span className="export-progress__percent">
          {progress.percent.toFixed(0)}%
        </span>
      </div>

      {!isComplete && !isError && (
        <button
          className="export-progress__cancel"
          onClick={onCancel}
          disabled={isCancelling}
          type="button"
        >
          {isCancelling ? "Cancelling..." : "Cancel"}
        </button>
      )}

      {progress.error && (
        <div className="export-progress__error">
          <svg
            viewBox="0 0 16 16"
            className="export-progress__error-icon"
            aria-hidden="true"
          >
            <path
              d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z"
              fill="currentColor"
            />
            <path
              d="M7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.552.552 0 01-1.1 0L7.1 4.995z"
              fill="currentColor"
            />
          </svg>
          <span>{progress.error}</span>
        </div>
      )}
    </div>
  );
}
