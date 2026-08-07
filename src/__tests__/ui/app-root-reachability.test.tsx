/**
 * App-root regression gate for the reading home.
 *
 * Pedro's intent: "the goal is to have a home page that has the progress of
 * files I have been reading and I can hop up from where I started." A feature
 * can have passing component tests while never being mounted from App.tsx.
 * Rendering `ReaderView` here would repeat that blind spot, so this test
 * renders the public `App` shell and follows a known book through the same home
 * interaction a reader uses.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import App from "../../App";
import { mockInvoke } from "../../../tests/setup";
import { useCollectionsStore } from "../../stores/collections-store";
import { useDocumentStore } from "../../stores/document-store";
import { useLibraryStore } from "../../stores/library-store";
import type { Document } from "../../lib/schemas";

vi.mock("../../services/pdf-service", () => ({
  pdfService: { loadDocument: vi.fn(), getPage: vi.fn() },
}));

// Leaf rendering is not the claim. The public shell, its default home, and the
// resume transition are. These seams keep the assertion deterministic.
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

describe("App-root reachability", () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useLibraryStore.getState().reset();
    useCollectionsStore.getState().reset();
    loadDocument.mockReset();
    loadDocument.mockResolvedValue({ numPages: 585 } as PDFDocumentProxy);

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

  afterEach(() => {
    mockInvoke.mockRestore();
  });

  it("Pedro acceptance: App shows in-flight progress by default and resumes its known document through the public shell", async () => {
    render(<App />);

    // The home is the initial App surface and reaches the real library IPC
    // contract. If App.tsx stops mounting ReaderView, this is the first red
    // assertion even while LibraryView's component tests remain green.
    expect(
      await screen.findByRole("heading", { name: "Library", level: 1 }),
    ).toBeInTheDocument();
    expect(mockInvoke).toHaveBeenCalledWith("library_list_documents", {
      orderBy: "last_opened",
      limit: undefined,
      offset: undefined,
    });

    const shelf = await screen.findByRole("region", {
      name: "Continue reading",
    });
    expect(within(shelf).getByText("Page 213 of 585")).toBeInTheDocument();
    expect(
      within(shelf).getByRole("progressbar", { name: "Moby-Dick progress" }),
    ).toHaveAttribute("value", "36");
    fireEvent.click(
      within(shelf).getByRole("button", { name: /^Resume Moby-Dick, page/ }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    expect(loadDocument).toHaveBeenCalledWith(IN_FLIGHT.filePath);
    expect(useDocumentStore.getState()).toMatchObject({
      currentDocument: expect.objectContaining({ id: IN_FLIGHT.id }),
      currentPage: IN_FLIGHT.currentPage,
    });
  });
});
