/**
 * Spec 259 — speed-control UX regressions. UNIT SEAM: useAiTts is mocked
 * (the transport/backend in-session speed contract is NOT exercised here —
 * the parent keeps the slider disabled during playback by design, and no
 * live-speed/acoustic claim is made). Keyboard increments rely on the
 * native range semantics (step 0.1 asserted via attributes).
 */
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AiSpeedSlider } from "./AiSpeedSlider";

vi.mock("../../hooks/useAiTts", () => ({
  useAiTts: (selector?: (s: unknown) => unknown) => {
    const state = {
      speed: useAiTtsState.speed,
      setSpeed: useAiTtsState.setSpeed,
      initialized: useAiTtsState.initialized,
    };
    return selector ? selector(state) : state;
  },
}));

const useAiTtsState: {
  speed: number;
  initialized: boolean;
  setSpeed: ReturnType<typeof vi.fn>;
} = {
  speed: 1,
  initialized: true,
  setSpeed: vi.fn(() => Promise.resolve()),
};

function slider() {
  return screen.getByRole("slider", { name: /speed/i });
}

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  useAiTtsState.speed = 1;
  useAiTtsState.initialized = true;
  useAiTtsState.setSpeed = vi.fn(() => Promise.resolve());
});

describe("AiSpeedSlider — spec 259", () => {
  it("announces the exact multiplier via aria-valuetext and visible value", () => {
    useAiTtsState.speed = 1.25;
    render(<AiSpeedSlider />);
    expect(slider()).toHaveAttribute("aria-valuetext", "1.25× playback speed");
    expect(screen.getByText("1.25x")).toBeTruthy();
  });

  it("keeps off-lattice values truthful (no rounding to a preset label)", () => {
    useAiTtsState.speed = 1.65;
    render(<AiSpeedSlider />);
    expect(slider()).toHaveAttribute("aria-valuetext", "1.65× playback speed");
    expect(screen.getByText("1.65x")).toBeTruthy();
  });

  it("stored quarter-step values are exact in the DOM (no step sanitization)", () => {
    for (const stored of [1.25, 1.75]) {
      useAiTtsState.speed = stored;
      render(<AiSpeedSlider />);
      const input = slider();
      expect(input).toHaveAttribute("step", "0.05"); // quarter lattice
      expect(input.value).toBe(String(stored)); // actual range.value truth
      expect(input).toHaveAttribute(
        "aria-valuetext",
        `${stored}× playback speed`,
      );
      cleanup();
    }
  });

  it("meaningful keyboard transition: ArrowRight from 1.2 lands exactly on 1.25", () => {
    useAiTtsState.speed = 1.2;
    render(<AiSpeedSlider />);
    const input = slider();
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(useAiTtsState.setSpeed).toHaveBeenCalledWith(1.25);
    fireEvent.keyDown(input, { key: "ArrowLeft" });
    expect(useAiTtsState.setSpeed).toHaveBeenLastCalledWith(1.15);
  });

  it("parent-disabled with initialized provider: honest playback reason", () => {
    render(<AiSpeedSlider disabled />);
    expect(slider()).toBeDisabled();
    expect(slider()).toHaveAttribute(
      "aria-describedby",
      "ai-speed-slider-hint",
    );
    expect(
      screen.getByText(/can't change while a clip is active or loading/i),
    ).toBeTruthy();
    expect(screen.queryByText(/connect an ai provider/i)).toBeNull();
  });

  it("reason precedence: uninitialized wins even when the parent also locks", () => {
    useAiTtsState.initialized = false;
    render(<AiSpeedSlider disabled />);
    expect(slider()).toBeDisabled();
    expect(screen.getByText(/connect an ai provider/i)).toBeTruthy();
    expect(
      screen.queryByText(/can't change while a clip is active or loading/i),
    ).toBeNull();
  });

  it("uninitialized provider: connection reason, not the playback reason", () => {
    useAiTtsState.initialized = false;
    render(<AiSpeedSlider />);
    expect(slider()).toBeDisabled();
    expect(screen.getByText(/connect an ai provider/i)).toBeTruthy();
    expect(
      screen.queryByText(/can't change while a clip is active or loading/i),
    ).toBeNull();
  });

  it("enabled control exposes no disabled hint and dispatches setSpeed", async () => {
    render(<AiSpeedSlider />);
    expect(slider()).toBeEnabled();
    expect(screen.queryByRole("note")).toBeNull();
    fireEvent.change(slider(), { target: { value: "2" } });
    await vi.waitFor(() =>
      expect(useAiTtsState.setSpeed).toHaveBeenCalledWith(2),
    );
  });
});
