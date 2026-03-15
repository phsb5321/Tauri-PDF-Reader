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

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          cacheCoverage: null as CoverageResponse | null,
          setCacheCoverage: mockSetCacheCoverage,
        };
        return selector(state);
      },
    );
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
    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          cacheCoverage: mockCoverage,
          setCacheCoverage: mockSetCacheCoverage,
        };
        return selector(state);
      },
    );

    render(<AudioCacheProgress documentId="doc-123" />);

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "50",
      );
    });
  });

  it("shows 100% complete state", async () => {
    const fullyCachedCoverage: CoverageResponse = {
      ...mockCoverage,
      cachedChunks: 100,
      coveragePercent: 100,
    };

    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          cacheCoverage: fullyCachedCoverage,
          setCacheCoverage: mockSetCacheCoverage,
        };
        return selector(state);
      },
    );

    render(<AudioCacheProgress documentId="doc-123" />);

    await waitFor(() => {
      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toHaveAttribute("aria-valuenow", "100");
      expect(progressBar).toHaveClass("cache-progress-bar--complete");
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

    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          cacheCoverage: emptyCache,
          setCacheCoverage: mockSetCacheCoverage,
        };
        return selector(state);
      },
    );

    render(<AudioCacheProgress documentId="doc-123" />);

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "0",
      );
    });
  });

  it("displays chunk count details when showDetails is true", async () => {
    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          cacheCoverage: mockCoverage,
          setCacheCoverage: mockSetCacheCoverage,
        };
        return selector(state);
      },
    );

    render(<AudioCacheProgress documentId="doc-123" showDetails />);

    await waitFor(() => {
      expect(screen.getByText(/50.*\/.*100/)).toBeInTheDocument();
    });
  });

  it("hides details when showDetails is false", async () => {
    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          cacheCoverage: mockCoverage,
          setCacheCoverage: mockSetCacheCoverage,
        };
        return selector(state);
      },
    );

    render(<AudioCacheProgress documentId="doc-123" showDetails={false} />);

    await waitFor(() => {
      expect(screen.queryByText(/50.*\/.*100/)).not.toBeInTheDocument();
    });
  });

  it("applies compact variant styling", async () => {
    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          cacheCoverage: mockCoverage,
          setCacheCoverage: mockSetCacheCoverage,
        };
        return selector(state);
      },
    );

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

    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          cacheCoverage: doc1Coverage,
          setCacheCoverage: mockSetCacheCoverage,
        };
        return selector(state);
      },
    );

    const { rerender } = render(<AudioCacheProgress documentId="doc-1" />);

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "30",
      );
    });

    const doc2Coverage: CoverageResponse = {
      ...mockCoverage,
      documentId: "doc-2",
      coveragePercent: 70,
    };

    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          cacheCoverage: doc2Coverage,
          setCacheCoverage: mockSetCacheCoverage,
        };
        return selector(state);
      },
    );

    rerender(<AudioCacheProgress documentId="doc-2" />);

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "70",
      );
    });
  });

  it("handles null coverage gracefully", async () => {
    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          cacheCoverage: null,
          setCacheCoverage: mockSetCacheCoverage,
        };
        return selector(state);
      },
    );

    render(<AudioCacheProgress documentId="doc-123" />);

    // Should show loading or empty state, not crash
    expect(screen.getByTestId("audio-cache-progress")).toBeInTheDocument();
  });

  it("provides accessible status updates", async () => {
    mockUseAiTtsStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          cacheCoverage: mockCoverage,
          setCacheCoverage: mockSetCacheCoverage,
        };
        return selector(state);
      },
    );

    render(<AudioCacheProgress documentId="doc-123" />);

    await waitFor(() => {
      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toHaveAttribute("aria-label");
    });
  });
});
