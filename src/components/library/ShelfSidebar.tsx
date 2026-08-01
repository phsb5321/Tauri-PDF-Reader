import { useState } from "react";
import { ALL_DOCUMENTS, UNFILED } from "../../domain/library/shelves";
import type { Collection } from "../../lib/schemas";
import "./ShelfSidebar.css";

interface ShelfSidebarProps {
  shelves: readonly Collection[];
  selectedShelfId: string | null;
  totalCount: number;
  unfiledCount: number;
  onSelect: (shelfId: string | null) => void;
  onCreate: (name: string) => void;
  onRename: (shelfId: string, name: string) => void;
  onDelete: (shelfId: string) => void;
}

export function ShelfSidebar({
  shelves,
  selectedShelfId,
  totalCount,
  unfiledCount,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Readonly<ShelfSidebarProps>) {
  const [draftName, setDraftName] = useState("");

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    onCreate(name);
    setDraftName("");
  };

  const handleRename = (shelf: Collection) => {
    const next = window.prompt("Rename shelf", shelf.name);
    // Cancel gives null; an unchanged name is a no-op round trip.
    if (next === null) return;
    const name = next.trim();
    if (!name || name === shelf.name) return;
    onRename(shelf.id, name);
  };

  const handleDelete = (shelf: Collection) => {
    // Deleting a shelf drops its memberships, not the books themselves —
    // say so, because "delete" on a library screen reads as destructive.
    if (
      window.confirm(
        `Delete the shelf "${shelf.name}"? The books stay in your library.`,
      )
    ) {
      onDelete(shelf.id);
    }
  };

  return (
    <nav className="shelf-sidebar" aria-label="Shelves">
      <ul className="shelf-list">
        <li>
          <button
            type="button"
            className={`shelf-item ${selectedShelfId === ALL_DOCUMENTS ? "selected" : ""}`}
            aria-current={
              selectedShelfId === ALL_DOCUMENTS ? "true" : undefined
            }
            onClick={() => onSelect(ALL_DOCUMENTS)}
          >
            <span className="shelf-name">All books</span>
            <span className="shelf-count">{totalCount}</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className={`shelf-item ${selectedShelfId === UNFILED ? "selected" : ""}`}
            aria-current={selectedShelfId === UNFILED ? "true" : undefined}
            onClick={() => onSelect(UNFILED)}
          >
            <span className="shelf-name">Unfiled</span>
            <span className="shelf-count">{unfiledCount}</span>
          </button>
        </li>

        {shelves.map((shelf) => (
          <li key={shelf.id} className="shelf-row">
            <button
              type="button"
              className={`shelf-item ${selectedShelfId === shelf.id ? "selected" : ""}`}
              aria-current={selectedShelfId === shelf.id ? "true" : undefined}
              onClick={() => onSelect(shelf.id)}
            >
              <span className="shelf-name">{shelf.name}</span>
              <span className="shelf-count">{shelf.documentCount}</span>
            </button>
            <span className="shelf-actions">
              <button
                type="button"
                className="shelf-action"
                onClick={() => handleRename(shelf)}
                aria-label={`Rename ${shelf.name}`}
                title="Rename"
              >
                Rename
              </button>
              <button
                type="button"
                className="shelf-action"
                onClick={() => handleDelete(shelf)}
                aria-label={`Delete ${shelf.name}`}
                title="Delete"
              >
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form className="shelf-new" onSubmit={handleCreate}>
        <label className="shelf-new-label" htmlFor="new-shelf-name">
          New shelf
        </label>
        <input
          id="new-shelf-name"
          className="shelf-new-input"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          placeholder="Philosophy"
          maxLength={100}
        />
        <button
          type="submit"
          className="shelf-new-submit"
          disabled={!draftName.trim()}
        >
          Add
        </button>
      </form>
    </nav>
  );
}
