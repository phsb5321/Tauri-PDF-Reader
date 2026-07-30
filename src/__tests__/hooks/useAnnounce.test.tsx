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

function renderAnnouncer(
  props: Parameters<typeof TestComponent>[0] = {},
): void {
  render(<TestComponent {...props} />);
}

async function clickAndFlush(testId: string): Promise<void> {
  await act(async () => {
    screen.getByTestId(testId).click();
    vi.advanceTimersByTime(16);
  });
}

async function advanceTime(milliseconds: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
  });
}

function expectCurrentMessage(message: string): void {
  expect(screen.getByTestId("current-message")).toHaveTextContent(message);
}

describe("useAnnounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("announce function", () => {
    it.each([
      [{}, "announce-btn", "Test message", "polite"],
      [{}, "announce-assertive-btn", "Assertive message", "assertive"],
      [
        { defaultPriority: "assertive" as const },
        "announce-btn",
        "Test message",
        "assertive",
      ],
    ])(
      "announces %s via %s",
      async (props, buttonId, expectedMessage, expectedPriority) => {
        renderAnnouncer(props);
        await clickAndFlush(buttonId);

        expectCurrentMessage(expectedMessage);
        expect(screen.getByTestId("current-priority")).toHaveTextContent(
          expectedPriority,
        );
      },
    );
  });

  describe("clear function", () => {
    it("clears current announcement", async () => {
      renderAnnouncer();
      await clickAndFlush("announce-btn");
      expectCurrentMessage("Test message");

      await clickAndFlush("clear-btn");
      expectCurrentMessage("none");
    });
  });

  describe("auto-clear behavior", () => {
    it("auto-clears announcement after clearDelay", async () => {
      renderAnnouncer({ clearDelay: 1000 });
      await clickAndFlush("announce-btn");
      await advanceTime(1000);

      expectCurrentMessage("none");
    });

    it("uses default clearDelay of 3000ms", async () => {
      renderAnnouncer();
      await clickAndFlush("announce-btn");
      await advanceTime(2999);
      expectCurrentMessage("Test message");

      await advanceTime(1);
      expectCurrentMessage("none");
    });

    it("resets auto-clear timer on new announcement", async () => {
      renderAnnouncer({ clearDelay: 1000 });
      await clickAndFlush("announce-btn");
      await advanceTime(500);
      await clickAndFlush("announce-assertive-btn");
      await advanceTime(500);
      expectCurrentMessage("Assertive message");

      await advanceTime(500);
      expectCurrentMessage("none");
    });
  });

  describe("AnnouncementRegion component", () => {
    it("renders a native status output with live-region attributes", () => {
      renderAnnouncer();
      const region = screen.getByRole("status");

      expect(region.tagName).toBe("OUTPUT");
      expect(region).toBeInTheDocument();
      expect(region).toHaveClass("sr-only");
      expect(region).toHaveAttribute("aria-atomic", "true");
    });

    it.each([
      ["announce-btn", "Test message", "polite"],
      ["announce-assertive-btn", "Assertive message", "assertive"],
    ])(
      "reflects %s in the live region",
      async (buttonId, expectedMessage, expectedPriority) => {
        renderAnnouncer();
        await clickAndFlush(buttonId);

        const region = screen.getByRole("status");
        expect(region).toHaveTextContent(expectedMessage);
        expect(region).toHaveAttribute("aria-live", expectedPriority);
      },
    );
  });

  describe("re-announcement of same message", () => {
    it("re-announces the same message by clearing and re-setting", async () => {
      renderAnnouncer();
      await clickAndFlush("announce-btn");
      await clickAndFlush("clear-btn");
      await clickAndFlush("announce-btn");

      expectCurrentMessage("Test message");
    });
  });
});

const ANNOUNCEMENT_CASES: ReadonlyArray<
  readonly [name: string, renderMessage: () => string, expected: string]
> = [
  ["page change", () => ANNOUNCEMENTS.pageChange(5, 20), "Page 5 of 20"],
  ["zoom change", () => ANNOUNCEMENTS.zoomChange(125), "Zoom 125%"],
  ["TTS playing", ANNOUNCEMENTS.ttsPlaying, "Playing"],
  ["TTS paused", ANNOUNCEMENTS.ttsPaused, "Paused"],
  ["TTS stopped", ANNOUNCEMENTS.ttsStopped, "Stopped"],
  ["highlight added", ANNOUNCEMENTS.highlightAdded, "Highlight added"],
  ["highlight removed", ANNOUNCEMENTS.highlightRemoved, "Highlight removed"],
  ["settings saved", ANNOUNCEMENTS.settingsSaved, "Settings saved"],
  [
    "error",
    () => ANNOUNCEMENTS.error("File not found"),
    "Error: File not found",
  ],
];

describe("ANNOUNCEMENTS templates", () => {
  it.each(ANNOUNCEMENT_CASES)(
    "formats %s announcements",
    (_name, renderMessage, expected) => {
      expect(renderMessage()).toBe(expected);
    },
  );
});
