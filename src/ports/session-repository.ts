/**
 * Session Repository Port
 *
 * Defines the contract for reading session persistence operations.
 */

import type {
  CreateSessionInput,
  ReadingSession,
  SessionRestoreResponse,
  SessionSummary,
  UpdateSessionDocumentInput,
  UpdateSessionInput,
} from "../domain/sessions";

/**
 * Repository interface for reading session persistence
 */
export interface SessionRepository {
  /**
   * Create a new reading session
   */
  create(input: CreateSessionInput): Promise<ReadingSession>;

  /**
   * Get a session by ID with all documents
   */
  get(sessionId: string): Promise<ReadingSession | null>;

  /**
   * List all sessions (summary only)
   */
  list(): Promise<SessionSummary[]>;

  /**
   * Update session metadata
   */
  update(sessionId: string, input: UpdateSessionInput): Promise<ReadingSession>;

  /**
   * Delete a session
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Restore a session (open all documents at saved positions)
   */
  restore(sessionId: string): Promise<SessionRestoreResponse>;

  /**
   * Add a document to a session
   */
  addDocument(
    sessionId: string,
    documentId: string,
    position?: number,
  ): Promise<ReadingSession>;

  /**
   * Remove a document from a session
   */
  removeDocument(
    sessionId: string,
    documentId: string,
  ): Promise<ReadingSession>;

  /**
   * Update document state within session
   */
  updateDocument(
    sessionId: string,
    documentId: string,
    input: UpdateSessionDocumentInput,
  ): Promise<ReadingSession>;
}
