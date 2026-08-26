import { beforeEach, describe, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Toolbar } from "../../components/Toolbar";
import { useDocumentStore } from "../../stores/document-store";

vi.mock("../../hooks/useOpenPdf", () => ({
  useOpenPdf: () => ({ openPdf: vi.fn() }),
}));

// Reader-only controls deliberately add native buttons inside the toolbar.
// They must not change the shell action roving indices.
vi.mock("../../components/PageNavigation", () => ({
  PageNavigation: () => (
    <>
      <button type="button">Previous page</button>
      <button type="button">Next page</button>
    </>
  ),
}));
vi.mock("../../components/ZoomControls", () => ({
  ZoomControls: () => <button type="button">Zoom in</button>,
}));

beforeEach(() => {
  useDocumentStore.getState().reset();
  useDocumentStore.setState({
    currentDocument: {
      id: "reader-document",
      filePath: "/books/reader.pdf",
      title: "Reader document",
      pageCount: 10,
      currentPage: 1,
      scrollPosition: 0,
    } as never,
    pdfDocument: {} as never,
    isLoading: true,
  });
});

describe("toolbar shell-action reachability", () => {
  it("exposes visible routes to the library and chapters", () => {
    const onLibrary = vi.fn();
    const onContents = vi.fn();
    render(
      <Toolbar
        isLibraryShowing={false}
        onLibrary={onLibrary}
        onContents={onContents}
        onSettings={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to library" }));
    fireEvent.click(screen.getByRole("button", { name: "Chapters" }));
    expect(onLibrary).toHaveBeenCalledOnce();
    expect(onContents).toHaveBeenCalledOnce();
  });

  it("keeps shell roving indices stable with reader controls and loading Open", () => {
    render(
      <Toolbar
        isLibraryShowing={false}
        onLibrary={vi.fn()}
        onContents={vi.fn()}
        onSettings={vi.fn()}
      />,
    );

    const library = screen.getByRole("button", { name: "Back to library" });
    const chapters = screen.getByRole("button", { name: "Chapters" });
    const sessions = screen.getByRole("button", { name: "Sessions" });
    const open = screen.getByRole("button", { name: "Open PDF" });
    const settings = screen.getByRole("button", { name: "Settings" });

    expect(open).toHaveAttribute("aria-disabled", "true");
    expect(open).not.toBeDisabled();

    act(() => library.focus());
    fireEvent.keyDown(library, { key: "ArrowRight" });
    expect(chapters).toHaveFocus();

    fireEvent.keyDown(chapters, { key: "ArrowRight" });
    expect(sessions).toHaveFocus();

    fireEvent.keyDown(sessions, { key: "ArrowRight" });
    expect(open).toHaveFocus();

    fireEvent.keyDown(open, { key: "ArrowRight" });
    expect(settings).toHaveFocus();
  });
});
