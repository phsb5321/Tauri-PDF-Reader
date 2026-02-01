/**
 * Tests for SessionMenu component (T058)
 *
 * Verifies:
 * - Renders session list from store
 * - Shows loading state while fetching sessions
 * - Shows empty state when no sessions
 * - Handles create session action
 * - Handles restore session action
 * - Handles delete session with confirmation
 * - Shows active session indicator
 * - Shows error state with retry
 * - Shows restoring indicator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SessionMenu } from "../../components/session-menu/SessionMenu";
import { useSessionStore } from "../../stores/session-store";
import type {
  SessionSummary,
  SessionRestoreResponse,
} from "../../domain/sessions/session";

// Mock the session store
vi.mock("../../stores/session-store", () => ({
  useSessionStore: vi.fn(),
}));

// Mock CreateSessionDialog to simplify testing
vi.mock("../../components/session-menu/CreateSessionDialog", () => ({
  CreateSessionDialog: vi.fn(({ isOpen, onClose, onCreate }) =>
    isOpen ? (
      <div data-testid="create-session-dialog">
        <button type="button" onClick={() => onCreate("Test Session", [])}>
          Create Mock
        </button>
        <button type="button" onClick={onClose}>
          Close Dialog
        </button>
      </div>
    ) : null,
  ),
}));

const mockUseSessionStore = useSessionStore as unknown as ReturnType<
  typeof vi.fn
>;

describe("SessionMenu", () => {
  const mockSessions: SessionSummary[] = [
    {
      id: "session-1",
      name: "Research Papers",
      documentCount: 3,
      lastAccessedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: "session-2",
      name: "Book Reading",
      documentCount: 1,
      lastAccessedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const mockRestoreResponse: SessionRestoreResponse = {
    success: true,
    session: {
      id: "session-1",
      name: "Research Papers",
      documents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
    },
    missingDocuments: [],
  };

  const mockLoadSessions = vi.fn();
  const mockCreateSession = vi.fn();
  const mockDeleteSession = vi.fn();
  const mockRestoreSession = vi.fn();
  const mockClearActiveSession = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnSessionRestored = vi.fn();

  function setupMockStore(
    overrides: Partial<ReturnType<typeof useSessionStore>> = {},
  ) {
    const defaultState = {
      sessions: [] as SessionSummary[],
      isLoading: false,
      error: null as string | null,
      activeSessionId: null as string | null,
      isRestoring: false,
      loadSessions: mockLoadSessions,
      createSession: mockCreateSession,
      deleteSession: mockDeleteSession,
      restoreSession: mockRestoreSession,
      clearActiveSession: mockClearActiveSession,
      ...overrides,
    };

    mockUseSessionStore.mockReturnValue(defaultState);
    return defaultState;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupMockStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering states", () => {
    it("renders nothing when isOpen is false", () => {
      render(<SessionMenu isOpen={false} onClose={mockOnClose} />);

      expect(screen.queryByText("Reading Sessions")).not.toBeInTheDocument();
    });

    it("renders panel when isOpen is true", () => {
      setupMockStore({ sessions: mockSessions });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText("Reading Sessions")).toBeInTheDocument();
    });

    it("loads sessions when panel opens", () => {
      setupMockStore();

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      expect(mockLoadSessions).toHaveBeenCalledTimes(1);
    });

    it("shows loading state", () => {
      setupMockStore({ isLoading: true });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText("Loading sessions...")).toBeInTheDocument();
    });

    it("shows empty state when no sessions", () => {
      setupMockStore({ sessions: [] });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText("No reading sessions")).toBeInTheDocument();
      expect(
        screen.getByText(/Create a session to save your reading progress/),
      ).toBeInTheDocument();
    });

    it("shows session list when sessions exist", () => {
      setupMockStore({ sessions: mockSessions });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText("Research Papers")).toBeInTheDocument();
      expect(screen.getByText("Book Reading")).toBeInTheDocument();
      expect(screen.getByText("3 documents")).toBeInTheDocument();
      expect(screen.getByText("1 document")).toBeInTheDocument();
    });

    it("shows error state with retry button", () => {
      setupMockStore({ error: "Failed to load sessions" });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText("Failed to load sessions")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /retry/i }),
      ).toBeInTheDocument();
    });

    it("calls loadSessions when retry button clicked", () => {
      setupMockStore({ error: "Failed to load sessions" });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
      // Called once on mount and once on retry
      expect(mockLoadSessions).toHaveBeenCalledTimes(2);
    });

    it("shows restoring indicator", () => {
      setupMockStore({ sessions: mockSessions, isRestoring: true });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText("Restoring session...")).toBeInTheDocument();
    });
  });

  describe("active session", () => {
    it("shows active session indicator when a session is active", () => {
      setupMockStore({ sessions: mockSessions, activeSessionId: "session-1" });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText("Active session")).toBeInTheDocument();
    });

    it("shows close button for active session", () => {
      setupMockStore({ sessions: mockSessions, activeSessionId: "session-1" });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      // The Close button in the active indicator area
      const closeButtons = screen.getAllByRole("button", { name: /close/i });
      expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("calls clearActiveSession when close button clicked", () => {
      setupMockStore({ sessions: mockSessions, activeSessionId: "session-1" });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      // Find the Close button within the active indicator (not the panel close)
      const closeButton = screen.getByRole("button", { name: "Close" });
      fireEvent.click(closeButton);

      expect(mockClearActiveSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("create session", () => {
    it("shows New Session button in header", () => {
      setupMockStore({ sessions: mockSessions });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      expect(
        screen.getByRole("button", { name: /new session/i }),
      ).toBeInTheDocument();
    });

    it("disables New Session button when loading", () => {
      setupMockStore({ isLoading: true });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      expect(
        screen.getByRole("button", { name: /new session/i }),
      ).toBeDisabled();
    });

    it("opens create dialog when New Session clicked", () => {
      setupMockStore({ sessions: mockSessions });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole("button", { name: /new session/i }));

      expect(screen.getByTestId("create-session-dialog")).toBeInTheDocument();
    });

    it("opens create dialog from empty state action", () => {
      setupMockStore({ sessions: [] });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole("button", { name: /create session/i }));

      expect(screen.getByTestId("create-session-dialog")).toBeInTheDocument();
    });

    it("calls createSession when dialog submits", async () => {
      mockCreateSession.mockResolvedValue({});
      setupMockStore({ sessions: mockSessions });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole("button", { name: /new session/i }));

      await act(async () => {
        fireEvent.click(screen.getByText("Create Mock"));
      });

      expect(mockCreateSession).toHaveBeenCalledWith("Test Session", []);
    });
  });

  describe("restore session", () => {
    it("calls restoreSession when session item clicked", async () => {
      mockRestoreSession.mockResolvedValue(mockRestoreResponse);
      setupMockStore({ sessions: mockSessions });

      render(
        <SessionMenu
          isOpen={true}
          onClose={mockOnClose}
          onSessionRestored={mockOnSessionRestored}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Research Papers"));
      });

      expect(mockRestoreSession).toHaveBeenCalledWith("session-1");
    });

    it("calls onSessionRestored callback after successful restore", async () => {
      mockRestoreSession.mockResolvedValue(mockRestoreResponse);
      setupMockStore({ sessions: mockSessions });

      render(
        <SessionMenu
          isOpen={true}
          onClose={mockOnClose}
          onSessionRestored={mockOnSessionRestored}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Research Papers"));
      });

      expect(mockOnSessionRestored).toHaveBeenCalledWith("session-1");
    });

    it("handles restore failure gracefully", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockRestoreSession.mockRejectedValue(new Error("Network error"));
      setupMockStore({ sessions: mockSessions });

      render(
        <SessionMenu
          isOpen={true}
          onClose={mockOnClose}
          onSessionRestored={mockOnSessionRestored}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Research Papers"));
      });

      expect(consoleError).toHaveBeenCalled();
      expect(mockOnSessionRestored).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("warns about missing documents after restore", async () => {
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const responseWithMissing: SessionRestoreResponse = {
        ...mockRestoreResponse,
        missingDocuments: ["doc-1", "doc-2"],
      };
      mockRestoreSession.mockResolvedValue(responseWithMissing);
      setupMockStore({ sessions: mockSessions });

      render(
        <SessionMenu
          isOpen={true}
          onClose={mockOnClose}
          onSessionRestored={mockOnSessionRestored}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Research Papers"));
      });

      expect(consoleWarn).toHaveBeenCalledWith("Missing documents:", [
        "doc-1",
        "doc-2",
      ]);
      consoleWarn.mockRestore();
    });
  });

  describe("delete session", () => {
    it("shows delete confirmation on first click", () => {
      setupMockStore({ sessions: mockSessions });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      const deleteButtons = screen.getAllByRole("button", {
        name: /delete session/i,
      });
      fireEvent.click(deleteButtons[0]);

      // Should show confirmation message, not delete yet
      expect(mockDeleteSession).not.toHaveBeenCalled();
      expect(
        screen.getByText("Click again to confirm delete"),
      ).toBeInTheDocument();
    });

    it("deletes session on second click (confirmation)", async () => {
      mockDeleteSession.mockResolvedValue(undefined);
      setupMockStore({ sessions: mockSessions });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      const deleteButtons = screen.getAllByRole("button", {
        name: /delete session/i,
      });

      // First click - sets confirmation
      fireEvent.click(deleteButtons[0]);
      expect(mockDeleteSession).not.toHaveBeenCalled();

      // Second click - confirms delete
      await act(async () => {
        fireEvent.click(deleteButtons[0]);
      });

      expect(mockDeleteSession).toHaveBeenCalledWith("session-1");
    });

    it("clears delete confirmation after timeout", async () => {
      vi.useFakeTimers();
      setupMockStore({ sessions: mockSessions });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      const deleteButtons = screen.getAllByRole("button", {
        name: /delete session/i,
      });
      fireEvent.click(deleteButtons[0]);

      expect(
        screen.getByText("Click again to confirm delete"),
      ).toBeInTheDocument();

      // Advance timers past the 3 second timeout
      await act(async () => {
        vi.advanceTimersByTime(3100);
      });

      expect(
        screen.queryByText("Click again to confirm delete"),
      ).not.toBeInTheDocument();
      vi.useRealTimers();
    });
  });

  describe("panel interactions", () => {
    it("calls onClose when panel close button clicked", () => {
      setupMockStore({ sessions: mockSessions });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      // Find the panel's close button (aria-label: Close panel or similar)
      const closeButton = screen.getByRole("button", { name: /close panel/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("has proper list role for session list", () => {
      setupMockStore({ sessions: mockSessions });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole("list")).toBeInTheDocument();
    });

    it("panel has proper aria attributes", () => {
      setupMockStore({ sessions: mockSessions });

      render(<SessionMenu isOpen={true} onClose={mockOnClose} />);

      const panel = screen.getByRole("complementary");
      expect(panel).toHaveAttribute("aria-label", "Reading Sessions");
    });
  });
});
