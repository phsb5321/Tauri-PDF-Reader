/**
 * Tests for AudioCacheProgress component (T044)
 *
 * Verifies:
 * - Displays coverage information from store
 * - Shows loading state while fetching coverage
 * - Updates when coverage changes via event
 * - Shows document-specific coverage info
 * - Handles missing/null coverage gracefully
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AudioCacheProgress } from "../../components/audio-progress/AudioCacheProgress";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import type { CoverageResponse } from "../../lib/api/audio-cache";

// Mock the audio-cache API
vi.mock("../../lib/api/audio-cache", () => ({
  audioCacheGetCoverage: vi.fn(),
  onCoverageUpdated: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock the store
vi.mock("../../stores/ai-tts-store", () => ({
  useAiTtsStore: vi.fn(),
}));

const mockUseAiTtsStore = useAiTtsStore as unknown as ReturnType<typeof vi.fn>;

describe("AudioCacheProgress", () => {
  const mockCoverage: CoverageResponse = {
    documentId: "doc-123",
    totalChunks: 100,
    cachedChunks: 50,
    coveragePercent: 50,
    totalDurationMs: 300000,
    cachedSizeBytes: 5242880,
  };

  const mockSetCacheCoverage = vi.fn();

  function mockCoverageState(cacheCoverage: CoverageResponse | null) {
    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) =>
        selector({ cacheCoverage, setCacheCoverage: mockSetCacheCoverage }),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockCoverageState(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<AudioCacheProgress documentId="doc-123" />);
    expect(screen.getByTestId("audio-cache-progress")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<AudioCacheProgress documentId="doc-123" />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("displays coverage percentage when data is available", async () => {
    mockCoverageState(mockCoverage);

    render(<AudioCacheProgress documentId="doc-123" />);

    await waitFor(() => {
      const progress = screen.getByRole("progressbar");
      expect(progress).toHaveAttribute("value", "50");
      expect(progress).toHaveAttribute("max", "100");
    });
  });

  it("shows 100% complete state", async () => {
    const fullyCachedCoverage: CoverageResponse = {
      ...mockCoverage,
      cachedChunks: 100,
      coveragePercent: 100,
    };

    mockCoverageState(fullyCachedCoverage);

    render(<AudioCacheProgress documentId="doc-123" />);

    await waitFor(() => {
      const progress = screen.getByRole("progressbar");
      expect(progress).toHaveAttribute("value", "100");
      expect(progress.parentElement).toHaveClass(
        "cache-progress-bar--complete",
      );
    });
  });

  it("shows 0% when no audio is cached", async () => {
    const emptyCache: CoverageResponse = {
      ...mockCoverage,
      cachedChunks: 0,
      coveragePercent: 0,
      totalDurationMs: 0,
      cachedSizeBytes: 0,
    };

    mockCoverageState(emptyCache);

    render(<AudioCacheProgress documentId="doc-123" />);

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toHaveAttribute("value", "0");
    });
  });

  it("displays chunk count details when showDetails is true", async () => {
    mockCoverageState(mockCoverage);

    render(<AudioCacheProgress documentId="doc-123" showDetails />);

    await waitFor(() => {
      expect(screen.getByText(/50.*\/.*100/)).toBeInTheDocument();
    });
  });

  it("hides details when showDetails is false", async () => {
    mockCoverageState(mockCoverage);

    render(<AudioCacheProgress documentId="doc-123" showDetails={false} />);

    await waitFor(() => {
      expect(screen.queryByText(/50.*\/.*100/)).not.toBeInTheDocument();
    });
  });

  it("applies compact variant styling", async () => {
    mockCoverageState(mockCoverage);

    render(<AudioCacheProgress documentId="doc-123" variant="compact" />);

    await waitFor(() => {
      const container = screen.getByTestId("audio-cache-progress");
      expect(container).toHaveClass("audio-cache-progress--compact");
    });
  });

  it("shows different coverage for different documents", async () => {
    const doc1Coverage: CoverageResponse = {
      ...mockCoverage,
      documentId: "doc-1",
      coveragePercent: 30,
    };

    mockCoverageState(doc1Coverage);

    const { rerender } = render(<AudioCacheProgress documentId="doc-1" />);

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toHaveAttribute("value", "30");
    });

    const doc2Coverage: CoverageResponse = {
      ...mockCoverage,
      documentId: "doc-2",
      coveragePercent: 70,
    };

    mockCoverageState(doc2Coverage);

    rerender(<AudioCacheProgress documentId="doc-2" />);

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toHaveAttribute("value", "70");
    });
  });

  it("handles null coverage gracefully", async () => {
    mockCoverageState(null);

    render(<AudioCacheProgress documentId="doc-123" />);

    // Should show loading or empty state, not crash
    expect(screen.getByTestId("audio-cache-progress")).toBeInTheDocument();
  });

  it("provides accessible status updates", async () => {
    mockCoverageState(mockCoverage);

    render(<AudioCacheProgress documentId="doc-123" />);

    await waitFor(() => {
      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toHaveAttribute("aria-label");
    });
  });
});
