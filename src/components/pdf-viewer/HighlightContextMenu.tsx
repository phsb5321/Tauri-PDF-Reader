import { useCallback, useEffect, useRef } from "react";
import { HIGHLIGHT_COLORS } from "../../lib/constants";
import { useToastStore } from "../../stores/toast-store";
import type { Highlight } from "../../lib/schemas";
import "./HighlightContextMenu.css";

interface HighlightContextMenuProps {
  highlight: Highlight;
  position: { x: number; y: number };
  onChangeColor: (highlightId: string, color: string) => void;
  onAddNote: (highlight: Highlight) => void;
  onDelete: (highlightId: string) => void;
  onClose: () => void;
}

/**
 * Context menu for highlight actions (change color, add note, delete)
 */
export function HighlightContextMenu({
  highlight,
  position,
  onChangeColor,
  onAddNote,
  onDelete,
  onClose,
}: HighlightContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    // Delay to avoid immediate trigger
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }, 50);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust horizontal position
    if (rect.right > viewportWidth) {
      menu.style.left = `${position.x - rect.width}px`;
    }

    // Adjust vertical position
    if (rect.bottom > viewportHeight) {
      menu.style.top = `${position.y - rect.height}px`;
    }
  }, [position]);

  const handleColorClick = useCallback(
    (color: string) => {
      onChangeColor(highlight.id, color);
      onClose();
    },
    [highlight.id, onChangeColor, onClose],
  );

  const handleNoteClick = useCallback(() => {
    onAddNote(highlight);
    onClose();
  }, [highlight, onAddNote, onClose]);

  const toastSuccess = useToastStore((s) => s.success);

  const handleDeleteClick = useCallback(() => {
    onDelete(highlight.id);
    toastSuccess("Highlight deleted");
    onClose();
  }, [highlight.id, onDelete, toastSuccess, onClose]);

  return (
    <div
      ref={menuRef}
      className="highlight-context-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      role="menu"
      aria-label="Highlight options"
    >
      {/* Color options */}
      <div className="context-menu-section">
        <span className="context-menu-label">Color</span>
        <div className="context-menu-colors">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.id}
              className={`context-menu-color-button ${highlight.color === color.hex ? "selected" : ""}`}
              style={{ backgroundColor: color.hex }}
              onClick={() => handleColorClick(color.hex)}
              title={color.name}
              aria-label={`Change color to ${color.name}`}
              role="menuitem"
            />
          ))}
        </div>
      </div>

      <div className="context-menu-divider" />

      {/* Note option */}
      <button
        className="context-menu-item"
        onClick={handleNoteClick}
        role="menuitem"
      >
        <NoteIcon />
        <span>{highlight.note ? "Edit Note" : "Add Note"}</span>
      </button>

      <div className="context-menu-divider" />

      {/* Delete option */}
      <button
        className="context-menu-item context-menu-item-danger"
        onClick={handleDeleteClick}
        role="menuitem"
      >
        <DeleteIcon />
        <span>Delete Highlight</span>
      </button>
    </div>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 16 16" className="context-menu-icon" aria-hidden="true">
      <path d="M14 1H2a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V2a1 1 0 00-1-1zM4 4h8v1H4V4zm0 3h8v1H4V7zm0 3h5v1H4v-1z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 16 16" className="context-menu-icon" aria-hidden="true">
      <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z" />
      <path
        fillRule="evenodd"
        d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
      />
    </svg>
  );
}
