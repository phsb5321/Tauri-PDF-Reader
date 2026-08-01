/**
 * The reading home is reachable, and resuming from it lands on the stored page.
 *
 * `LibraryView` and its Continue-reading shelf were complete and tested for
 * weeks while nothing in the tree mounted them, so unit tests on those
 * components could not have caught the defect: the shell rendered `PdfViewer`
 * unconditionally. This test asserts through the shell for that reason —
 * `ReaderView` is rendered for real, and the claim is that a returning reader
 * sees their books and can pick one up where they left it.
 *
 * The document store is the oracle. Heavy leaf components are stubbed because
 * what is under test is which surface the shell shows and what state a resume
 * leaves behind, not how a PDF paints.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
  within,
} from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { mockInvoke } from "../../../tests/setup";
import { ReaderView } from "../../components/reader/ReaderView";
import { useDocumentStore } from "../../stores/document-store";
import { useLibraryStore } from "../../stores/library-store";
import { useCollectionsStore } from "../../stores/collections-store";
import type { Document } from "../../lib/schemas";

vi.mock("../../services/pdf-service", () => ({
  pdfService: { loadDocument: vi.fn(), getPage: vi.fn() },
}));

// Stubs for what the shell hosts around the surface under test.
vi.mock("../../components/PdfViewer", () => ({
  PdfViewer: () => <div data-testid="pdf-viewer" />,
}));
vi.mock("../../components/Toolbar", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));
vi.mock("../../components/playback-bar/AiPlaybackBar", () => ({
  AiPlaybackBar: () => <div data-testid="playback-bar" />,
}));

const { pdfService } = await import("../../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);

const IN_FLIGHT: Document = {
  id: "doc-1",
  filePath: "/books/moby-dick.pdf",
  title: "Moby-Dick",
  pageCount: 585,
  currentPage: 213,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: "2026-07-30T10:00:00Z",
  fileHash: null,
  createdAt: "2026-07-01T00:00:00Z",
} as Document;

beforeEach(() => {
  useDocumentStore.getState().reset();
  useLibraryStore.getState().reset();
  useCollectionsStore.getState().reset();
  loadDocument.mockReset();
  loadDocument.mockResolvedValue({
    numPages: 585,
  } as unknown as PDFDocumentProxy);

  mockInvoke.mockImplementation((command: string) => {
    switch (command) {
      case "library_list_documents":
        return Promise.resolve([IN_FLIGHT]);
      case "collections_list":
      case "collections_list_memberships":
        return Promise.resolve([]);
      case "library_heal_document":
      case "library_open_document":
        return Promise.resolve(IN_FLIGHT);
      default:
        return Promise.resolve(null);
    }
  });
});

/**
 * The Continue-reading shelf's entry for a book. Scoped to that section because
 * the same book also has a card in the grid below, and it is the shelf — the
 * catch-up surface — that this file is about.
 */
async function shelfEntry(title: RegExp) {
  const shelf = await screen.findByRole("region", { name: "Continue reading" });
  return within(shelf).getByRole("button", { name: title });
}

describe("the reading home", () => {
  it("is what the app shows when no document is open", async () => {
    render(<ReaderView />);

    expect(await shelfEntry(/Moby-Dick/)).toBeInTheDocument();
    expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
  });

  it("reports how far into each book the reader got", async () => {
    render(<ReaderView />);

    expect(await screen.findByText("Page 213 of 585")).toBeInTheDocument();
    // 213/585 = 36.4% -> 36
    expect(
      screen.getByRole("progressbar", { name: "Moby-Dick progress" }),
    ).toHaveAttribute("value", "36");
  });

  it("resumes a book on the page it was left on", async () => {
    render(<ReaderView />);

    fireEvent.click(await shelfEntry(/Moby-Dick/));

    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    const state = useDocumentStore.getState();
    expect(state.currentDocument?.id).toBe("doc-1");
    expect(state.currentPage).toBe(213);
    expect(loadDocument).toHaveBeenCalledWith("/books/moby-dick.pdf");
  });

  it("is reachable again from inside a document", async () => {
    render(<ReaderView />);

    fireEvent.click(await shelfEntry(/Moby-Dick/));
    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );

    // Ctrl+L resolves to the `toggle-library` command and is handed to the same
    // dispatcher the native View -> Library item goes through.
    act(() => {
      fireEvent.keyDown(window, { key: "l", ctrlKey: true });
    });

    expect(await shelfEntry(/Moby-Dick/)).toBeInTheDocument();
    expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
    // Going back to the home does not close the book.
    expect(useDocumentStore.getState().currentDocument?.id).toBe("doc-1");
  });

  it("keeps the current page across a toggle-library round trip", async () => {
    // The previous test proves leaving the document behind does not lose it;
    // this one closes the loop. Coming BACK must show the page the reader
    // navigated to while away, not the page the row was resumed at, and must
    // not re-fetch the file — a second Ctrl+L is a view swap (ReaderView's
    // `showLibrary` flips off), never another `resumeDocument` call.
    render(<ReaderView />);

    fireEvent.click(await shelfEntry(/Moby-Dick/));
    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    expect(useDocumentStore.getState().currentPage).toBe(213);

    // Turn a page for real, through the same window-level dispatcher a
    // physical PageDown key goes through (useCommandKeys -> onNextPage ->
    // usePageNavigation's goToNextPage -> the document store).
    act(() => {
      fireEvent.keyDown(window, { key: "PageDown" });
    });
    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(214),
    );

    // Away to the library...
    act(() => {
      fireEvent.keyDown(window, { key: "l", ctrlKey: true });
    });
    expect(await shelfEntry(/Moby-Dick/)).toBeInTheDocument();

    // ...and back.
    act(() => {
      fireEvent.keyDown(window, { key: "l", ctrlKey: true });
    });

    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    expect(useDocumentStore.getState().currentPage).toBe(214);
    expect(loadDocument).toHaveBeenCalledTimes(1);
  });
});
