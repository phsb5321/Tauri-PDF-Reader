/**
 * Sessions API (T066-T068)
 *
 * Tauri commands for managing reading sessions.
 * Provides session CRUD operations and document management within sessions.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  ReadingSession,
  SessionSummary,
  SessionRestoreResponse,
} from "../../domain/sessions/session";

// Commands

/**
 * Create a new reading session
 *
 * @param name Session name
 * @param documentIds Array of document IDs to include in the session
 */
export async function sessionCreate(
  name: string,
  documentIds: string[],
): Promise<ReadingSession> {
  return invoke("session_create", { name, documentIds });
}

/**
 * Get a session by ID with all documents
 *
 * @param sessionId Session ID
 * @returns Session with documents or null if not found
 */
export async function sessionGet(
  sessionId: string,
): Promise<ReadingSession | null> {
  return invoke("session_get", { sessionId });
}

/**
 * List all sessions (summary only)
 *
 * Returns summaries sorted by last accessed date (most recent first).
 */
export async function sessionList(): Promise<SessionSummary[]> {
  return invoke("session_list");
}

/**
 * Update a session's name and/or documents
 *
 * @param sessionId Session ID to update
 * @param name New name (optional)
 * @param documentIds New document IDs (optional, replaces existing)
 */
export async function sessionUpdate(
  sessionId: string,
  name?: string,
  documentIds?: string[],
): Promise<ReadingSession> {
  return invoke("session_update", { sessionId, name, documentIds });
}

/**
 * Delete a session
 *
 * @param sessionId Session ID to delete
 */
export async function sessionDelete(sessionId: string): Promise<void> {
  return invoke("session_delete", { sessionId });
}

/**
 * Restore a session
 *
 * Updates last_accessed_at and checks for missing documents.
 *
 * @param sessionId Session ID to restore
 * @returns Session with missing document information
 */
export async function sessionRestore(
  sessionId: string,
): Promise<SessionRestoreResponse> {
  return invoke("session_restore", { sessionId });
}

/**
 * Add a document to a session
 *
 * @param sessionId Session ID
 * @param documentId Document ID to add
 * @param position Optional position in the session (appends if not specified)
 */
export async function sessionAddDocument(
  sessionId: string,
  documentId: string,
  position?: number,
): Promise<void> {
  return invoke("session_add_document", { sessionId, documentId, position });
}

/**
 * Remove a document from a session
 *
 * @param sessionId Session ID
 * @param documentId Document ID to remove
 */
export async function sessionRemoveDocument(
  sessionId: string,
  documentId: string,
): Promise<void> {
  return invoke("session_remove_document", { sessionId, documentId });
}

/**
 * Update a document's reading position within a session
 *
 * @param sessionId Session ID
 * @param documentId Document ID
 * @param currentPage Current page number (optional)
 * @param scrollPosition Scroll position (optional)
 */
export async function sessionUpdateDocument(
  sessionId: string,
  documentId: string,
  currentPage?: number,
  scrollPosition?: number,
): Promise<void> {
  return invoke("session_update_document", {
    sessionId,
    documentId,
    currentPage,
    scrollPosition,
  });
}

/**
 * Touch a session to update its last_accessed_at timestamp
 *
 * @param sessionId Session ID
 */
export async function sessionTouch(sessionId: string): Promise<void> {
  return invoke("session_touch", { sessionId });
}
