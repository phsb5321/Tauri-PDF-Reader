import { useEffect, useCallback } from "react";
import { useLibraryStore } from "../../stores/library-store";
import { DocumentCard } from "./DocumentCard";
import { SearchBar } from "./SearchBar";
import { EmptyState } from "../../ui/components/EmptyState/EmptyState";
import type { Document } from "../../lib/schemas";
import "./LibraryView.css";

interface LibraryViewProps {
  onDocumentSelect: (document: Document) => void;
}

export function LibraryView({ onDocumentSelect }: LibraryViewProps) {
  const {
    isLoading,
    error,
    viewMode,
    sortOrder,
    loadDocuments,
    setSearchQuery,
    setSortOrder,
    setViewMode,
    getFilteredDocuments,
    removeDocument,
    selectedDocumentId,
    setSelectedDocument,
  } = useLibraryStore();

  const documents = getFilteredDocuments();

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDocumentClick = useCallback(
    (document: Document) => {
      setSelectedDocument(document.id);
    },
    [setSelectedDocument],
  );

  const handleDocumentOpen = useCallback(
    (document: Document) => {
      onDocumentSelect(document);
    },
    [onDocumentSelect],
  );

  const handleDocumentDelete = useCallback(
    async (documentId: string) => {
      if (window.confirm("Remove this document from the library?")) {
        try {
          await removeDocument(documentId);
        } catch (error) {
          console.error("Failed to remove document:", error);
        }
      }
    },
    [removeDocument],
  );

  if (isLoading) {
    return (
      <div className="library-view library-view--loading">
        <div className="loading-spinner" />
        <p>Loading library...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="library-view library-view--error">
        <div className="error-message">
          <span className="error-icon">!</span>
          <p>{error}</p>
          <button onClick={loadDocuments}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="library-view">
      <div className="library-header">
        <h1 className="library-title">Library</h1>
        <div className="library-controls">
          <SearchBar onSearch={setSearchQuery} />
          <div className="library-sort">
            <label htmlFor="sort-select">Sort:</label>
            <select
              id="sort-select"
              value={sortOrder}
              onChange={(e) =>
                setSortOrder(e.target.value as "recent" | "created" | "title")
              }
            >
              <option value="recent">Recently Opened</option>
              <option value="created">Date Added</option>
              <option value="title">Title</option>
            </select>
          </div>
          <div className="library-view-toggle">
            <button
              className={`view-button ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid view"
              aria-label="Grid view"
            >
              <GridIcon />
            </button>
            <button
              className={`view-button ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              title="List view"
              aria-label="List view"
            >
              <ListIcon />
            </button>
          </div>
        </div>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title="No recent documents"
          description="Open a PDF to add it to your library"
          icon={<DocumentIcon />}
        />
      ) : (
        <div className={`library-grid library-grid--${viewMode}`}>
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              isSelected={selectedDocumentId === document.id}
              viewMode={viewMode}
              onClick={() => handleDocumentClick(document)}
              onDoubleClick={() => handleDocumentOpen(document)}
              onDelete={() => handleDocumentDelete(document.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" className="icon" aria-hidden="true">
      <path
        d="M1 1h5v5H1V1zm0 6h5v5H1V7zm6-6h5v5H7V1zm0 6h5v5H7V7z"
        fill="currentColor"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" className="icon" aria-hidden="true">
      <path
        d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z"
        fill="currentColor"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="empty-icon" aria-hidden="true">
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <polyline
        points="14 2 14 8 20 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
