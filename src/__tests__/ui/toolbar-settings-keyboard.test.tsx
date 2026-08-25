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

describe("toolbar Settings keyboard reachability", () => {
  it("keeps shell roving indices stable with reader controls and loading Open", () => {
    render(<Toolbar onSettings={vi.fn()} />);

    const sessions = screen.getByRole("button", { name: "Sessions" });
    const open = screen.getByRole("button", { name: "Open" });
    const settings = screen.getByRole("button", { name: "Settings" });

    expect(open).toHaveAttribute("aria-disabled", "true");
    expect(open).not.toBeDisabled();

    act(() => sessions.focus());
    fireEvent.keyDown(sessions, { key: "ArrowRight" });
    expect(open).toHaveFocus();

    fireEvent.keyDown(open, { key: "ArrowRight" });
    expect(settings).toHaveFocus();
  });
});
