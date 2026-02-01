/**
 * SessionItem Component (T070)
 *
 * Individual session item in the session list.
 * Shows session name, document count, and last accessed time.
 */

import { ListRow } from "../../ui/components/ListRow/ListRow";
import { IconButton } from "../../ui/components/IconButton/IconButton";
import type { SessionSummary } from "../../domain/sessions/session";
import "./SessionItem.css";

interface SessionItemProps {
  session: SessionSummary;
  selected?: boolean;
  onRestore: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SessionItem({
  session,
  selected = false,
  onRestore,
  onDelete,
}: SessionItemProps) {
  const handleClick = () => {
    onRestore(session.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(session.id);
  };

  const deleteButton = (
    <IconButton
      label="Delete session"
      variant="ghost"
      size="sm"
      onClick={handleDelete}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </IconButton>
  );

  const documentIcon = (
    <div className="session-item__icon">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
        <path d="M4 9h16" />
        <path d="M9 4v5" />
      </svg>
    </div>
  );

  return (
    <ListRow
      primary={session.name}
      secondary={`${session.documentCount} document${session.documentCount !== 1 ? "s" : ""}`}
      leading={documentIcon}
      trailing={deleteButton}
      metadata={
        <span className="session-item__time">
          {formatRelativeTime(session.lastAccessedAt)}
        </span>
      }
      onClick={handleClick}
      selected={selected}
      className="session-item"
    />
  );
}
