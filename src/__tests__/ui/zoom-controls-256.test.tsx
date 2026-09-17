/**
 * Spec 256 — zoom controller containment + native-popup theme gates
 * (authored, NOT run: live 225 owns all execution; this is the
 * READY-FOR-CHECK payload).
 *
 * p16 corrective acceptance coverage:
 *  - the advertised Ctrl+-/Ctrl++ chords are NOT implemented anywhere → the
 *    titles must no longer advertise them (aria labels retained);
 *  - the native select's Home/End/Escape (and arrow) keys must NOT leak to
 *    document-level handlers (PdfViewer Home/End page navigation,
 *    AiPlaybackBar Escape-to-stop ignore defaultPrevented) — proven with a
 *    WINDOW probe on the combined handler chain, not a popup-only focus
 *    test, while ordinary keys still propagate (the guard is key-scoped);
 *  - native dark/light POPUP painting cannot be inferred from option CSS in
 *    jsdom: the stylesheet pins the scoped `color-scheme` declarations and
 *    251 owns the actual WebKitGTK check.
 *
 * Also retains verified 35801daa behavior: inline effective % in fit labels,
 * exact non-preset value option, preset selection, boundary disablement.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ZOOM_MIN } from "../../lib/constants";
import { ZoomControls } from "../../components/ZoomControls";
import { useDocumentStore } from "../../stores/document-store";

vi.mock("../../hooks/useAnnounce", () => ({
  useAnnounce: () => ({ announce: vi.fn() }),
  ANNOUNCEMENTS: { zoomChange: vi.fn() },
}));

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const css = readFileSync(
  resolve(ROOT, "src/components/ZoomControls.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const containedKeys = [
  "Home",
  "End",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
];

describe("spec 256: no unsupported chord advertising", () => {
  it("titles name the actions without advertising unimplemented chords", () => {
    render(<ZoomControls />);
    expect(screen.getByTitle("Zoom out")).toHaveAttribute(
      "aria-label",
      "Zoom out",
    );
    expect(screen.getByTitle("Zoom in")).toHaveAttribute(
      "aria-label",
      "Zoom in",
    );
    expect(screen.queryByTitle(/Ctrl/)).toBeNull();
  });
});

describe("spec 256: retained 35801daa value presentation", () => {
  beforeEach(() => {
    useDocumentStore.setState({
      zoomLevel: 1.5,
      fitMode: "none",
    });
  });

  it("fit-mode labels carry the inline effective percentage", () => {
    useDocumentStore.setState({ fitMode: "fit-width" });
    render(<ZoomControls />);
    const option = screen.getByRole("option", { name: /Fit Width · 150%/ });
    expect(option).toBeInTheDocument();
  });

  it("a non-preset zoom exposes its exact value as a selectable option", () => {
    useDocumentStore.setState({ zoomLevel: 1.37, fitMode: "none" });
    render(<ZoomControls />);
    expect(screen.getByRole("option", { name: "137%" })).toBeInTheDocument();
  });

  it("choosing a preset updates the real zoom level", () => {
    // Initial 1.5; the user selects a DIFFERENT valid preset (2 = 200%).
    render(<ZoomControls />);
    const select = screen.getByRole("combobox", { name: "Zoom level" });
    fireEvent.change(select, { target: { value: "2" } });
    expect(useDocumentStore.getState().zoomLevel).toBe(2);
  });

  it("boundary unchanged: zoom-out disables at the minimum zoom", () => {
    useDocumentStore.setState({ zoomLevel: ZOOM_MIN });
    render(<ZoomControls />);
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeEnabled();
  });
});

describe("spec 256: popup keyboard containment (combined-handler proof)", () => {
  let seen: string[];
  let probe: (event: KeyboardEvent) => void;

  beforeEach(() => {
    useDocumentStore.setState({ zoomLevel: 1.5, fitMode: "none" });
    seen = [];
    probe = (event) => seen.push(event.key);
    window.addEventListener("keydown", probe);
  });

  afterEach(() => {
    window.removeEventListener("keydown", probe);
    cleanup();
  });

  function focusedSelect() {
    render(<ZoomControls />);
    const select = screen.getByRole("combobox", { name: "Zoom level" });
    select.focus();
    expect(document.activeElement).toBe(select);
    return select;
  }

  it("navigation/escape keys never reach document-level handlers", () => {
    const select = focusedSelect();
    for (const key of containedKeys) {
      fireEvent.keyDown(select, { key });
    }
    expect(seen).toEqual([]); // PdfViewer page-nav / AiPlaybackBar stop: unreached
  });

  it("ordinary keys still propagate (containment is key-scoped)", () => {
    const select = focusedSelect();
    fireEvent.keyDown(select, { key: "z" });
    expect(seen).toEqual(["z"]);
  });

  it("Escape containment does not preventDefault (popup close stays native)", () => {
    const select = focusedSelect();
    const notPrevented = fireEvent.keyDown(select, { key: "Escape" });
    expect(notPrevented).toBe(true);
    expect(seen).toEqual([]);
  });
});

describe("spec 256: native popup follows the application theme (scoped)", () => {
  it("color-scheme is declared on the select, scoped to this leaf only", () => {
    expect(css).toMatch(/\.zoom-select\s*\{[^}]*color-scheme:\s*light/);
    expect(css).toMatch(
      /\[data-theme="dark"\]\s*\.zoom-select\s*\{[^}]*color-scheme:\s*dark/,
    );
    expect(css).toMatch(
      /@media \(prefers-color-scheme: dark\)\s*\{[^@]*:root:not\(\[data-theme="light"\]\)\s*\.zoom-select\s*\{[^}]*color-scheme:\s*dark/,
    );
    // Leaf-scoped: no global root-level color-scheme from this file.
    expect(css).not.toMatch(/:root\s*\{[^}]*color-scheme/);
  });

  it("popup option colors use defined theme tokens", () => {
    const options =
      css.match(
        /\.zoom-select option,\s*\n?\.zoom-select optgroup\s*\{[^}]*\}/,
      )?.[0] ?? "";
    expect(options).toMatch(/background:\s*var\(--color-bg\)/);
    expect(options).toMatch(/color:\s*var\(--color-text-primary\)/);
  });
});
