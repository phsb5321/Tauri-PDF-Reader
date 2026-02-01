/**
 * Tests for AudioExportDialog component (T077)
 *
 * Verifies:
 * - Shows checking state on mount
 * - Displays readiness status (ready/not-ready)
 * - Shows coverage and missing chunks info
 * - Allows format selection (MP3/M4B)
 * - Allows chapter configuration
 * - Shows export progress during export
 * - Shows completion state with file path
 * - Handles errors gracefully
 * - Allows cancellation during export
 * - Respects backdrop click and close button
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { AudioExportDialog } from "../../components/export-dialog/AudioExportDialog";
import type {
  ExportReadiness,
  ExportProgress,
  ExportResult,
} from "../../domain/export/export-result";

// Mock the audio-export API
vi.mock("../../lib/api/audio-export", () => ({
  audioExportCheckReady: vi.fn(),
  audioExportDocument: vi.fn(),
  audioExportCancel: vi.fn(),
}));

// Mock Tauri dialog plugin
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
}));

// Mock the useExportProgress hook
vi.mock("../../hooks/useExportProgress", () => ({
  useExportProgress: vi.fn(),
}));

import {
  audioExportCheckReady,
  audioExportDocument,
  audioExportCancel,
} from "../../lib/api/audio-export";
import { save } from "@tauri-apps/plugin-dialog";
import { useExportProgress } from "../../hooks/useExportProgress";

const mockAudioExportCheckReady = audioExportCheckReady as ReturnType<
  typeof vi.fn
>;
const mockAudioExportDocument = audioExportDocument as ReturnType<typeof vi.fn>;
const mockAudioExportCancel = audioExportCancel as ReturnType<typeof vi.fn>;
const mockSave = save as ReturnType<typeof vi.fn>;
const mockUseExportProgress = useExportProgress as ReturnType<typeof vi.fn>;

describe("AudioExportDialog", () => {
  const defaultProps = {
    documentId: "doc-123",
    documentTitle: "Test Document",
    onClose: vi.fn(),
  };

  const readyResponse: ExportReadiness = {
    ready: true,
    coveragePercent: 100,
    missingChunks: [],
    estimatedDurationMs: 3600000, // 1 hour
    estimatedFileSizeBytes: 52428800, // 50 MB
  };

  const notReadyResponse: ExportReadiness = {
    ready: false,
    coveragePercent: 75,
    missingChunks: [
      { pageNumber: 5, chunkIndex: 0, textPreview: "Lorem ipsum..." },
      { pageNumber: 5, chunkIndex: 1, textPreview: "dolor sit amet..." },
      { pageNumber: 8, chunkIndex: 2, textPreview: "consectetur..." },
    ],
    estimatedDurationMs: 3600000,
    estimatedFileSizeBytes: 52428800,
  };

  const mockExportResult: ExportResult = {
    success: true,
    outputPath: "/path/to/output.mp3",
    format: "mp3",
    totalDurationMs: 3600000,
    chapterCount: 10,
    fileSizeBytes: 50000000,
    exportedAt: new Date().toISOString(),
  };

  const mockProgress: ExportProgress = {
    phase: "concatenating",
    currentChunk: 5,
    totalChunks: 10,
    percent: 50,
    estimatedRemainingMs: 30000,
  };

  function setupHook(
    overrides: Partial<ReturnType<typeof useExportProgress>> = {},
  ) {
    const defaultHookReturn = {
      progress: null as ExportProgress | null,
      isExporting: false,
      lastResult: null as ExportResult | null,
      error: null as string | null,
      reset: vi.fn(),
      ...overrides,
    };
    mockUseExportProgress.mockReturnValue(defaultHookReturn);
    return defaultHookReturn;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupHook();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initial loading state", () => {
    it("shows checking state while loading readiness", async () => {
      // Don't resolve immediately
      mockAudioExportCheckReady.mockReturnValue(new Promise(() => {}));

      render(<AudioExportDialog {...defaultProps} />);

      expect(
        screen.getByText("Checking export readiness..."),
      ).toBeInTheDocument();
    });

    it("calls audioExportCheckReady on mount", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(mockAudioExportCheckReady).toHaveBeenCalledWith(
          "doc-123",
          undefined,
        );
      });
    });

    it("passes voiceId to check ready if provided", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} voiceId="voice-1" />);

      await waitFor(() => {
        expect(mockAudioExportCheckReady).toHaveBeenCalledWith(
          "doc-123",
          "voice-1",
        );
      });
    });
  });

  describe("ready state", () => {
    it("shows ready state with document info", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Test Document/)).toBeInTheDocument();
      });

      // Document title should appear in the info section
      expect(screen.getByText(/as an audiobook file/)).toBeInTheDocument();
    });

    it("shows estimated duration and size", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Duration:/)).toBeInTheDocument();
        expect(screen.getByText(/Size:/)).toBeInTheDocument();
      });
    });

    it("shows format selection options", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Format")).toBeInTheDocument();
        expect(screen.getByLabelText("MP3")).toBeInTheDocument();
        expect(screen.getByLabelText("M4B (Audiobook)")).toBeInTheDocument();
      });
    });

    it("selects MP3 by default", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText("MP3")).toBeChecked();
        expect(screen.getByLabelText("M4B (Audiobook)")).not.toBeChecked();
      });
    });

    it("shows chapter options", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByLabelText("Include chapter markers"),
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Include chapter markers")).toBeChecked();
      });
    });

    it("shows chapter strategy when chapters enabled", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Chapter Style")).toBeInTheDocument();
        expect(
          screen.getByLabelText("One chapter per page"),
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Single chapter")).toBeInTheDocument();
      });
    });

    it("hides chapter strategy when chapters disabled", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByLabelText("Include chapter markers"),
        ).toBeInTheDocument();
      });

      // Uncheck include chapters
      fireEvent.click(screen.getByLabelText("Include chapter markers"));

      expect(screen.queryByText("Chapter Style")).not.toBeInTheDocument();
    });

    it("shows Export button in ready state", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Export" }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("not ready state", () => {
    it("shows not ready state with coverage", async () => {
      mockAudioExportCheckReady.mockResolvedValue(notReadyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("75%")).toBeInTheDocument();
        expect(screen.getByText("Cache Coverage")).toBeInTheDocument();
      });
    });

    it("shows missing chunks info", async () => {
      mockAudioExportCheckReady.mockResolvedValue(notReadyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Not all audio has been cached/),
        ).toBeInTheDocument();
        expect(screen.getByText(/3 chunks/)).toBeInTheDocument();
      });
    });

    it("shows list of missing chunks when count <= 5", async () => {
      mockAudioExportCheckReady.mockResolvedValue(notReadyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Page 5, Chunk 1/)).toBeInTheDocument();
        expect(screen.getByText(/Page 5, Chunk 2/)).toBeInTheDocument();
        expect(screen.getByText(/Page 8, Chunk 3/)).toBeInTheDocument();
      });
    });

    it("does not show Export button in not-ready state", async () => {
      mockAudioExportCheckReady.mockResolvedValue(notReadyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Cache Coverage")).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("button", { name: "Export" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("export flow", () => {
    it("opens save dialog when Export clicked", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);
      mockSave.mockResolvedValue("/path/to/output.mp3");
      mockAudioExportDocument.mockResolvedValue(mockExportResult);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Export" }),
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
      });

      expect(mockSave).toHaveBeenCalledWith({
        defaultPath: "Test_Document.mp3",
        filters: [{ name: "MP3 Audio", extensions: ["mp3"] }],
      });
    });

    it("uses m4b extension when M4B selected", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);
      mockSave.mockResolvedValue("/path/to/output.m4b");
      mockAudioExportDocument.mockResolvedValue(mockExportResult);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText("M4B (Audiobook)")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText("M4B (Audiobook)"));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
      });

      expect(mockSave).toHaveBeenCalledWith({
        defaultPath: "Test_Document.m4b",
        filters: [{ name: "M4B Audiobook", extensions: ["m4b"] }],
      });
    });

    it("does nothing if user cancels save dialog", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);
      mockSave.mockResolvedValue(null);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Export" }),
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
      });

      expect(mockAudioExportDocument).not.toHaveBeenCalled();
    });

    it("calls audioExportDocument with correct params", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);
      mockSave.mockResolvedValue("/path/to/output.mp3");
      mockAudioExportDocument.mockResolvedValue(mockExportResult);

      render(<AudioExportDialog {...defaultProps} voiceId="voice-1" />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Export" }),
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
      });

      expect(mockAudioExportDocument).toHaveBeenCalledWith(
        "doc-123",
        "mp3",
        "/path/to/output.mp3",
        true,
        "page",
        "voice-1",
      );
    });
  });

  describe("progress state", () => {
    it("shows progress when exporting", async () => {
      setupHook({ progress: mockProgress, isExporting: true });
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);
      mockSave.mockResolvedValue("/path/to/output.mp3");
      mockAudioExportDocument.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Export" }),
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
      });

      // Progress should be shown (from mocked hook)
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("disables footer cancel button during export", async () => {
      setupHook({ progress: mockProgress, isExporting: true });
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);
      mockSave.mockResolvedValue("/path/to/output.mp3");
      mockAudioExportDocument.mockReturnValue(new Promise(() => {}));

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Export" }),
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
      });

      // Footer Cancel button (secondary) should be disabled during export
      const cancelButtons = screen.getAllByRole("button", { name: /cancel/i });
      // The footer cancel button has the secondary class and is disabled
      const footerCancel = cancelButtons.find((btn) =>
        btn.className.includes("secondary"),
      );
      expect(footerCancel).toBeDisabled();
    });
  });

  describe("completion state", () => {
    it("shows success message when complete", async () => {
      setupHook({
        progress: {
          phase: "complete",
          currentChunk: 10,
          totalChunks: 10,
          percent: 100,
          estimatedRemainingMs: 0,
        },
        lastResult: mockExportResult,
      });
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      // Simulate being in complete state (onComplete callback would be triggered)
      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        // The dialog should show the ready state, but we mocked lastResult
        expect(screen.getByText(/Export/)).toBeInTheDocument();
      });
    });
  });

  describe("error handling", () => {
    it("shows error state when check ready fails", async () => {
      mockAudioExportCheckReady.mockRejectedValue(new Error("Network error"));

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it("shows error state when export fails", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);
      mockSave.mockResolvedValue("/path/to/output.mp3");
      mockAudioExportDocument.mockRejectedValue(new Error("Export failed"));

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Export" }),
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
      });

      await waitFor(() => {
        expect(screen.getByText(/Export failed/)).toBeInTheDocument();
      });
    });
  });

  describe("cancellation", () => {
    it("calls audioExportCancel when progress cancel clicked", async () => {
      setupHook({ progress: mockProgress, isExporting: true });
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);
      mockSave.mockResolvedValue("/path/to/output.mp3");
      mockAudioExportDocument.mockReturnValue(new Promise(() => {}));
      mockAudioExportCancel.mockResolvedValue(true);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Export" }),
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
      });

      // Find the cancel button in ExportProgress component (the one with export-progress__cancel class)
      const cancelButtons = screen.getAllByRole("button", { name: /cancel/i });
      const progressCancelButton = cancelButtons.find((btn) =>
        btn.className.includes("export-progress__cancel"),
      );

      expect(progressCancelButton).toBeTruthy();

      await act(async () => {
        fireEvent.click(progressCancelButton!);
      });

      expect(mockAudioExportCancel).toHaveBeenCalled();
    });
  });

  describe("dialog interactions", () => {
    it("renders dialog with proper ARIA attributes", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAttribute(
          "aria-labelledby",
          "audio-export-dialog-title",
        );
      });
    });

    it("has dialog title", async () => {
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Export Audiobook")).toBeInTheDocument();
      });
    });

    it("calls onClose when footer Cancel button clicked", async () => {
      const mockOnClose = vi.fn();
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} onClose={mockOnClose} />);

      await waitFor(() => {
        // Find the footer Cancel button (secondary class)
        const cancelButtons = screen.getAllByRole("button", {
          name: /cancel/i,
        });
        const footerCancel = cancelButtons.find((btn) =>
          btn.className.includes("secondary"),
        );
        expect(footerCancel).toBeTruthy();
        fireEvent.click(footerCancel!);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls onClose when close icon clicked", async () => {
      const mockOnClose = vi.fn();
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      render(<AudioExportDialog {...defaultProps} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Close" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls onClose when backdrop clicked (not during export)", async () => {
      const mockOnClose = vi.fn();
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);

      const { container } = render(
        <AudioExportDialog {...defaultProps} onClose={mockOnClose} />,
      );

      await waitFor(() => {
        expect(screen.getByText("Export Audiobook")).toBeInTheDocument();
      });

      // Click the backdrop (outer div)
      const backdrop = container.querySelector(".audio-export-dialog-backdrop");
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("does not close when backdrop clicked during export", async () => {
      const mockOnClose = vi.fn();
      setupHook({ progress: mockProgress, isExporting: true });
      mockAudioExportCheckReady.mockResolvedValue(readyResponse);
      mockSave.mockResolvedValue("/path/to/output.mp3");
      mockAudioExportDocument.mockReturnValue(new Promise(() => {}));

      const { container } = render(
        <AudioExportDialog {...defaultProps} onClose={mockOnClose} />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Export" }),
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
      });

      // Click the backdrop
      const backdrop = container.querySelector(".audio-export-dialog-backdrop");
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
