import { useState, useCallback, useRef, useEffect } from 'react';
import type { Highlight } from '../../lib/schemas';
import './NoteEditor.css';

interface NoteEditorProps {
  highlight: Highlight;
  onSave: (highlightId: string, note: string) => void;
  onClose: () => void;
}

/**
 * Modal dialog for editing highlight notes
 */
export function NoteEditor({ highlight, onSave, onClose }: NoteEditorProps) {
  const [note, setNote] = useState(highlight.note || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
    // Move cursor to end
    if (textareaRef.current) {
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle click outside modal
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleSave = useCallback(() => {
    onSave(highlight.id, note.trim());
    onClose();
  }, [highlight.id, note, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Save on Ctrl/Cmd + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  // Preview of highlighted text
  const previewText = highlight.textContent || 'No text content';
  const truncatedPreview =
    previewText.length > 150 ? previewText.slice(0, 150) + '...' : previewText;

  return (
    <div
      className="note-editor-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-editor-title"
    >
      <div ref={modalRef} className="note-editor-modal">
        <div className="note-editor-header">
          <h2 id="note-editor-title" className="note-editor-title">
            {highlight.note ? 'Edit Note' : 'Add Note'}
          </h2>
          <button
            className="note-editor-close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="note-editor-content">
          {/* Highlighted text preview */}
          <div className="note-editor-preview">
            <span
              className="note-editor-preview-highlight"
              style={{ backgroundColor: highlight.color + '40' }}
            >
              {truncatedPreview}
            </span>
          </div>

          {/* Note textarea */}
          <div className="note-editor-field">
            <label htmlFor="note-textarea" className="note-editor-label">
              Note
            </label>
            <textarea
              ref={textareaRef}
              id="note-textarea"
              className="note-editor-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add your note here..."
              rows={4}
            />
            <span className="note-editor-hint">
              Press Ctrl+Enter to save
            </span>
          </div>
        </div>

        <div className="note-editor-footer">
          <button
            className="note-editor-button note-editor-button-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="note-editor-button note-editor-button-primary"
            onClick={handleSave}
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="note-editor-icon" aria-hidden="true">
      <path
        d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"
        fill="currentColor"
      />
    </svg>
  );
}
