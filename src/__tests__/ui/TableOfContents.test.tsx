import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TableOfContents } from "../../components/sidebar/TableOfContents";
import { pdfService } from "../../services/pdf-service";
import { useDocumentStore } from "../../stores/document-store";

vi.mock("../../services/pdf-service", () => ({
  pdfService: { getOutline: vi.fn() },
}));

const PDF_DOCUMENT = { numPages: 3 } as PDFDocumentProxy;
const originalSetCurrentPage = useDocumentStore.getState().setCurrentPage;

describe("TableOfContents", () => {
  const setCurrentPage = vi.fn();

  beforeEach(() => {
    act(() => {
      useDocumentStore.setState({
        pdfDocument: PDF_DOCUMENT,
        currentPage: 2,
        setCurrentPage,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useDocumentStore.getState().reset();
      useDocumentStore.setState({ setCurrentPage: originalSetCurrentPage });
    });
    vi.restoreAllMocks();
  });

  it("loads, expands, and navigates an outline", async () => {
    vi.spyOn(pdfService, "getOutline").mockResolvedValue([
      {
        title: "Chapter",
        pageNumber: 2,
        children: [{ title: "Section", pageNumber: 3, children: [] }],
      },
    ]);
    render(<TableOfContents isOpen onClose={vi.fn()} />);

    await screen.findByRole("button", { name: /Chapter/ });
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    fireEvent.click(screen.getByRole("button", { name: /Section/ }));

    expect(setCurrentPage).toHaveBeenCalledWith(3);
    expect(screen.getByRole("button", { name: "Collapse" })).toBeVisible();
  });

  it("closes from the native dialog backdrop and Escape key", async () => {
    vi.spyOn(pdfService, "getOutline").mockResolvedValue([]);
    const onClose = vi.fn();
    render(<TableOfContents isOpen onClose={onClose} />);
    await waitFor(() => expect(pdfService.getOutline).toHaveBeenCalled());

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.getByText("No table of contents available")).toBeVisible();
  });

  it("does not load or render while closed", () => {
    const getOutline = vi.spyOn(pdfService, "getOutline");
    render(<TableOfContents isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getOutline).not.toHaveBeenCalled();
  });
});
