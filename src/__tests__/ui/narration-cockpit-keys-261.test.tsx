import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NarrationCockpit } from "../../components/playback-bar/NarrationCockpit";

/**
 * 261 — tab-key isolation regression (production path: the reader's
 * document-level keydown handler reacts to Home/End; cockpit tab
 * navigation consumed those keys without isolating them, so tabbing also
 * jumped document pages). The test registers a REAL window keydown handler
 * as the global seam and asserts consumed keys never reach it while
 * unconsumed keys still do.
 */

describe("NarrationCockpit tab-key isolation (261)", () => {
  const globalSeam = vi.fn();
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    globalSeam.mockClear();
    onClose = vi.fn();
    window.addEventListener("keydown", globalSeam);
  });

  afterEach(() => {
    window.removeEventListener("keydown", globalSeam);
  });

  const tab = (label: string) => screen.getByRole("tab", { name: label });

  it("consumed tab keys (Arrow/Home/End) never reach the document-level seam", () => {
    render(<NarrationCockpit onClose={onClose} controlsDisabled={false} />);
    const voice = tab("Voice & route");
    voice.focus();

    fireEvent.keyDown(voice, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Delivery" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const delivery = tab("Delivery");

    fireEvent.keyDown(delivery, { key: "End" });
    expect(tab("Selection")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("Selection"), { key: "Home" });
    expect(voice).toHaveAttribute("aria-selected", "true");

    // The real document-level seam saw none of the consumed keys.
    expect(globalSeam).not.toHaveBeenCalled();
  });

  it("still propagates unconsumed keys to the document-level seam", () => {
    render(<NarrationCockpit onClose={onClose} controlsDisabled={false} />);
    const voice = tab("Voice & route");
    voice.focus();
    fireEvent.keyDown(voice, { key: "b" });
    expect(globalSeam).toHaveBeenCalledTimes(1);
    // The seam is the reader's document-level handler: it must observe the
    // unconsumed key with its target intact.
    expect(globalSeam.mock.calls[0][0].key).toBe("b");
    expect(globalSeam.mock.calls[0][0].target).toBe(voice);
  });

  it("keeps Escape closing the cockpit and isolated from the seam", () => {
    render(<NarrationCockpit onClose={onClose} controlsDisabled={false} />);
    const voice = tab("Voice & route");
    voice.focus();
    fireEvent.keyDown(voice, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(globalSeam).not.toHaveBeenCalled();
  });

  it("explains the lock instead of showing silent disabled controls", () => {
    const locked = render(
      <NarrationCockpit onClose={onClose} controlsDisabled />,
    );
    // Neutral truth: the single bool cannot name the reason (transport,
    // setup, or provider switching all pass it) — the note must not claim one.
    expect(screen.getByRole("note").textContent).toContain(
      "temporarily locked",
    );
    expect(screen.getByRole("note").textContent).not.toMatch(
      /playing|paused|loading|active/i,
    );
    locked.unmount();
    render(<NarrationCockpit onClose={onClose} controlsDisabled={false} />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
