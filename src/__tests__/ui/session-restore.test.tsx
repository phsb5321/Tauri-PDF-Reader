/**
 * Restoring a reading session opens its last-read document at the saved page.
 *
 * `Toolbar.handleSessionRestored` shipped as a stub (`// TODO: Open documents
 * from the restored session`) — the SessionMenu UI, the store action and the
 * backend `session_restore` all exist and work, but restore closes the menu
 * and opens NOTHING. A unit test on `SessionMenu` in isolation cannot catch
 * that the shell never learns about the restore, so this test goes through
 * the real shell: `ReaderView` is rendered for real, and so are `Toolbar` and
 * `SessionMenu` (the surface under test sits inside them — unlike the
 * settings-menu test, Toolbar is NOT stubbed). Only heavy leaves (`PdfViewer`,
 * `AiPlaybackBar`) and the Tauri IPC boundary are stubbed.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { mockInvoke } from "../../../tests/setup";
import { ReaderView } from "../../components/reader/ReaderView";
import { useDocumentStore } from "../../stores/document-store";
import { useLibraryStore } from "../../stores/library-store";
import { useCollectionsStore } from "../../stores/collections-store";
import { useSessionStore } from "../../stores/session-store";
import type { ReadingSession } from "../../domain/sessions/session";
import type { Document } from "../../lib/schemas";

vi.mock("../../services/pdf-service", () => ({
  pdfService: { loadDocument: vi.fn(), getPage: vi.fn() },
}));

// Heavy leaves under the shell; not the surface under test.
vi.mock("../../components/PdfViewer", () => ({
  PdfViewer: () => <div data-testid="pdf-viewer" />,
}));
vi.mock("../../components/playback-bar/AiPlaybackBar", () => ({
  AiPlaybackBar: () => <div data-testid="playback-bar" />,
}));

const { pdfService } = await import("../../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);

const LIBRARY_ROW: Document = {
  id: "doc-1",
  filePath: "/books/paper-1.pdf",
  title: "Paper 1",
  pageCount: 20,
  currentPage: 1, // deliberately divergent from the session's saved page
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: "2026-08-05T10:00:00Z",
  fileHash: null,
  createdAt: "2026-08-01T00:00:00Z",
} as Document;

const SESSION: ReadingSession = {
  id: "session-1",
  name: "Research Papers",
  documents: [
    {
      documentId: "doc-1",
      position: 0,
      currentPage: 7, // the saved page the reader was last on
      scrollPosition: 400,
      createdAt: "2026-08-05T10:00:00Z",
      title: "Paper 1",
      pageCount: 20,
    },
  ],
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-05T10:00:00Z",
  lastAccessedAt: "2026-08-05T10:00:00Z",
};

const SUMMARY = {
  id: "session-1",
  name: "Research Papers",
  documentCount: 1,
  lastAccessedAt: "2026-08-05T10:00:00Z",
  createdAt: "2026-08-01T00:00:00Z",
};

beforeEach(() => {
  useDocumentStore.getState().reset();
  useLibraryStore.getState().reset();
  useCollectionsStore.getState().reset();
  useSessionStore.getState().reset();
  loadDocument.mockReset();
  loadDocument.mockResolvedValue({ numPages: 20 } as unknown as PDFDocumentProxy);

  mockInvoke.mockImplementation((command: string) => {
    switch (command) {
      case "library_list_documents":
        return Promise.resolve([LIBRARY_ROW]);
      case "collections_list":
      case "collections_list_memberships":
        return Promise.resolve([]);
      case "library_heal_document":
      case "library_open_document":
        return Promise.resolve(LIBRARY_ROW);
      case "library_get_document":
        return Promise.resolve(LIBRARY_ROW);
      case "session_list":
        return Promise.resolve([SUMMARY]);
      case "session_restore":
        return Promise.resolve({
          success: true,
          session: SESSION,
          missingDocuments: [],
        });
      default:
        return Promise.resolve(null);
    }
  });
});

/** Open the session menu from the real Toolbar and wait for its list. */
async function openSessionMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
  return screen.findByRole("button", { name: /Research Papers/ });
}

describe("restoring a reading session", () => {
  it("opens the session's document at its saved page, leaving the library", async () => {
    render(<ReaderView />);

    // Reading home is showing first.
    expect(await screen.findByRole("heading", { name: "Library" })).toBeInTheDocument();

    fireEvent.click(await openSessionMenu());
    fireEvent.click(screen.getByRole("button", { name: /Research Papers/ }));

    // The reader must leave the library…
    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    // …and land on the SAVED page (7), not the library row's page (1).
    const state = useDocumentStore.getState();
    expect(state.currentDocument?.id).toBe("doc-1");
    expect(state.currentPage).toBe(7);
    expect(loadDocument).toHaveBeenCalledWith("/books/paper-1.pdf");
  });

  it("picks the document with the highest position (the one last read)", async () => {
    const twoDocs: ReadingSession = {
      ...SESSION,
      documents: [
        { ...SESSION.documents[0], position: 0 },
        {
          documentId: "doc-2",
          position: 1,
          currentPage: 12,
          scrollPosition: 0,
          createdAt: "2026-08-05T10:00:00Z",
          title: "Paper 2",
          pageCount: 15,
        },
      ],
    };
    mockInvoke.mockImplementation((command: string) => {
      if (command === "session_restore")
        return Promise.resolve({
          success: true,
          session: twoDocs,
          missingDocuments: [],
        });
      if (command === "session_list") return Promise.resolve([SUMMARY]);
      if (command === "library_get_document")
        return Promise.resolve({
          ...LIBRARY_ROW,
          id: "doc-2",
          filePath: "/books/paper-2.pdf",
          title: "Paper 2",
        });
      if (command === "library_open_document")
        return Promise.resolve({
          ...LIBRARY_ROW,
          id: "doc-2",
          filePath: "/books/paper-2.pdf",
          title: "Paper 2",
        });
      if (command === "library_list_documents")
        return Promise.resolve([
          LIBRARY_ROW,
          { ...LIBRARY_ROW, id: "doc-2", title: "Paper 2" },
        ]);
      return Promise.resolve(
        command === "collections_list" ||
          command === "collections_list_memberships"
          ? []
          : null,
      );
    });

    render(<ReaderView />);
    await screen.findByRole("heading", { name: "Library" });

    fireEvent.click(await openSessionMenu());
    fireEvent.click(screen.getByRole("button", { name: /Research Papers/ }));

    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );
    const state = useDocumentStore.getState();
    expect(state.currentDocument?.id).toBe("doc-2");
    expect(state.currentPage).toBe(12);
  });

  it("leaves the library showing when the session holds no documents", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "session_restore")
        return Promise.resolve({
          success: true,
          session: { ...SESSION, documents: [] },
          missingDocuments: [],
        });
      if (command === "session_list") return Promise.resolve([SUMMARY]);
      if (command === "library_list_documents")
        return Promise.resolve([LIBRARY_ROW]);
      if (command === "collections_list" || command === "collections_list_memberships")
        return Promise.resolve([]);
      return Promise.resolve(null);
    });

    render(<ReaderView />);
    await screen.findByRole("heading", { name: "Library" });

    fireEvent.click(await openSessionMenu());
    fireEvent.click(screen.getByRole("button", { name: /Research Papers/ }));

    // Nothing to open — the library stays; the reader is never stranded.
    expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Library" }),
    ).toBeInTheDocument();
  });
});
