import { useEffect, useRef, useState } from "react";
import { Button } from "../../ui/components/Button/Button";
import { Dialog } from "../../ui/components/Dialog/Dialog";
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
  // Click-again-to-confirm delete (the SessionMenu precedent, slice 146):
  // the packaged WebKitGTK app shims the NATIVE confirm into a PROMISE
  // (always truthy), so a shelf would be deleted without the user answering.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const confirmDeleteTimer = useRef<number | null>(null);
  // Rename is an in-app modal (the native prompt is a bare text prompt with
  // no styling or focus management — a proper Dialog with an input replaces
  // it).
  const [renameTarget, setRenameTarget] = useState<Collection | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(
    () => () => {
      if (confirmDeleteTimer.current !== null) {
        window.clearTimeout(confirmDeleteTimer.current);
      }
    },
    [],
  );

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    onCreate(name);
    setDraftName("");
  };

  const handleRename = (shelf: Collection) => {
    setRenameValue(shelf.name);
    setRenameTarget(shelf);
  };

  const confirmRename = () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    // Cancel / blank / unchanged are all no-op round trips.
    if (name && name !== renameTarget.name) {
      onRename(renameTarget.id, name);
    }
    setRenameTarget(null);
  };

  const handleDelete = (shelf: Collection) => {
    // Deleting a shelf drops its memberships, not the books themselves —
    // say so, because "delete" on a library screen reads as destructive.
    if (confirmingDeleteId === shelf.id) {
      if (confirmDeleteTimer.current !== null) {
        window.clearTimeout(confirmDeleteTimer.current);
        confirmDeleteTimer.current = null;
      }
      setConfirmingDeleteId(null);
      onDelete(shelf.id);
    } else {
      // Arming a DIFFERENT shelf must clear the previous pending timer —
      // otherwise the old timer fires mid-confirm and disarms the new one.
      if (confirmDeleteTimer.current !== null) {
        window.clearTimeout(confirmDeleteTimer.current);
        confirmDeleteTimer.current = null;
      }
      setConfirmingDeleteId(shelf.id);
      confirmDeleteTimer.current = window.setTimeout(() => {
        confirmDeleteTimer.current = null;
        setConfirmingDeleteId(null);
      }, 3000);
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
                className={`shelf-action ${confirmingDeleteId === shelf.id ? "shelf-action--confirming" : ""}`}
                onClick={() => handleDelete(shelf)}
                aria-label={
                  confirmingDeleteId === shelf.id
                    ? `Click again to confirm delete ${shelf.name}`
                    : `Delete ${shelf.name}`
                }
                title={confirmingDeleteId === shelf.id ? "Click again to confirm" : "Delete"}
              >
                {confirmingDeleteId === shelf.id ? "Click again to confirm" : "Delete"}
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

      {/* In-app rename dialog — replaces the native bare prompt (slice 146). */}
      {renameTarget && (
        <Dialog
          open
          onClose={() => setRenameTarget(null)}
          title="Rename shelf"
          description={`Rename "${renameTarget.name}" — the books keep their shelf.`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button onClick={confirmRename}>Save</Button>
            </>
          }
        >
          <label className="shelf-rename-label" htmlFor="shelf-rename-input">
            Shelf name
          </label>
          <input
            id="shelf-rename-input"
            className="shelf-rename-input"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") confirmRename();
            }}
            autoFocus
          />
        </Dialog>
      )}
    </nav>
  );
}
