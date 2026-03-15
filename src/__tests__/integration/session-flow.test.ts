/**
 * Session Lifecycle Integration Tests (T057)
 *
 * Tests for the reading session lifecycle flow.
 * Verifies:
 * - Session creation
 * - Session listing
 * - Session restore
 * - Document position tracking
 * - Session deletion
 * - Store integration
 *
 * Note: These tests mock Tauri IPC since they run in Vitest.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSessionStore } from "../../stores/session-store";
import type {
  ReadingSession,
  SessionSummary,
  SessionRestoreResponse,
} from "../../domain/sessions/session";

// Mock the sessions API
vi.mock("../../lib/api/sessions", () => ({
  sessionCreate: vi.fn(),
  sessionGet: vi.fn(),
  sessionList: vi.fn(),
  sessionUpdate: vi.fn(),
  sessionDelete: vi.fn(),
  sessionRestore: vi.fn(),
  sessionAddDocument: vi.fn(),
  sessionRemoveDocument: vi.fn(),
  sessionUpdateDocument: vi.fn(),
  sessionTouch: vi.fn(),
}));

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
} from "../../lib/api/sessions";

const mockCreate = sessionCreate as ReturnType<typeof vi.fn>;
const mockGet = sessionGet as ReturnType<typeof vi.fn>;
const mockList = sessionList as ReturnType<typeof vi.fn>;
const mockUpdate = sessionUpdate as ReturnType<typeof vi.fn>;
const mockDelete = sessionDelete as ReturnType<typeof vi.fn>;
const mockRestore = sessionRestore as ReturnType<typeof vi.fn>;
const mockAddDocument = sessionAddDocument as ReturnType<typeof vi.fn>;
const mockRemoveDocument = sessionRemoveDocument as ReturnType<typeof vi.fn>;
const mockUpdateDocument = sessionUpdateDocument as ReturnType<typeof vi.fn>;
const mockTouch = sessionTouch as ReturnType<typeof vi.fn>;

describe("Session Lifecycle Integration", () => {
  const now = new Date().toISOString();

  const mockSession: ReadingSession = {
    id: "session-1",
    name: "Research Papers",
    documents: [
      {
        documentId: "doc-1",
        position: 0,
        currentPage: 5,
        scrollPosition: 100,
        createdAt: now,
        title: "Paper 1",
        pageCount: 20,
      },
      {
        documentId: "doc-2",
        position: 1,
        currentPage: 1,
        scrollPosition: 0,
        createdAt: now,
        title: "Paper 2",
        pageCount: 15,
      },
    ],
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
  };

  const mockSummaries: SessionSummary[] = [
    {
      id: "session-1",
      name: "Research Papers",
      documentCount: 2,
      lastAccessedAt: now,
      createdAt: now,
    },
    {
      id: "session-2",
      name: "Book Reading",
      documentCount: 1,
      lastAccessedAt: now,
      createdAt: now,
    },
  ];

  const mockRestoreResponse: SessionRestoreResponse = {
    success: true,
    session: mockSession,
    missingDocuments: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store
    useSessionStore.setState({
      sessions: [],
      isLoading: false,
      error: null,
      activeSession: null,
      activeSessionId: null,
      missingDocuments: [],
      isCreating: false,
      isRestoring: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Session Creation", () => {
    it("creates a new session via store", async () => {
      mockCreate.mockResolvedValue(mockSession);
      mockList.mockResolvedValue(mockSummaries);

      const store = useSessionStore.getState();
      const result = await store.createSession("Research Papers", [
        "doc-1",
        "doc-2",
      ]);

      expect(mockCreate).toHaveBeenCalledWith("Research Papers", [
        "doc-1",
        "doc-2",
      ]);
      expect(result.id).toBe("session-1");
      expect(result.name).toBe("Research Papers");
    });

    it("reloads session list after creation", async () => {
      mockCreate.mockResolvedValue(mockSession);
      mockList.mockResolvedValue(mockSummaries);

      const store = useSessionStore.getState();
      await store.createSession("Research Papers", ["doc-1", "doc-2"]);

      expect(mockList).toHaveBeenCalled();
    });

    it("handles creation errors", async () => {
      mockCreate.mockRejectedValue(new Error("Validation failed"));

      const store = useSessionStore.getState();

      await expect(store.createSession("", [])).rejects.toThrow(
        "Validation failed",
      );

      expect(useSessionStore.getState().error).toBe("Validation failed");
    });
  });

  describe("Session Listing", () => {
    it("loads sessions into store", async () => {
      mockList.mockResolvedValue(mockSummaries);

      const store = useSessionStore.getState();
      await store.loadSessions();

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(2);
      expect(state.sessions[0].name).toBe("Research Papers");
    });

    it("sets loading state during fetch", async () => {
      let resolveList: (value: SessionSummary[]) => void;
      mockList.mockReturnValue(
        new Promise((resolve) => {
          resolveList = resolve;
        }),
      );

      const store = useSessionStore.getState();
      const loadPromise = store.loadSessions();

      expect(useSessionStore.getState().isLoading).toBe(true);

      resolveList!(mockSummaries);
      await loadPromise;

      expect(useSessionStore.getState().isLoading).toBe(false);
    });

    it("handles empty session list", async () => {
      mockList.mockResolvedValue([]);

      const store = useSessionStore.getState();
      await store.loadSessions();

      expect(useSessionStore.getState().sessions).toHaveLength(0);
    });
  });

  describe("Session Restore", () => {
    it("restores a session and sets active", async () => {
      mockRestore.mockResolvedValue(mockRestoreResponse);
      mockList.mockResolvedValue(mockSummaries);

      const store = useSessionStore.getState();
      const result = await store.restoreSession("session-1");

      expect(mockRestore).toHaveBeenCalledWith("session-1");
      expect(result.session.id).toBe("session-1");

      const state = useSessionStore.getState();
      expect(state.activeSessionId).toBe("session-1");
      expect(state.activeSession).toEqual(mockSession);
    });

    it("reports missing documents after restore", async () => {
      const responseWithMissing: SessionRestoreResponse = {
        ...mockRestoreResponse,
        missingDocuments: ["doc-3", "doc-4"],
      };
      mockRestore.mockResolvedValue(responseWithMissing);
      mockList.mockResolvedValue(mockSummaries);

      const store = useSessionStore.getState();
      const result = await store.restoreSession("session-1");

      expect(result.missingDocuments).toEqual(["doc-3", "doc-4"]);
      expect(useSessionStore.getState().missingDocuments).toEqual([
        "doc-3",
        "doc-4",
      ]);
    });

    it("handles restore failure", async () => {
      mockRestore.mockRejectedValue(new Error("Session not found"));

      const store = useSessionStore.getState();

      await expect(store.restoreSession("non-existent")).rejects.toThrow(
        "Session not found",
      );

      expect(useSessionStore.getState().activeSession).toBeNull();
    });

    it("clears active session", () => {
      // Set up active session
      useSessionStore.setState({
        activeSession: mockSession,
        activeSessionId: "session-1",
        missingDocuments: ["doc-3"],
      });

      const store = useSessionStore.getState();
      store.clearActiveSession();

      const state = useSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.activeSessionId).toBeNull();
      expect(state.missingDocuments).toEqual([]);
    });
  });

  describe("Document Position Tracking", () => {
    it("updates document position in active session", async () => {
      mockUpdateDocument.mockResolvedValue(undefined);

      // Set up active session
      useSessionStore.setState({
        activeSession: mockSession,
        activeSessionId: "session-1",
      });

      const store = useSessionStore.getState();
      await store.updateDocumentInSession("session-1", "doc-1", 10, 500);

      expect(mockUpdateDocument).toHaveBeenCalledWith(
        "session-1",
        "doc-1",
        10,
        500,
      );

      // Store should update local state
      const state = useSessionStore.getState();
      const doc = state.activeSession?.documents.find(
        (d) => d.documentId === "doc-1",
      );
      expect(doc?.currentPage).toBe(10);
      expect(doc?.scrollPosition).toBe(500);
    });

    it("adds document to session", async () => {
      mockAddDocument.mockResolvedValue(undefined);
      mockGet.mockResolvedValue({
        ...mockSession,
        documents: [
          ...mockSession.documents,
          {
            documentId: "doc-3",
            position: 2,
            currentPage: 1,
            scrollPosition: 0,
            createdAt: now,
          },
        ],
      });

      useSessionStore.setState({
        sessions: mockSummaries,
        activeSession: mockSession,
        activeSessionId: "session-1",
      });

      const store = useSessionStore.getState();
      await store.addDocumentToSession("session-1", "doc-3", 2);

      expect(mockAddDocument).toHaveBeenCalledWith("session-1", "doc-3", 2);
    });

    it("removes document from session", async () => {
      mockRemoveDocument.mockResolvedValue(undefined);
      mockGet.mockResolvedValue({
        ...mockSession,
        documents: mockSession.documents.filter(
          (d) => d.documentId !== "doc-2",
        ),
      });

      useSessionStore.setState({
        sessions: mockSummaries,
        activeSession: mockSession,
        activeSessionId: "session-1",
      });

      const store = useSessionStore.getState();
      await store.removeDocumentFromSession("session-1", "doc-2");

      expect(mockRemoveDocument).toHaveBeenCalledWith("session-1", "doc-2");
    });
  });

  describe("Session Update", () => {
    it("updates session name", async () => {
      const updatedSession = { ...mockSession, name: "Updated Name" };
      mockUpdate.mockResolvedValue(updatedSession);

      useSessionStore.setState({ sessions: mockSummaries });

      const store = useSessionStore.getState();
      const result = await store.updateSession("session-1", "Updated Name");

      expect(mockUpdate).toHaveBeenCalledWith(
        "session-1",
        "Updated Name",
        undefined,
      );
      expect(result.name).toBe("Updated Name");
    });

    it("updates active session when it is the one being updated", async () => {
      const updatedSession = { ...mockSession, name: "Updated Name" };
      mockUpdate.mockResolvedValue(updatedSession);

      useSessionStore.setState({
        sessions: mockSummaries,
        activeSession: mockSession,
        activeSessionId: "session-1",
      });

      const store = useSessionStore.getState();
      await store.updateSession("session-1", "Updated Name");

      expect(useSessionStore.getState().activeSession?.name).toBe(
        "Updated Name",
      );
    });
  });

  describe("Session Deletion", () => {
    it("deletes session and removes from list", async () => {
      mockDelete.mockResolvedValue(undefined);

      useSessionStore.setState({ sessions: mockSummaries });

      const store = useSessionStore.getState();
      await store.deleteSession("session-1");

      expect(mockDelete).toHaveBeenCalledWith("session-1");

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe("session-2");
    });

    it("clears active session if deleted", async () => {
      mockDelete.mockResolvedValue(undefined);

      useSessionStore.setState({
        sessions: mockSummaries,
        activeSession: mockSession,
        activeSessionId: "session-1",
      });

      const store = useSessionStore.getState();
      await store.deleteSession("session-1");

      const state = useSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.activeSessionId).toBeNull();
    });
  });

  describe("Session Touch", () => {
    it("updates last accessed time", async () => {
      mockTouch.mockResolvedValue(undefined);
      mockList.mockResolvedValue(mockSummaries);

      const store = useSessionStore.getState();
      await store.touchSession("session-1");

      expect(mockTouch).toHaveBeenCalledWith("session-1");
      expect(mockList).toHaveBeenCalled(); // Reloads to update order
    });
  });

  describe("Full Lifecycle Flow", () => {
    it("complete session lifecycle: create -> restore -> update -> close", async () => {
      // 1. Create session
      mockCreate.mockResolvedValue(mockSession);
      mockList.mockResolvedValue(mockSummaries);

      let store = useSessionStore.getState();
      const created = await store.createSession("Research Papers", [
        "doc-1",
        "doc-2",
      ]);
      expect(created.id).toBe("session-1");

      // 2. Load sessions
      await store.loadSessions();
      expect(useSessionStore.getState().sessions).toHaveLength(2);

      // 3. Restore session
      mockRestore.mockResolvedValue(mockRestoreResponse);
      store = useSessionStore.getState();
      await store.restoreSession("session-1");
      expect(useSessionStore.getState().activeSessionId).toBe("session-1");

      // 4. Update document position
      mockUpdateDocument.mockResolvedValue(undefined);
      store = useSessionStore.getState();
      await store.updateDocumentInSession("session-1", "doc-1", 15, 750);

      const doc = useSessionStore
        .getState()
        .activeSession?.documents.find((d) => d.documentId === "doc-1");
      expect(doc?.currentPage).toBe(15);

      // 5. Clear active session (close)
      store = useSessionStore.getState();
      store.clearActiveSession();
      expect(useSessionStore.getState().activeSession).toBeNull();
    });
  });

  describe("Store Reset", () => {
    it("resets all state", () => {
      useSessionStore.setState({
        sessions: mockSummaries,
        isLoading: true,
        error: "Some error",
        activeSession: mockSession,
        activeSessionId: "session-1",
        missingDocuments: ["doc-3"],
        isCreating: true,
        isRestoring: true,
      });

      const store = useSessionStore.getState();
      store.reset();

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.activeSession).toBeNull();
      expect(state.activeSessionId).toBeNull();
      expect(state.missingDocuments).toHaveLength(0);
    });
  });
});
