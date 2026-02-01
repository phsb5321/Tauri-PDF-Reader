/**
 * Session Store (T069)
 *
 * Zustand store for managing reading sessions.
 * Provides session CRUD operations, restore functionality, and document management.
 */

import { create } from "zustand";
import type {
  ReadingSession,
  SessionSummary,
  SessionRestoreResponse,
} from "../domain/sessions/session";
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
  sessionTouch,
} from "../lib/api/sessions";

interface SessionState {
  // Session list
  sessions: SessionSummary[];
  isLoading: boolean;
  error: string | null;

  // Active session (currently restored/being used)
  activeSession: ReadingSession | null;
  activeSessionId: string | null;
  missingDocuments: string[];

  // UI state
  isCreating: boolean;
  isRestoring: boolean;

  // Actions - List operations
  loadSessions: () => Promise<void>;

  // Actions - CRUD
  createSession: (
    name: string,
    documentIds: string[],
  ) => Promise<ReadingSession>;
  getSession: (sessionId: string) => Promise<ReadingSession | null>;
  updateSession: (
    sessionId: string,
    name?: string,
    documentIds?: string[],
  ) => Promise<ReadingSession>;
  deleteSession: (sessionId: string) => Promise<void>;

  // Actions - Restore
  restoreSession: (sessionId: string) => Promise<SessionRestoreResponse>;
  clearActiveSession: () => void;

  // Actions - Document management
  addDocumentToSession: (
    sessionId: string,
    documentId: string,
    position?: number,
  ) => Promise<void>;
  removeDocumentFromSession: (
    sessionId: string,
    documentId: string,
  ) => Promise<void>;
  updateDocumentInSession: (
    sessionId: string,
    documentId: string,
    currentPage?: number,
    scrollPosition?: number,
  ) => Promise<void>;
  touchSession: (sessionId: string) => Promise<void>;

  // Reset
  reset: () => void;
}

const initialState = {
  sessions: [] as SessionSummary[],
  isLoading: false,
  error: null as string | null,
  activeSession: null as ReadingSession | null,
  activeSessionId: null as string | null,
  missingDocuments: [] as string[],
  isCreating: false,
  isRestoring: false,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  loadSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await sessionList();
      set({ sessions, isLoading: false });
    } catch (error) {
      console.error("[Session Store] Failed to load sessions:", error);
      set({
        error:
          error instanceof Error ? error.message : "Failed to load sessions",
        isLoading: false,
      });
    }
  },

  createSession: async (name, documentIds) => {
    set({ isCreating: true, error: null });
    try {
      const session = await sessionCreate(name, documentIds);
      // Reload session list to include the new session
      await get().loadSessions();
      set({ isCreating: false });
      return session;
    } catch (error) {
      console.error("[Session Store] Failed to create session:", error);
      set({
        error:
          error instanceof Error ? error.message : "Failed to create session",
        isCreating: false,
      });
      throw error;
    }
  },

  getSession: async (sessionId) => {
    try {
      return await sessionGet(sessionId);
    } catch (error) {
      console.error("[Session Store] Failed to get session:", error);
      throw error;
    }
  },

  updateSession: async (sessionId, name, documentIds) => {
    try {
      const session = await sessionUpdate(sessionId, name, documentIds);
      // Update the session in the list
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                name: session.name,
                documentCount: session.documents.length,
              }
            : s,
        ),
        // Update active session if it's the one being updated
        activeSession:
          state.activeSessionId === sessionId ? session : state.activeSession,
      }));
      return session;
    } catch (error) {
      console.error("[Session Store] Failed to update session:", error);
      throw error;
    }
  },

  deleteSession: async (sessionId) => {
    try {
      await sessionDelete(sessionId);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        // Clear active session if it was deleted
        activeSession:
          state.activeSessionId === sessionId ? null : state.activeSession,
        activeSessionId:
          state.activeSessionId === sessionId ? null : state.activeSessionId,
        missingDocuments:
          state.activeSessionId === sessionId ? [] : state.missingDocuments,
      }));
    } catch (error) {
      console.error("[Session Store] Failed to delete session:", error);
      throw error;
    }
  },

  restoreSession: async (sessionId) => {
    set({ isRestoring: true, error: null });
    try {
      const response = await sessionRestore(sessionId);
      set({
        activeSession: response.session,
        activeSessionId: sessionId,
        missingDocuments: response.missingDocuments,
        isRestoring: false,
      });
      // Reload sessions to update last_accessed_at in the list
      await get().loadSessions();
      return response;
    } catch (error) {
      console.error("[Session Store] Failed to restore session:", error);
      set({
        error:
          error instanceof Error ? error.message : "Failed to restore session",
        isRestoring: false,
      });
      throw error;
    }
  },

  clearActiveSession: () => {
    set({
      activeSession: null,
      activeSessionId: null,
      missingDocuments: [],
    });
  },

  addDocumentToSession: async (sessionId, documentId, position) => {
    try {
      await sessionAddDocument(sessionId, documentId, position);
      // Refresh the session if it's active
      if (get().activeSessionId === sessionId) {
        const session = await sessionGet(sessionId);
        if (session) {
          set({ activeSession: session });
        }
      }
      // Update document count in session list
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, documentCount: s.documentCount + 1 } : s,
        ),
      }));
    } catch (error) {
      console.error(
        "[Session Store] Failed to add document to session:",
        error,
      );
      throw error;
    }
  },

  removeDocumentFromSession: async (sessionId, documentId) => {
    try {
      await sessionRemoveDocument(sessionId, documentId);
      // Refresh the session if it's active
      if (get().activeSessionId === sessionId) {
        const session = await sessionGet(sessionId);
        if (session) {
          set({ activeSession: session });
        }
      }
      // Update document count in session list
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, documentCount: Math.max(0, s.documentCount - 1) }
            : s,
        ),
      }));
    } catch (error) {
      console.error(
        "[Session Store] Failed to remove document from session:",
        error,
      );
      throw error;
    }
  },

  updateDocumentInSession: async (
    sessionId,
    documentId,
    currentPage,
    scrollPosition,
  ) => {
    try {
      await sessionUpdateDocument(
        sessionId,
        documentId,
        currentPage,
        scrollPosition,
      );
      // Update the active session if it matches
      if (get().activeSessionId === sessionId) {
        set((state) => ({
          activeSession: state.activeSession
            ? {
                ...state.activeSession,
                documents: state.activeSession.documents.map((d) =>
                  d.documentId === documentId
                    ? {
                        ...d,
                        currentPage: currentPage ?? d.currentPage,
                        scrollPosition: scrollPosition ?? d.scrollPosition,
                      }
                    : d,
                ),
              }
            : null,
        }));
      }
    } catch (error) {
      console.error(
        "[Session Store] Failed to update document in session:",
        error,
      );
      throw error;
    }
  },

  touchSession: async (sessionId) => {
    try {
      await sessionTouch(sessionId);
      // Reload sessions to update order
      await get().loadSessions();
    } catch (error) {
      console.error("[Session Store] Failed to touch session:", error);
      throw error;
    }
  },

  reset: () => set(initialState),
}));

// Selectors
export const selectSessionCount = (state: SessionState) =>
  state.sessions.length;
export const selectHasSessions = (state: SessionState) =>
  state.sessions.length > 0;
export const selectActiveSession = (state: SessionState) => state.activeSession;
export const selectIsSessionActive = (state: SessionState) =>
  state.activeSession !== null;
export const selectHasMissingDocuments = (state: SessionState) =>
  state.missingDocuments.length > 0;
