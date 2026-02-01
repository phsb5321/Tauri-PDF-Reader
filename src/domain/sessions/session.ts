/**
 * Reading session domain entities
 *
 * Defines the core domain entities for managing reading sessions.
 */

/** Validation constants for sessions */
export const SESSION_NAME_MIN_LENGTH = 1;
export const SESSION_NAME_MAX_LENGTH = 100;
export const MAX_DOCUMENTS_PER_SESSION = 50;

/** A reading session containing multiple documents with saved positions */
export interface ReadingSession {
  id: string;
  name: string;
  documents: SessionDocument[];
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

/** A document within a reading session with saved position */
export interface SessionDocument {
  documentId: string;
  position: number;
  currentPage: number;
  scrollPosition: number;
  createdAt: string;
  /** Denormalized for display */
  title?: string;
  pageCount?: number;
}

/** Summary of a session for list display */
export interface SessionSummary {
  id: string;
  name: string;
  documentCount: number;
  lastAccessedAt: string;
  createdAt: string;
}

/** Input for creating a new session */
export interface CreateSessionInput {
  name: string;
  documentIds: string[];
}

/** Input for updating a session */
export interface UpdateSessionInput {
  name?: string;
  documentIds?: string[];
}

/** Input for updating a document within a session */
export interface UpdateSessionDocumentInput {
  currentPage?: number;
  scrollPosition?: number;
}

/** Response for session restore operation */
export interface SessionRestoreResponse {
  success: boolean;
  session: ReadingSession;
  missingDocuments: string[];
}

/**
 * Validate a session name
 */
export function validateSessionName(name: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Session name cannot be empty" };
  }

  if (trimmed.length > SESSION_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Session name must be ${SESSION_NAME_MAX_LENGTH} characters or less`,
    };
  }

  return { valid: true };
}

/**
 * Create a new session locally (before persistence)
 */
export function createLocalSession(name: string): ReadingSession {
  const now = new Date().toISOString();
  return {
    id: "", // Will be assigned by backend
    name: name.trim(),
    documents: [],
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
  };
}

/**
 * Convert a ReadingSession to a SessionSummary
 */
export function toSessionSummary(session: ReadingSession): SessionSummary {
  return {
    id: session.id,
    name: session.name,
    documentCount: session.documents.length,
    lastAccessedAt: session.lastAccessedAt,
    createdAt: session.createdAt,
  };
}
