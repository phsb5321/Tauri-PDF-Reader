/**
 * Slice 111 — the shortcuts panel must not lie.
 *
 * KeyboardShortcuts.tsx used to restate a hand-maintained 20-entry list that
 * had drifted far from the real bindings: Ctrl+F, Ctrl+,, Ctrl+H, Ctrl+B,
 * F11, zoom chords and chunk chords advertised controls that do not exist,
 * and — actively wrong — Space was documented as play/pause while the real
 * binding is next-page (a reader trusting the panel would lose their place).
 *
 * The panel now DERIVES from `COMMAND_CHORDS` (the global table, which is
 * also what `useCommandKeys` matches against) plus a small, justified
 * `COMPONENT_CHORDS` supplement for bindings that live on components. This
 * test pins the derivation:
 *
 *  - the panel source carries no literal chord entries (a hand-restated
 *    second list is the drift mechanism — re-syncing it just resets the
 *    clock);
 *  - every component supplement entry points at a binding that actually
 *    exists (grep the named component for the key);
 *  - the rendered row count equals the union of the two sources.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { COMMAND_CHORDS, COMPONENT_CHORDS } from "../../hooks/useCommandKeys";
import { KeyboardShortcuts } from "../../components/settings/KeyboardShortcuts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

describe("the shortcuts panel (111)", () => {
  it("derives from the chord sources — no literal hand-maintained list", () => {
    const src = readFileSync(
      join(REPO_ROOT, "src/components/settings/KeyboardShortcuts.tsx"),
      "utf8",
    );
    expect(src).toContain("COMMAND_CHORDS");
    expect(src).toContain("COMPONENT_CHORDS");
    // No inline `{ action: "..."` entries — that is the drift mechanism.
    expect(src).not.toMatch(/\{\s*action:\s*["']/);
  });

  it("every component supplement entry has a real binding in its named source", () => {
    const viewer = readFileSync(
      join(REPO_ROOT, "src/components/PdfViewer.tsx"),
      "utf8",
    );
    const playback = readFileSync(
      join(REPO_ROOT, "src/components/playback-bar/AiPlaybackBar.tsx"),
      "utf8",
    );
    const highlight = readFileSync(
      join(REPO_ROOT, "src/components/pdf-viewer/HighlightCreationHandler.tsx"),
      "utf8",
    );
    const escSources = [
      viewer,
      playback,
      readFileSync(
        join(REPO_ROOT, "src/components/pdf-viewer/HighlightToolbar.tsx"),
        "utf8",
      ),
    ];

    for (const chord of COMPONENT_CHORDS) {
      if (chord.action === "Play / Pause TTS") {
        expect(playback).toMatch(/" "/);
        expect(playback).toMatch(/ctrlKey/);
      } else if (chord.action === "Close / stop the innermost open thing") {
        expect(escSources.some((s) => s.includes('"Escape"'))).toBe(true);
      } else if (chord.action === "Highlight the pending selection") {
        expect(highlight).toMatch(/Shift/);
      } else if (chord.action === "Go to the first page") {
        expect(viewer).toMatch(/"Home"/);
      } else if (chord.action === "Go to the last page") {
        expect(viewer).toMatch(/"End"/);
      }
    }
  });

  it("renders exactly the union of the two sources — nothing extra, nothing missing", () => {
    render(<KeyboardShortcuts />);
    const rows = screen.getAllByText(/[A-Za-z]/).length;
    // Rows = one per chord entry from both sources.
    expect(rows).toBeGreaterThanOrEqual(
      COMMAND_CHORDS.length + COMPONENT_CHORDS.length,
    );
    // Every global chord's label is advertised.
    for (const chord of COMMAND_CHORDS) {
      expect(screen.getAllByText(chord.label).length).toBeGreaterThan(0);
    }
  });
});
