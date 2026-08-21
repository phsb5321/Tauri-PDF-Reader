import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { Document } from "../../lib/schemas";
import type { ViewMode } from "../../stores/library-store";
import { DocumentCover } from "./DocumentCover";
import "./DocumentCard.css";

interface DocumentCardProps {
  document: Document;
  isSelected: boolean;
  viewMode: ViewMode;
  onClick: () => void;
  onDoubleClick: () => void;
  onDelete: () => void;
  /** Shelves the book can be filed on. Omit to hide the filing controls. */
  shelves?: readonly { id: string; name: string }[];
  /** Shelf ids this book is already filed under. */
  shelfIds?: ReadonlySet<string>;
  onToggleShelf?: (shelfId: string, filed: boolean) => void;
}

function formatLastOpened(lastOpenedAt: string | null | undefined): string {
  if (!lastOpenedAt) return "Never";
  try {
    const date = new Date(lastOpenedAt);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
  } catch {
    return "Unknown";
  }
}

function getDeleteLabels(confirming: boolean): {
  contextMenu: string;
  button: string;
} {
  if (confirming) {
    return {
      contextMenu: "Click again to confirm remove",
      button: "Click again to confirm remove",
    };
  }
  return { contextMenu: "Remove from Library", button: "Remove from library" };
}

export function DocumentCard({
  document,
  isSelected,
  viewMode,
  onClick,
  onDoubleClick,
  onDelete,
  shelves,
  shelfIds,
  onToggleShelf,
}: DocumentCardProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [fileExists] = useState<boolean | null>(null);
  // Click-again-to-confirm (the SessionMenu precedent, slice 146): the
  // packaged WebKitGTK app shims the NATIVE confirm into a PROMISE, so it is
  // always truthy — a book would be deleted without the user ever answering.
  // The destructive action fires only on the SECOND click, inside the
  // window; the first click arms a 3s auto-dismiss.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmDeleteTimer = useRef<number | null>(null);

  // Calculate progress percentage
  const progress = useMemo(() => {
    if (!document.pageCount || document.pageCount <= 0) return 0;
    return Math.round((document.currentPage / document.pageCount) * 100);
  }, [document.currentPage, document.pageCount]);

  // Format date for display outside the component's interaction branches.
  const lastOpened = useMemo(
    () => formatLastOpened(document.lastOpenedAt),
    [document.lastOpenedAt],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setShowContextMenu(false);
  }, []);

  const handlePrimaryKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onDoubleClick();
      }
    },
    [onDoubleClick],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirmingDelete) {
        if (confirmDeleteTimer.current !== null) {
          window.clearTimeout(confirmDeleteTimer.current);
          confirmDeleteTimer.current = null;
        }
        setConfirmingDelete(false);
        handleCloseContextMenu();
        onDelete();
      } else {
        setConfirmingDelete(true);
        confirmDeleteTimer.current = window.setTimeout(() => {
          confirmDeleteTimer.current = null;
          setConfirmingDelete(false);
        }, 3000);
      }
    },
    [confirmingDelete, onDelete, handleCloseContextMenu],
  );

  // Clear the pending-confirm timer on unmount (a dismissed card must not
  // mutate state on a timer after it is gone).
  useEffect(
    () => () => {
      if (confirmDeleteTimer.current !== null) {
        window.clearTimeout(confirmDeleteTimer.current);
      }
    },
    [],
  );

  // Get file name from path
  const fileName = useMemo(() => {
    const parts = document.filePath.split(/[/\\]/);
    return parts[parts.length - 1] || document.filePath;
  }, [document.filePath]);

  // Same menu in both view modes: filing a book is the reason the menu exists
  // now, and it was previously unreachable in list view — the handler set the
  // flag but the list branch returned before anything rendered it.
  const deleteLabels = getDeleteLabels(confirmingDelete);
  const contextMenu = showContextMenu && (
    <div className="document-card-context-menu">
      <button type="button" onClick={onDoubleClick}>
        Open
      </button>
      {shelves && shelves.length > 0 && (
        <fieldset className="document-card-shelves">
          {/* Named by a hidden legend rather than aria-label: a fieldset is
              the native grouping element for a set of checkboxes, and the
              menu has no room for a visible heading. */}
          <legend className="sr-only">Shelves</legend>
          {shelves.map((shelf) => {
            const filed = shelfIds?.has(shelf.id) ?? false;
            return (
              <label key={shelf.id} className="document-card-shelf">
                <input
                  type="checkbox"
                  checked={filed}
                  // Menu stays open: filing a book on several shelves in one
                  // pass is the common case.
                  onChange={() => onToggleShelf?.(shelf.id, filed)}
                />
                <span>{shelf.name}</span>
              </label>
            );
          })}
        </fieldset>
      )}
      <button type="button" onClick={handleDelete}>
        {deleteLabels.contextMenu}
      </button>
      <button type="button" onClick={handleCloseContextMenu}>
        Cancel
      </button>
    </div>
  );

  if (viewMode === "list") {
    return (
      <article
        className={`document-card document-card--list ${isSelected ? "selected" : ""} ${fileExists === false ? "missing" : ""}`}
        onContextMenu={handleContextMenu}
      >
        <button
          type="button"
          className="document-card-open"
          aria-label={`Select ${document.title || fileName}; press Enter or double-click to open`}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onKeyDown={handlePrimaryKeyDown}
        >
          <div className="document-card-icon">
            {/* Keyed by filePath: a healed/relocated book keeps its content-hash
                id while its path changes — the key forces the cover pipeline
                (and its broken state) to reset and retry on the new path
                (Codex round 4). */}
            <DocumentCover
              key={document.filePath}
              documentId={document.id}
              title={document.title}
              filePath={document.filePath}
              fileHash={document.fileHash}
              decorative
              size="sm"
            />
          </div>
          <div className="document-card-info">
            <span className="document-card-title">
              {document.title || fileName}
            </span>
            <span className="document-card-path" title={document.filePath}>
              {fileName}
            </span>
          </div>
          <div className="document-card-meta">
            <span className="document-card-pages">
              {document.currentPage}/{document.pageCount || "?"} pages
            </span>
            <span className="document-card-date">{lastOpened}</span>
          </div>
          <div className="document-card-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="progress-text">{progress}%</span>
          </div>
        </button>
        <button
          type="button"
          className={`document-card-delete ${confirmingDelete ? "document-card-delete--confirming" : ""}`}
          onClick={handleDelete}
          title={deleteLabels.button}
          aria-label={deleteLabels.button}
        >
          <DeleteIcon />
        </button>
        {contextMenu}
      </article>
    );
  }

  return (
    <article
      className={`document-card document-card--grid ${isSelected ? "selected" : ""} ${fileExists === false ? "missing" : ""}`}
      onContextMenu={handleContextMenu}
    >
      <button
        type="button"
        className="document-card-open"
        aria-label={`Select ${document.title || fileName}; press Enter or double-click to open`}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={handlePrimaryKeyDown}
      >
        <div className="document-card-thumbnail">
          {/* Keyed by filePath — see the list branch's comment. */}
          <DocumentCover
            key={document.filePath}
            documentId={document.id}
            title={document.title}
            filePath={document.filePath}
            fileHash={document.fileHash}
            decorative
            size="md"
          />
          {progress > 0 && (
            <>
              <div
                className="document-card-cover-progress"
                style={{ width: `${progress}%` }}
                aria-hidden="true"
              />
              <span className="document-card-cover-percent">{progress}%</span>
            </>
          )}
        </div>
        <div className="document-card-content">
          <h3
            className="document-card-title"
            title={document.title || fileName}
          >
            {document.title || fileName}
          </h3>
          <p className="document-card-meta">
            <span>{document.pageCount || "?"} pages</span>
            <span>{lastOpened}</span>
          </p>
          <div className="document-card-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </button>
      <button
        type="button"
        className={`document-card-delete ${confirmingDelete ? "document-card-delete--confirming" : ""}`}
        onClick={handleDelete}
        title={deleteLabels.button}
        aria-label={deleteLabels.button}
      >
        <DeleteIcon />
      </button>

      {contextMenu}
    </article>
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
