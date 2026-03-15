import { useMemo, useCallback } from "react";
import { EmptyState } from "../../ui/components/EmptyState/EmptyState";
import type { Highlight } from "../../lib/schemas";
import "./HighlightsPanel.css";

interface HighlightsPanelProps {
  highlights: Highlight[];
  selectedHighlightId: string | null;
  onHighlightClick: (highlight: Highlight) => void;
  onHighlightDelete: (highlightId: string) => void;
  onExport?: () => void;
  onClose: () => void;
}

/**
 * Sidebar panel displaying all highlights in a document
 * Grouped by page number
 */
export function HighlightsPanel({
  highlights,
  selectedHighlightId,
  onHighlightClick,
  onHighlightDelete,
  onExport,
  onClose,
}: HighlightsPanelProps) {
  // Group highlights by page number
  const groupedHighlights = useMemo(() => {
    const grouped = new Map<number, Highlight[]>();

    for (const highlight of highlights) {
      const existing = grouped.get(highlight.pageNumber) || [];
      grouped.set(highlight.pageNumber, [...existing, highlight]);
    }

    // Sort by page number
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [highlights]);

  const handleDelete = useCallback(
    (e: React.MouseEvent, highlightId: string) => {
      e.stopPropagation();
      onHighlightDelete(highlightId);
    },
    [onHighlightDelete],
  );

  return (
    <div className="highlights-panel">
      <div className="highlights-panel-header">
        <h2 className="highlights-panel-title">Highlights</h2>
        <span className="highlights-panel-count">{highlights.length}</span>
        {onExport && highlights.length > 0 && (
          <button
            className="highlights-panel-export"
            onClick={onExport}
            aria-label="Export highlights"
            title="Export highlights"
          >
            <ExportIcon />
          </button>
        )}
        <button
          className="highlights-panel-close"
          onClick={onClose}
          aria-label="Close highlights panel"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="highlights-panel-content">
        {highlights.length === 0 ? (
          <EmptyState
            title="No highlights yet"
            description="Select text in the PDF to create highlights"
            variant="compact"
            icon={<HighlightIcon />}
          />
        ) : (
          <div className="highlights-list">
            {groupedHighlights.map(([pageNumber, pageHighlights]) => (
              <div key={pageNumber} className="highlights-page-group">
                <div className="highlights-page-header">Page {pageNumber}</div>
                {pageHighlights.map((highlight) => (
                  <HighlightItem
                    key={highlight.id}
                    highlight={highlight}
                    isSelected={selectedHighlightId === highlight.id}
                    onClick={() => onHighlightClick(highlight)}
                    onDelete={(e) => handleDelete(e, highlight.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface HighlightItemProps {
  highlight: Highlight;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function HighlightItem({
  highlight,
  isSelected,
  onClick,
  onDelete,
}: HighlightItemProps) {
  const previewText = highlight.textContent || "No text content";
  const truncatedText =
    previewText.length > 100 ? previewText.slice(0, 100) + "..." : previewText;

  return (
    <div
      className={`highlight-item ${isSelected ? "selected" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick();
        }
      }}
    >
      <div className="highlight-item-content">
        <div
          className="highlight-item-color-bar"
          style={{ backgroundColor: highlight.color }}
        />
        <div className="highlight-item-text">
          <span className="highlight-item-preview">{truncatedText}</span>
          {highlight.note && (
            <div className="highlight-item-note">
              <NoteIcon />
              <span>{highlight.note}</span>
            </div>
          )}
        </div>
      </div>
      <button
        className="highlight-item-delete"
        onClick={onDelete}
        aria-label="Delete highlight"
      >
        <DeleteIcon />
      </button>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="panel-icon" aria-hidden="true">
      <path
        d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"
        fill="currentColor"
      />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="empty-icon" aria-hidden="true">
      <path
        d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 16 16" className="note-icon" aria-hidden="true">
      <path
        d="M14 1H2a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V2a1 1 0 00-1-1zM4 4h8v1H4V4zm0 3h8v1H4V7zm0 3h5v1H4v-1z"
        fill="currentColor"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 16 16" className="delete-icon" aria-hidden="true">
      <path
        d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
        fill="currentColor"
      />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 16 16" className="panel-icon" aria-hidden="true">
      <path
        d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"
        fill="currentColor"
      />
      <path
        d="M7.646 1.146a.5.5 0 01.708 0l3 3a.5.5 0 01-.708.708L8.5 2.707V11.5a.5.5 0 01-1 0V2.707L5.354 4.854a.5.5 0 11-.708-.708l3-3z"
        fill="currentColor"
      />
    </svg>
  );
}
