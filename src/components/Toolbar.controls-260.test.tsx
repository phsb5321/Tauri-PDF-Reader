import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Toolbar } from "./Toolbar";
import { useDocumentStore } from "../stores/document-store";

/**
 * Spec 260 — toolbar control grouping, state visibility, and focus
 * recovery across the library <-> reader remount. Children that own their
 * own geometry (PageNavigation, ZoomControls, SessionMenu) are stubbed;
 * the open seam is mocked at the hook boundary.
 */

const openPdf = vi.fn();

vi.mock("../hooks/useOpenPdf", () => ({
  useOpenPdf: () => ({ openPdf: (...a: unknown[]) => openPdf(...a) }),
}));
vi.mock("./PageNavigation", () => ({
  PageNavigation: () => <div data-testid="page-navigation-stub" />,
}));
vi.mock("./ZoomControls", () => ({
  ZoomControls: () => <div data-testid="zoom-controls-stub" />,
}));
vi.mock("./session-menu/SessionMenu", () => ({
  SessionMenu: () => <div data-testid="session-menu-stub" />,
}));

const documentStub = {
  id: "doc-1",
  title:
    "A synthetically long document title that must never push controls out of the bar at six hundred forty pixels",
  filePath: "/synthetic/long-title.pdf",
  currentPage: 1,
  scrollPosition: 0,
};

const pdfStub = { numPages: 5 };

/** Seed the store so reader-only controls (Chapters/Zoom/PageNavigation) render. */
function seedReaderDocument() {
  act(() => {
    useDocumentStore.setState({
      pdfDocument: pdfStub as unknown as import("pdfjs-dist").PDFDocumentProxy,
      currentDocument: documentStub as never,
    });
  });
}

function renderToolbar(overrides: Record<string, unknown> = {}) {
  return render(
    <Toolbar
      onSessionRestored={vi.fn()}
      onOpen={vi.fn()}
      isLibraryShowing={false}
      onLibrary={vi.fn()}
      isContentsOpen={false}
      onContents={vi.fn()}
      onSettings={vi.fn()}
      {...overrides}
    />,
  );
}

describe("Toolbar controls (260)", () => {
  beforeEach(() => {
    openPdf.mockReset().mockResolvedValue(true);
  });

  it("keeps every essential action present with its accessible name in reader mode", () => {
    seedReaderDocument();
    renderToolbar();
    for (const name of [
      "Back to library",
      "Chapters",
      "Sessions",
      "Open PDF",
      "Settings",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("grouping divider is decorative: aria-hidden and NOT a roving-tabindex stop", () => {
    const { container } = renderToolbar();
    const divider = container.querySelector<HTMLElement>(".toolbar-divider");
    expect(divider).not.toBeNull();
    expect(divider).toHaveAttribute("aria-hidden", "true");
    expect(divider?.className).not.toContain("toolbar-roving-item");
  });

  function ContentsHarness() {
    // Controlled-prop harness: isContentsOpen is owned by the parent, so the
    // pressed state can only flip when the parent actually re-renders.
    const [contentsOpen, setContentsOpen] = useState(false);
    return (
      <Toolbar
        isLibraryShowing={false}
        onLibrary={vi.fn()}
        isContentsOpen={contentsOpen}
        onContents={() => setContentsOpen((o) => !o)}
        onSettings={vi.fn()}
        onOpen={vi.fn()}
        onSessionRestored={vi.fn()}
      />
    );
  }

  it("Chapters pressed state follows the CONTROLLED parent prop via onContents", () => {
    seedReaderDocument();
    render(<ContentsHarness />);
    const chapters = screen.getByRole("button", { name: "Chapters" });
    expect(chapters).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chapters); // calls onContents -> parent flips isContentsOpen
    expect(chapters).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chapters);
    expect(chapters).toHaveAttribute("aria-pressed", "false");
  });

  it("Sessions pressed state flips through its internal toolbar state", () => {
    renderToolbar();
    const sessions = screen.getByRole("button", { name: "Sessions" });
    expect(sessions).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(sessions);
    expect(sessions).toHaveAttribute("aria-pressed", "true");
  });

  it("library mode hides reader-only controls but keeps Sessions/Open/Settings", () => {
    renderToolbar({ isLibraryShowing: true });
    expect(
      screen.queryByRole("button", { name: "Back to library" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Chapters" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sessions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open PDF" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  it("Open activates the real open seam and reports success through onOpen", async () => {
    const onOpen = vi.fn();
    renderToolbar({ onOpen });
    fireEvent.click(screen.getByRole("button", { name: "Open PDF" }));
    await waitFor(() => expect(openPdf).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
  });

  it("focus recovers to the toolbar after the remount when the owned item was lost", async () => {
    const { container, rerender } = renderToolbar();
    // Keyboard user: focus lives on the Sessions button, which is about to
    // unmount with the reader toolbar.
    const sessions = screen.getByRole("button", { name: "Sessions" });
    sessions.focus();
    expect(document.activeElement).toBe(sessions);

    rerender(
      <Toolbar
        onSessionRestored={vi.fn()}
        onOpen={vi.fn()}
        isLibraryShowing={true}
        onLibrary={vi.fn()}
        isContentsOpen={false}
        onContents={vi.fn()}
        onSettings={vi.fn()}
      />,
    );
    await waitFor(() => {
      const active = document.activeElement;
      expect(active).not.toBeNull();
      expect(active?.tagName).toBe("BUTTON");
      expect(container.querySelector(".toolbar")?.contains(active)).toBe(true);
    });
  });

  it("deliberate outside focus is NOT stolen by a later mode change", async () => {
    // An alive outside focus target (e.g. the reader's own text layer).
    const outside = document.createElement("input");
    outside.setAttribute("aria-label", "outside synthetic target");
    document.body.appendChild(outside);
    seedReaderDocument();
    const { rerender } = renderToolbar();
    // Focus enters the toolbar, then the user deliberately moves it outside.
    const sessions = screen.getByRole("button", { name: "Sessions" });
    sessions.focus();
    outside.focus();
    expect(document.activeElement).toBe(outside);

    rerender(
      <Toolbar
        onSessionRestored={vi.fn()}
        onOpen={vi.fn()}
        isLibraryShowing={true}
        onLibrary={vi.fn()}
        isContentsOpen={false}
        onContents={vi.fn()}
        onSettings={vi.fn()}
      />,
    );
    await waitFor(() => expect(document.activeElement).toBe(outside));
    outside.remove();
  });

  it("does not steal focus on first mount when focus was never in the toolbar", () => {
    renderToolbar();
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: "Sessions" }),
    );
  });
});
