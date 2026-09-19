/**
 * 262 — the keyboard reference is discoverable, accurate, and honest.
 *
 * The displayed chord set is asserted EXACTLY against the real sources
 * (`COMMAND_CHORDS` + `COMPONENT_CHORDS`) in both platform contexts, rather
 * than against another hand-restated registry. Platform accuracy follows the
 * actual handlers: `resolveChord` matches ctrlKey OR metaKey, so global
 * chords may relabel to ⌘ on macOS; component-owned handlers bind `ctrlKey`
 * literally (AiPlaybackBar), so their keys are never relabelled — no invented
 * Cmd+Space. Bare Space stays next-page; unbound Find and zoom chords
 * never appear.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMAND_CHORDS, COMPONENT_CHORDS } from "../../hooks/useCommandKeys";
import {
  KeyboardShortcuts,
  buildShortcutGroups,
  displayChordLabel,
  type Platform,
} from "../../components/settings/KeyboardShortcuts";

/** The exact displayed keycap multiset the sources imply for a context. */
function expectedKeycaps(platform: Platform): string[] {
  return [
    ...COMMAND_CHORDS.map((chord) => displayChordLabel(chord.label, platform)),
    ...COMPONENT_CHORDS.flatMap((chord) => chord.keys),
  ].sort();
}

function displayedKeycaps(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(".shortcut-key"),
  ).map((el) => el.textContent ?? "");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("keyboard reference (262)", () => {
  it("shows exactly the union of both chord sources — nothing invented, nothing missing", () => {
    const { container } = render(<KeyboardShortcuts />);
    expect(displayedKeycaps(container).sort()).toEqual(
      expectedKeycaps("other"),
    );
    // Every displayed binding sits on a real row; the count follows the sources.
    const rows = container.querySelectorAll("[data-shortcut-row]");
    expect(rows.length).toBeGreaterThan(0);
    // Both real sources feed the panel (pinned derivation, slice 111).
    expect(container.textContent).toContain("Space");
    expect(container.textContent).toContain("Ctrl+O");
  });

  it("groups playback, navigation and reading actions with the real bindings", () => {
    const { container } = render(<KeyboardShortcuts />);
    const groupOf = (title: string) =>
      Array.from(container.querySelectorAll("section.shortcut-group")).find(
        (section) =>
          section.querySelector(".shortcut-group-title")?.textContent === title,
      );
    // Playback: the component-owned Ctrl+Space play/pause lives here, literally.
    const playback = groupOf("Playback");
    expect(playback).toBeDefined();
    expect(playback?.textContent).toContain("Play / Pause TTS");
    const playbackKeys = Array.from(
      playback?.querySelectorAll(".shortcut-key") ?? [],
    ).map((el) => el.textContent);
    expect(playbackKeys).toEqual(["Ctrl", "Space"]);
    // Navigation owns the bare Space chord — Space is NEXT-PAGE, not play.
    const navigation = groupOf("Navigation");
    expect(navigation?.textContent).toContain("Next page");
    const navKeys = Array.from(
      navigation?.querySelectorAll(".shortcut-key") ?? [],
    ).map((el) => el.textContent);
    expect(navKeys).toContain("Space");
    expect(navKeys).toContain("Page Up");
    // Reading actions carry Escape (innermost dismiss) + highlight.
    const reading = groupOf("Reading actions");
    expect(reading?.textContent).toContain("Highlight the pending selection");
    expect(reading?.textContent).toContain("Escape");
  });

  it("merges same-action alternatives into one row with unique stable identity", () => {
    const { container } = render(<KeyboardShortcuts />);
    const labels = Array.from(
      container.querySelectorAll("[data-shortcut-row] .shortcut-action"),
    ).map((el) => el.textContent);
    // Unique row identity: no duplicated action rows, so row.label React keys
    // are unique and stable.
    expect(new Set(labels).size).toBe(labels.length);
    const rowKeys = (action: string) => {
      const row = Array.from(
        container.querySelectorAll("[data-shortcut-row]"),
      ).find(
        (el) => el.querySelector(".shortcut-action")?.textContent === action,
      );
      return Array.from(row?.querySelectorAll(".shortcut-key") ?? []).map(
        (el) => el.textContent,
      );
    };
    // Alternatives derive from the sources, in source order — really merged.
    expect(rowKeys("Previous page")).toEqual(
      COMMAND_CHORDS.filter((c) => c.action === "prev-page").map(
        (c) => c.label,
      ),
    );
    expect(rowKeys("Next page")).toEqual(
      COMMAND_CHORDS.filter((c) => c.action === "next-page").map(
        (c) => c.label,
      ),
    );
    expect(rowKeys("Next page")).toContain("Space");
  });

  it("never advertises Find or zoom chords the app does not bind, nor Cmd+Space", () => {
    const { container } = render(<KeyboardShortcuts />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\bfind\b/i);
    expect(text).not.toMatch(/zoom/i);
    expect(text).not.toMatch(/⌘\s*space|cmd\+space/i);
  });

  it("mac context relabels ONLY global chords (⌘O) and keeps component keys literal", () => {
    // Pure context: the displayed set under mac vs non-mac.
    expect(displayChordLabel("Ctrl+O", "mac")).toBe("⌘O");
    expect(displayChordLabel("Ctrl+O", "other")).toBe("Ctrl+O");
    const macSet = buildShortcutGroups("mac")
      .flatMap((group) => group.rows.flatMap((row) => row.keys))
      .sort();
    expect(macSet).toEqual(expectedKeycaps("mac"));
    // The play/pause component binding is NOT relabelled on mac.
    expect(macSet).toContain("Ctrl");
    expect(macSet).toContain("Space");
    expect(macSet).not.toContain("⌘Space");
    // DOM context: a mac platform renders ⌘O and drops the Ctrl variant.
    // The signal is the user agent — `navigator.platform` is deprecated and
    // deliberately not read (typescript:S1874); stubbing it would prove nothing.
    const platformSpy = vi
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
    const { container } = render(<KeyboardShortcuts />);
    expect(container.textContent).toContain("⌘O");
    expect(container.textContent).not.toContain("Ctrl+O");
    expect(platformSpy).toHaveBeenCalled();
  });
});
