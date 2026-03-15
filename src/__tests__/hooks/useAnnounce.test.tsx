/**
 * useAnnounce Hook Tests
 *
 * Tests for screen reader announcements via aria-live region.
 * Ensures accessible feedback for dynamic content changes.
 *
 * @feature 007-ui-ux-overhaul (P0-4)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useAnnounce, ANNOUNCEMENTS } from "../../hooks/useAnnounce.js";

/**
 * Test component that uses the useAnnounce hook
 */
function TestComponent({
  defaultPriority,
  clearDelay,
  debounce,
}: {
  defaultPriority?: "polite" | "assertive";
  clearDelay?: number;
  debounce?: number;
} = {}) {
  const { announce, current, clear, AnnouncementRegion } = useAnnounce({
    defaultPriority,
    clearDelay,
    debounce,
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => announce("Test message")}
        data-testid="announce-btn"
      >
        Announce
      </button>
      <button
        type="button"
        onClick={() => announce("Assertive message", "assertive")}
        data-testid="announce-assertive-btn"
      >
        Announce Assertive
      </button>
      <button type="button" onClick={() => clear()} data-testid="clear-btn">
        Clear
      </button>
      <div data-testid="current-message">{current?.message ?? "none"}</div>
      <div data-testid="current-priority">{current?.priority ?? "none"}</div>
      <AnnouncementRegion />
    </div>
  );
}

describe("useAnnounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("announce function", () => {
    it("sets current announcement when called", async () => {
      render(<TestComponent />);

      await act(async () => {
        screen.getByTestId("announce-btn").click();
        // Wait for any requestAnimationFrame
        vi.advanceTimersByTime(16);
      });

      expect(screen.getByTestId("current-message").textContent).toBe(
        "Test message",
      );
    });

    it("uses polite priority by default", async () => {
      render(<TestComponent />);

      await act(async () => {
        screen.getByTestId("announce-btn").click();
        vi.advanceTimersByTime(16);
      });

      expect(screen.getByTestId("current-priority").textContent).toBe("polite");
    });

    it("allows overriding priority to assertive", async () => {
      render(<TestComponent />);

      await act(async () => {
        screen.getByTestId("announce-assertive-btn").click();
        vi.advanceTimersByTime(16);
      });

      expect(screen.getByTestId("current-priority").textContent).toBe(
        "assertive",
      );
    });

    it("respects defaultPriority option", async () => {
      render(<TestComponent defaultPriority="assertive" />);

      await act(async () => {
        screen.getByTestId("announce-btn").click();
        vi.advanceTimersByTime(16);
      });

      expect(screen.getByTestId("current-priority").textContent).toBe(
        "assertive",
      );
    });
  });

  describe("clear function", () => {
    it("clears current announcement", async () => {
      render(<TestComponent />);

      // First, make an announcement
      await act(async () => {
        screen.getByTestId("announce-btn").click();
        vi.advanceTimersByTime(16);
      });

      expect(screen.getByTestId("current-message").textContent).toBe(
        "Test message",
      );

      // Then clear it
      await act(async () => {
        screen.getByTestId("clear-btn").click();
      });

      expect(screen.getByTestId("current-message").textContent).toBe("none");
    });
  });

  describe("auto-clear behavior", () => {
    it("auto-clears announcement after clearDelay", async () => {
      render(<TestComponent clearDelay={1000} />);

      await act(async () => {
        screen.getByTestId("announce-btn").click();
        vi.advanceTimersByTime(16);
      });

      expect(screen.getByTestId("current-message").textContent).toBe(
        "Test message",
      );

      // Advance time past the clear delay
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByTestId("current-message").textContent).toBe("none");
    });

    it("uses default clearDelay of 3000ms", async () => {
      render(<TestComponent />);

      await act(async () => {
        screen.getByTestId("announce-btn").click();
        vi.advanceTimersByTime(16);
      });

      expect(screen.getByTestId("current-message").textContent).toBe(
        "Test message",
      );

      // Message should still be visible before 3000ms
      await act(async () => {
        vi.advanceTimersByTime(2999);
      });

      expect(screen.getByTestId("current-message").textContent).toBe(
        "Test message",
      );

      // Message should be cleared after 3000ms
      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.getByTestId("current-message").textContent).toBe("none");
    });

    it("resets auto-clear timer on new announcement", async () => {
      render(<TestComponent clearDelay={1000} />);

      await act(async () => {
        screen.getByTestId("announce-btn").click();
        vi.advanceTimersByTime(16);
      });

      // Advance 500ms
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Make another announcement
      await act(async () => {
        screen.getByTestId("announce-assertive-btn").click();
        vi.advanceTimersByTime(16);
      });

      expect(screen.getByTestId("current-message").textContent).toBe(
        "Assertive message",
      );

      // Original timer would have cleared at 1000ms, but new timer starts from second announcement
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Should still be visible
      expect(screen.getByTestId("current-message").textContent).toBe(
        "Assertive message",
      );

      // Clear after full delay from second announcement
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByTestId("current-message").textContent).toBe("none");
    });
  });

  describe("AnnouncementRegion component", () => {
    it("renders aria-live region with sr-only class", () => {
      render(<TestComponent />);

      const region = document.querySelector('[role="status"]');
      expect(region).toBeInTheDocument();
      expect(region).toHaveClass("sr-only");
    });

    it("has aria-atomic attribute", () => {
      render(<TestComponent />);

      const region = document.querySelector('[role="status"]');
      expect(region).toHaveAttribute("aria-atomic", "true");
    });

    it("displays current announcement message", async () => {
      render(<TestComponent />);

      await act(async () => {
        screen.getByTestId("announce-btn").click();
        vi.advanceTimersByTime(16);
      });

      const region = document.querySelector('[role="status"]');
      expect(region?.textContent).toBe("Test message");
    });

    it("uses polite aria-live for polite priority", async () => {
      render(<TestComponent />);

      await act(async () => {
        screen.getByTestId("announce-btn").click();
        vi.advanceTimersByTime(16);
      });

      const region = document.querySelector('[role="status"]');
      expect(region).toHaveAttribute("aria-live", "polite");
    });

    it("uses assertive aria-live for assertive priority", async () => {
      render(<TestComponent />);

      await act(async () => {
        screen.getByTestId("announce-assertive-btn").click();
        vi.advanceTimersByTime(16);
      });

      const region = document.querySelector('[role="status"]');
      expect(region).toHaveAttribute("aria-live", "assertive");
    });
  });

  describe("re-announcement of same message", () => {
    it("re-announces the same message by clearing and re-setting", async () => {
      render(<TestComponent />);

      // First announcement
      await act(async () => {
        screen.getByTestId("announce-btn").click();
        vi.advanceTimersByTime(16);
      });

      expect(screen.getByTestId("current-message").textContent).toBe(
        "Test message",
      );

      // Clear for tracking
      await act(async () => {
        screen.getByTestId("clear-btn").click();
      });

      // Second announcement of same message
      await act(async () => {
        screen.getByTestId("announce-btn").click();
        vi.advanceTimersByTime(16);
      });

      // Should still work
      expect(screen.getByTestId("current-message").textContent).toBe(
        "Test message",
      );
    });
  });
});

describe("ANNOUNCEMENTS templates", () => {
  it("formats page change announcement", () => {
    expect(ANNOUNCEMENTS.pageChange(5, 20)).toBe("Page 5 of 20");
  });

  it("formats zoom change announcement", () => {
    expect(ANNOUNCEMENTS.zoomChange(125)).toBe("Zoom 125%");
  });

  it("formats TTS playing announcement", () => {
    expect(ANNOUNCEMENTS.ttsPlaying()).toBe("Playing");
  });

  it("formats TTS paused announcement", () => {
    expect(ANNOUNCEMENTS.ttsPaused()).toBe("Paused");
  });

  it("formats TTS stopped announcement", () => {
    expect(ANNOUNCEMENTS.ttsStopped()).toBe("Stopped");
  });

  it("formats highlight added announcement", () => {
    expect(ANNOUNCEMENTS.highlightAdded()).toBe("Highlight added");
  });

  it("formats highlight removed announcement", () => {
    expect(ANNOUNCEMENTS.highlightRemoved()).toBe("Highlight removed");
  });

  it("formats settings saved announcement", () => {
    expect(ANNOUNCEMENTS.settingsSaved()).toBe("Settings saved");
  });

  it("formats error announcement with message", () => {
    expect(ANNOUNCEMENTS.error("File not found")).toBe("Error: File not found");
  });
});
