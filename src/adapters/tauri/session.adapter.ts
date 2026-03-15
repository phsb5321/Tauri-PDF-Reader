/**
 * TauriSessionAdapter (T066)
 *
 * Implements SessionRepository port using Tauri IPC commands.
 */

import type { SessionRepository } from "../../ports/session-repository";
import type {
  CreateSessionInput,
  ReadingSession,
  SessionRestoreResponse,
  SessionSummary,
  UpdateSessionDocumentInput,
  UpdateSessionInput,
} from "../../domain/sessions";
import {
  sessionCreate,
  sessionGet,
  sessionList,
  sessionUpdate,
  sessionDelete,
  sessionRestore,
  sessionAddDocument,
  sessionRemoveDocument,
  sessionUpdateDocument,
} from "../../lib/api/sessions";

export class TauriSessionAdapter implements SessionRepository {
  async create(input: CreateSessionInput): Promise<ReadingSession> {
    return sessionCreate(input.name, input.documentIds);
  }

  async get(sessionId: string): Promise<ReadingSession | null> {
    return sessionGet(sessionId);
  }

  async list(): Promise<SessionSummary[]> {
    return sessionList();
  }

  async update(
    sessionId: string,
    input: UpdateSessionInput,
  ): Promise<ReadingSession> {
    return sessionUpdate(sessionId, input.name, input.documentIds);
  }

  async delete(sessionId: string): Promise<void> {
    return sessionDelete(sessionId);
  }

  async restore(sessionId: string): Promise<SessionRestoreResponse> {
    return sessionRestore(sessionId);
  }

  async addDocument(
    sessionId: string,
    documentId: string,
    position?: number,
  ): Promise<ReadingSession> {
    await sessionAddDocument(sessionId, documentId, position);
    // Fetch and return the updated session
    const session = await sessionGet(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  async removeDocument(
    sessionId: string,
    documentId: string,
  ): Promise<ReadingSession> {
    await sessionRemoveDocument(sessionId, documentId);
    // Fetch and return the updated session
    const session = await sessionGet(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  async updateDocument(
    sessionId: string,
    documentId: string,
    input: UpdateSessionDocumentInput,
  ): Promise<ReadingSession> {
    await sessionUpdateDocument(
      sessionId,
      documentId,
      input.currentPage,
      input.scrollPosition,
    );
    // Fetch and return the updated session
    const session = await sessionGet(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }
}
