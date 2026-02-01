/**
 * CreateSessionDialog Component (T072)
 *
 * Modal dialog for creating a new reading session.
 * Allows user to enter a session name and select documents.
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "../../ui/components/Button/Button";
import { validateSessionName } from "../../domain/sessions/session";
import { useLibraryStore } from "../../stores/library-store";
import "./CreateSessionDialog.css";

interface CreateSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, documentIds: string[]) => Promise<void>;
  preselectedDocumentIds?: string[];
}

export function CreateSessionDialog({
  isOpen,
  onClose,
  onCreate,
  preselectedDocumentIds = [],
}: CreateSessionDialogProps) {
  const [name, setName] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>(
    preselectedDocumentIds,
  );
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { documents, loadDocuments } = useLibraryStore();

  // Load documents when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      setSelectedDocs(preselectedDocumentIds);
      setName("");
      setError(null);
      // Focus input after a short delay for modal animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, loadDocuments, preselectedDocumentIds]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (error) setError(null);
  };

  const toggleDocument = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name
    const validation = validateSessionName(name);
    if (!validation.valid) {
      setError(validation.error ?? "Invalid session name");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onCreate(name.trim(), selectedDocs);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="create-session-dialog__overlay" onClick={onClose}>
      <div
        className="create-session-dialog"
        role="dialog"
        aria-labelledby="create-session-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="create-session-dialog__header">
          <h2
            id="create-session-title"
            className="create-session-dialog__title"
          >
            Create Reading Session
          </h2>
          <button
            className="create-session-dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="create-session-dialog__content">
            <div className="create-session-dialog__field">
              <label
                htmlFor="session-name"
                className="create-session-dialog__label"
              >
                Session Name
              </label>
              <input
                ref={inputRef}
                id="session-name"
                type="text"
                className="create-session-dialog__input"
                value={name}
                onChange={handleNameChange}
                placeholder="My Reading Session"
                maxLength={100}
                disabled={isCreating}
              />
              {error && <p className="create-session-dialog__error">{error}</p>}
            </div>

            <div className="create-session-dialog__field">
              <label className="create-session-dialog__label">
                Select Documents ({selectedDocs.length} selected)
              </label>
              <div className="create-session-dialog__doc-list">
                {documents.length === 0 ? (
                  <p className="create-session-dialog__empty">
                    No documents in library
                  </p>
                ) : (
                  documents.map((doc) => (
                    <label
                      key={doc.id}
                      className={`create-session-dialog__doc-item ${
                        selectedDocs.includes(doc.id)
                          ? "create-session-dialog__doc-item--selected"
                          : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocs.includes(doc.id)}
                        onChange={() => toggleDocument(doc.id)}
                        disabled={isCreating}
                      />
                      <span className="create-session-dialog__doc-title">
                        {doc.title || doc.filePath.split("/").pop()}
                      </span>
                      {doc.pageCount && (
                        <span className="create-session-dialog__doc-pages">
                          {doc.pageCount} pages
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <footer className="create-session-dialog__footer">
            <Button
              variant="ghost"
              type="button"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isCreating}>
              Create Session
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
