/**
 * SessionMenu Component (T071)
 *
 * Sidebar panel for managing reading sessions.
 * Shows session list with create, restore, and delete functionality.
 */

import { useEffect, useState, useCallback } from "react";
import { Panel } from "../../ui/components/Panel/Panel";
import { Button } from "../../ui/components/Button/Button";
import { EmptyState } from "../../ui/components/EmptyState/EmptyState";
import { SessionItem } from "./SessionItem";
import { CreateSessionDialog } from "./CreateSessionDialog";
import { useSessionStore } from "../../stores/session-store";
import "./SessionMenu.css";

interface SessionMenuProps {
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Callback when a session is restored */
  onSessionRestored?: (sessionId: string) => void;
}

export function SessionMenu({
  isOpen,
  onClose,
  onSessionRestored,
}: SessionMenuProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const {
    sessions,
    isLoading,
    error,
    activeSessionId,
    isRestoring,
    loadSessions,
    createSession,
    deleteSession,
    restoreSession,
    clearActiveSession,
  } = useSessionStore();

  // Load sessions when panel opens
  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen, loadSessions]);

  const handleCreateSession = useCallback(
    async (name: string, documentIds: string[]) => {
      await createSession(name, documentIds);
      setShowCreateDialog(false);
    },
    [createSession],
  );

  const handleRestoreSession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await restoreSession(sessionId);
        if (response.missingDocuments.length > 0) {
          // TODO: Show notification about missing documents
          console.warn("Missing documents:", response.missingDocuments);
        }
        onSessionRestored?.(sessionId);
      } catch (err) {
        console.error("Failed to restore session:", err);
      }
    },
    [restoreSession, onSessionRestored],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (deleteConfirm === sessionId) {
        await deleteSession(sessionId);
        setDeleteConfirm(null);
      } else {
        setDeleteConfirm(sessionId);
        // Auto-dismiss confirmation after 3 seconds
        setTimeout(() => setDeleteConfirm(null), 3000);
      }
    },
    [deleteConfirm, deleteSession],
  );

  const handleCloseActiveSession = useCallback(() => {
    clearActiveSession();
  }, [clearActiveSession]);

  if (!isOpen) return null;

  const headerActions = (
    <Button
      variant="primary"
      size="sm"
      onClick={() => setShowCreateDialog(true)}
      disabled={isLoading}
    >
      New Session
    </Button>
  );

  return (
    <>
      <Panel
        title="Reading Sessions"
        position="left"
        onClose={onClose}
        headerActions={headerActions}
        width={320}
        className="session-menu"
      >
        <div className="session-menu__content">
          {/* Active session indicator */}
          {activeSessionId && (
            <div className="session-menu__active-indicator">
              <span className="session-menu__active-label">Active session</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseActiveSession}
              >
                Close
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="session-menu__loading">
              <div className="session-menu__spinner" />
              <span>Loading sessions...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="session-menu__error">
              <p>{error}</p>
              <Button variant="ghost" size="sm" onClick={loadSessions}>
                Retry
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && sessions.length === 0 && (
            <EmptyState
              title="No reading sessions"
              description="Create a session to save your reading progress across multiple documents"
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              }
              action={{
                label: "Create Session",
                onClick: () => setShowCreateDialog(true),
              }}
              variant="compact"
            />
          )}

          {/* Session list */}
          {!isLoading && !error && sessions.length > 0 && (
            <div className="session-menu__list" role="list">
              {sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  selected={session.id === activeSessionId}
                  onRestore={handleRestoreSession}
                  onDelete={handleDeleteSession}
                />
              ))}
            </div>
          )}

          {/* Restoring indicator */}
          {isRestoring && (
            <div className="session-menu__restoring">
              <div className="session-menu__spinner" />
              <span>Restoring session...</span>
            </div>
          )}

          {/* Delete confirmation toast */}
          {deleteConfirm && (
            <div className="session-menu__delete-confirm">
              Click again to confirm delete
            </div>
          )}
        </div>
      </Panel>

      {/* Create Session Dialog */}
      <CreateSessionDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateSession}
      />
    </>
  );
}
