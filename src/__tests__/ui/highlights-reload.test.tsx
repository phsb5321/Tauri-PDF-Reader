/**
 * Highlights reload into the UI — the read path end to end.
 *
 * HighlightsPanel was exported, fully implemented, and imported by no
 * production file; onToggleHighlights had no handler (the menu item was
 * inert, same class as the Settings item #82 fixed); and nothing loaded
 * highlights when a document opened — the rows sat in SQLite, never shown
 * again. This test asserts through the real shell: highlights load on
 * document open, and the native toggle-highlights action opens the panel
 * with them.
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
import type { MenuAction } from "../../lib/api/menu";
import type { Document, Highlight } from "../../lib/schemas";

vi.mock("../../services/pdf-service", () => ({
  pdfService: { loadDocument: vi.fn(), getPage: vi.fn() },
}));
vi.mock("../../components/PdfViewer", () => ({
  PdfViewer: () => <div data-testid="pdf-viewer" />,
}));
vi.mock("../../components/Toolbar", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));
vi.mock("../../components/playback-bar/AiPlaybackBar", () => ({
  AiPlaybackBar: () => <div data-testid="playback-bar" />,
}));

let menuActionListener: ((action: MenuAction) => void) | undefined;
vi.mock("../../lib/api/menu", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/api/menu")>("../../lib/api/menu");
  return {
    ...actual,
    onMenuAction: vi.fn((callback: (action: MenuAction) => void) => {
      menuActionListener = callback;
      return Promise.resolve(() => {
        menuActionListener = undefined;
      });
    }),
  };
});

const { pdfService } = await import("../../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);

const IN_FLIGHT: Document = {
  id: "doc-1",
  filePath: "/books/ddd.pdf",
  title: "Domain-Driven Design",
  pageCount: 529,
  currentPage: 214,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: "2026-08-05T10:00:00Z",
  fileHash: null,
  createdAt: "2026-08-01T00:00:00Z",
} as Document;

const SAVED_HIGHLIGHT: Highlight = {
  id: "hl-1",
  documentId: "doc-1",
  pageNumber: 214,
  rects: [],
  color: "#FFEB3B",
  textContent: "Reliability means the system continues to work correctly.",
  note: null,
  createdAt: "2026-08-06T10:00:00Z",
} as Highlight;

beforeEach(() => {
  useDocumentStore.getState().reset();
  useLibraryStore.getState().reset();
  useCollectionsStore.getState().reset();
  menuActionListener = undefined;
  loadDocument.mockReset();
  loadDocument.mockResolvedValue({ numPages: 529 } as unknown as PDFDocumentProxy);

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
      case "highlights_list_for_document":
        return Promise.resolve({ highlights: [SAVED_HIGHLIGHT] });
      case "highlights_list_for_page":
        return Promise.resolve({ highlights: [SAVED_HIGHLIGHT] });
      case "settings_get_all_v2":
        return Promise.resolve({ settings: {} });
      default:
        return Promise.resolve(null);
    }
  });
});

async function shelfEntry() {
  const shelf = await screen.findByRole("region", { name: "Continue reading" });
  return within(shelf).getByRole("button", {
    name: /^Resume Domain-Driven Design, page/,
  });
}

function dispatchMenu(action: MenuAction) {
  act(() => {
    menuActionListener?.(action);
  });
}

describe("highlights reload", () => {
  it("loads saved highlights into the store when a document opens", async () => {
    render(<ReaderView />);

    fireEvent.click(await shelfEntry());
    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );

    await waitFor(() =>
      expect(useDocumentStore.getState().highlights).toEqual([SAVED_HIGHLIGHT]),
    );
  });

  it("the native toggle-highlights action opens the panel with the saved rows", async () => {
    render(<ReaderView />);
    await waitFor(() => expect(menuActionListener).toBeDefined());

    fireEvent.click(await shelfEntry());
    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(useDocumentStore.getState().highlights.length).toBe(1),
    );

    expect(
      screen.queryByRole("heading", { name: "Highlights" }),
    ).not.toBeInTheDocument();
    dispatchMenu("toggle-highlights");

    expect(
      await screen.findByRole("heading", { name: "Highlights" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Reliability means the system continues/),
    ).toBeInTheDocument();
  });

  it("the panel does not open without a document", async () => {
    render(<ReaderView />);
    await waitFor(() => expect(menuActionListener).toBeDefined());

    dispatchMenu("toggle-highlights");

    expect(
      screen.queryByRole("heading", { name: "Highlights" }),
    ).not.toBeInTheDocument();
  });
});
