import { useState, useCallback, useRef } from "react";
import { highlightsExport } from "../../lib/tauri-invoke";
import { useFileDialog, FILE_FILTERS } from "../../hooks/useFileDialog";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useToastStore } from "../../stores/toast-store";
import "./ExportDialog.css";

type ExportFormat = "markdown" | "json";

interface ExportDialogProps {
  documentId: string;
  documentTitle: string;
  highlightCount: number;
  onClose: () => void;
}

export function ExportDialog({
  documentId,
  documentTitle,
  highlightCount,
  onClose,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { saveFile } = useFileDialog();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap for accessibility
  useFocusTrap({
    containerRef: dialogRef,
    active: true,
    onEscape: onClose,
    preventScroll: true,
  });

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      // Get exported content
      const result = await highlightsExport(documentId, format);

      // Show save dialog
      const defaultFileName = `${documentTitle.replace(/[^a-zA-Z0-9]/g, "_")}_highlights.${format === "markdown" ? "md" : "json"}`;

      const filePath = await saveFile({
        defaultPath: defaultFileName,
        filters: [
          format === "markdown" ? FILE_FILTERS.MARKDOWN : FILE_FILTERS.JSON,
        ],
      });

      if (filePath) {
        // Write to file using Tauri FS
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(filePath, result.content);
        useToastStore.getState().success("Highlights exported");
        onClose();
      }
    } catch (err) {
      console.error("Export failed:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Failed to export highlights";
      setError(errorMsg);
      useToastStore.getState().error(errorMsg);
    } finally {
      setIsExporting(false);
    }
  }, [documentId, documentTitle, format, onClose, saveFile]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      className="export-dialog-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div className="export-dialog" ref={dialogRef}>
        <div className="export-dialog-header">
          <h2 id="export-dialog-title">Export Highlights</h2>
          <button
            type="button"
            className="export-dialog-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isExporting}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="export-dialog-content">
          <p className="export-dialog-info">
            Export {highlightCount} highlight{highlightCount !== 1 ? "s" : ""}{" "}
            from <strong>{documentTitle}</strong>
          </p>

          <div className="export-dialog-formats">
            <label className="export-format-option">
              <input
                type="radio"
                name="format"
                value="markdown"
                checked={format === "markdown"}
                onChange={() => setFormat("markdown")}
                disabled={isExporting}
              />
              <div className="format-info">
                <span className="format-name">Markdown</span>
                <span className="format-description">
                  Human-readable format with headings and bullet points
                </span>
              </div>
            </label>

            <label className="export-format-option">
              <input
                type="radio"
                name="format"
                value="json"
                checked={format === "json"}
                onChange={() => setFormat("json")}
                disabled={isExporting}
              />
              <div className="format-info">
                <span className="format-name">JSON</span>
                <span className="format-description">
                  Structured data format for programmatic use
                </span>
              </div>
            </label>
          </div>

          {error && (
            <div className="export-dialog-error">
              <ErrorIcon />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="export-dialog-footer">
          <button
            type="button"
            className="export-dialog-button export-dialog-button-secondary"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="export-dialog-button export-dialog-button-primary"
            onClick={handleExport}
            disabled={isExporting || highlightCount === 0}
          >
            {isExporting ? "Exporting..." : "Export"}
          </button>
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
