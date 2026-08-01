import { useEffect, useCallback, useMemo } from "react";
import { useLibraryStore } from "../../stores/library-store";
import { ContinueReading } from "./ContinueReading";
import { useCollectionsStore } from "../../stores/collections-store";
import { DocumentCard } from "./DocumentCard";
import { ShelfSidebar } from "./ShelfSidebar";
import { SearchBar } from "./SearchBar";
import { EmptyState } from "../../ui/components/EmptyState/EmptyState";
import {
  documentsOnShelf,
  shelvesForDocument,
  unfiledDocuments,
} from "../../domain/library/shelves";
import type { Document } from "../../lib/schemas";
import "./LibraryView.css";

interface LibraryViewProps {
  onDocumentSelect: (document: Document) => void;
}

export function LibraryView({ onDocumentSelect }: LibraryViewProps) {
  const {
    documents: allDocuments,
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
    healDocument,
    selectedDocumentId,
    setSelectedDocument,
  } = useLibraryStore();

  const {
    shelves,
    memberships,
    selectedShelfId,
    loadShelves,
    createShelf,
    renameShelf,
    deleteShelf,
    fileDocument,
    unfileDocument,
    selectShelf,
  } = useCollectionsStore();

  const searched = getFilteredDocuments();
  const documents = useMemo(
    () => documentsOnShelf(searched, memberships, selectedShelfId),
    [searched, memberships, selectedShelfId],
  );

  // Counts come off the whole library, not the search results: a sidebar that
  // shrank with the search box could not say how much is left to file, and the
  // shelf counts the backend returns are whole-library too.
  const unfiledCount = useMemo(
    () => unfiledDocuments(allDocuments, memberships).length,
    [allDocuments, memberships],
  );

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
    loadShelves();
  }, [loadDocuments, loadShelves]);

  const handleToggleShelf = useCallback(
    (documentId: string, shelfId: string, filed: boolean) => {
      if (filed) {
        void unfileDocument(shelfId, documentId);
      } else {
        void fileDocument(shelfId, documentId);
      }
    },
    [fileDocument, unfileDocument],
  );

  const handleDocumentClick = useCallback(
    (document: Document) => {
      setSelectedDocument(document.id);
    },
    [setSelectedDocument],
  );

  /**
   * Open a document, relinking it first if its file moved.
   *
   * Healing runs on every open rather than only after a failure: the backend
   * returns immediately once the stored path still resolves, so the ordinary
   * case costs a stat, and a book that was renamed or refiled opens instead of
   * erroring. When nothing matches, the stored document is opened unchanged so
   * the missing file is reported where it already was.
   */
  const handleDocumentOpen = useCallback(
    async (document: Document) => {
      const healed = await healDocument(document.id);
      onDocumentSelect(healed ?? document);
    },
    [healDocument, onDocumentSelect],
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

      <ContinueReading documents={documents} onResume={handleDocumentOpen} />

      <div className="library-body">
        <ShelfSidebar
          shelves={shelves}
          selectedShelfId={selectedShelfId}
          totalCount={allDocuments.length}
          unfiledCount={unfiledCount}
          onSelect={selectShelf}
          onCreate={createShelf}
          onRename={renameShelf}
          onDelete={deleteShelf}
        />

        {documents.length === 0 ? (
          <EmptyState
            title={
              selectedShelfId === null
                ? "No recent documents"
                : "Nothing on this shelf yet"
            }
            description={
              selectedShelfId === null
                ? "Open a PDF to add it to your library"
                : "Right-click a book to file it here"
            }
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
                onDoubleClick={() => void handleDocumentOpen(document)}
                onDelete={() => handleDocumentDelete(document.id)}
                shelves={shelves}
                shelfIds={shelvesForDocument(memberships, document.id)}
                onToggleShelf={(shelfId, filed) =>
                  handleToggleShelf(document.id, shelfId, filed)
                }
              />
            ))}
          </div>
        )}
      </div>
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
