import { useState, useCallback, useMemo } from 'react';
import type { Document } from '../../lib/schemas';
import type { ViewMode } from '../../stores/library-store';
import './DocumentCard.css';

interface DocumentCardProps {
  document: Document;
  isSelected: boolean;
  viewMode: ViewMode;
  onClick: () => void;
  onDoubleClick: () => void;
  onDelete: () => void;
}

export function DocumentCard({
  document,
  isSelected,
  viewMode,
  onClick,
  onDoubleClick,
  onDelete,
}: DocumentCardProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [fileExists] = useState<boolean | null>(null);

  // Calculate progress percentage
  const progress = useMemo(() => {
    if (!document.pageCount || document.pageCount <= 0) return 0;
    return Math.round((document.currentPage / document.pageCount) * 100);
  }, [document.currentPage, document.pageCount]);

  // Format date for display
  const lastOpened = useMemo(() => {
    if (!document.lastOpenedAt) return 'Never';
    try {
      const date = new Date(document.lastOpenedAt);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return 'Unknown';
    }
  }, [document.lastOpenedAt]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setShowContextMenu(false);
  }, []);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleCloseContextMenu();
      onDelete();
    },
    [onDelete, handleCloseContextMenu]
  );

  // Get file name from path
  const fileName = useMemo(() => {
    const parts = document.filePath.split(/[/\\]/);
    return parts[parts.length - 1] || document.filePath;
  }, [document.filePath]);

  if (viewMode === 'list') {
    return (
      <div
        className={`document-card document-card--list ${isSelected ? 'selected' : ''} ${fileExists === false ? 'missing' : ''}`}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onDoubleClick();
          if (e.key === ' ') onClick();
        }}
      >
        <div className="document-card-icon">
          <PdfIcon />
        </div>
        <div className="document-card-info">
          <span className="document-card-title">{document.title || fileName}</span>
          <span className="document-card-path" title={document.filePath}>
            {fileName}
          </span>
        </div>
        <div className="document-card-meta">
          <span className="document-card-pages">
            {document.currentPage}/{document.pageCount || '?'} pages
          </span>
          <span className="document-card-date">{lastOpened}</span>
        </div>
        <div className="document-card-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">{progress}%</span>
        </div>
        <button
          className="document-card-delete"
          onClick={handleDelete}
          title="Remove from library"
          aria-label="Remove from library"
        >
          <DeleteIcon />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`document-card document-card--grid ${isSelected ? 'selected' : ''} ${fileExists === false ? 'missing' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={handleContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDoubleClick();
        if (e.key === ' ') onClick();
      }}
    >
      <div className="document-card-thumbnail">
        <PdfIcon />
        {progress > 0 && (
          <div className="document-card-progress-badge">{progress}%</div>
        )}
      </div>
      <div className="document-card-content">
        <h3 className="document-card-title" title={document.title || fileName}>
          {document.title || fileName}
        </h3>
        <p className="document-card-meta">
          <span>{document.pageCount || '?'} pages</span>
          <span>{lastOpened}</span>
        </p>
        <div className="document-card-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <button
        className="document-card-delete"
        onClick={handleDelete}
        title="Remove from library"
        aria-label="Remove from library"
      >
        <DeleteIcon />
      </button>

      {/* Context Menu */}
      {showContextMenu && (
        <div className="document-card-context-menu" onClick={(e) => e.stopPropagation()}>
          <button onClick={onDoubleClick}>Open</button>
          <button onClick={handleDelete}>Remove from Library</button>
          <button onClick={handleCloseContextMenu}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" className="pdf-icon" aria-hidden="true">
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
        fill="#E53935"
      />
      <path d="M14 2v6h6" fill="#EF9A9A" />
      <text x="6" y="18" fontSize="6" fill="white" fontWeight="bold">
        PDF
      </text>
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
