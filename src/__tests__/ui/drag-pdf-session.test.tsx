import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { mockInvoke } from "../../../tests/setup";
import type { NativeFileDropEvent } from "../../lib/api/file-drop";
import type { Document } from "../../lib/schemas";
import { ReaderView } from "../../components/reader/ReaderView";
import { useDocumentStore } from "../../stores/document-store";
import { useLibraryStore } from "../../stores/library-store";
import { useCollectionsStore } from "../../stores/collections-store";
import { useSessionStore } from "../../stores/session-store";

let emit: (event: NativeFileDropEvent) => void;
const unlisten = vi.fn();

vi.mock("../../lib/api/file-drop", () => ({
  onNativeFileDrop: vi.fn(async (handler) => {
    emit = handler;
    return unlisten;
  }),
}));

vi.mock("../../services/pdf-service", () => ({
  pdfService: {
    loadDocument: vi.fn(),
    loadDocumentBound: vi.fn(),
    getPage: vi.fn(),
  },
  isScopeDenial: () => false,
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

const DROPPED: Document = {
  id: "a".repeat(64),
  filePath: "/books/Data Engineering.pdf",
  title: "Data Engineering",
  pageCount: 42,
  currentPage: 1,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: null,
  fileHash: "a".repeat(64),
  createdAt: "2026-08-25T10:00:00Z",
};

const SESSION = {
  id: "session-1",
  name: "Data Engineering",
  documents: [
    {
      documentId: DROPPED.id,
      position: 0,
      currentPage: 1,
      scrollPosition: 0,
      createdAt: "2026-08-25T10:00:00Z",
    },
  ],
  createdAt: "2026-08-25T10:00:00Z",
  updatedAt: "2026-08-25T10:00:00Z",
  lastAccessedAt: "2026-08-25T10:00:00Z",
};

const { pdfService } = await import("../../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);
const loadDocumentBound = vi.mocked(pdfService.loadDocumentBound);

beforeEach(() => {
  useDocumentStore.getState().reset();
  useLibraryStore.getState().reset();
  useCollectionsStore.getState().reset();
  useSessionStore.getState().reset();
  unlisten.mockClear();
  loadDocument.mockReset();
  loadDocumentBound.mockReset();
  const pdf = { numPages: 42 } as unknown as PDFDocumentProxy;
  loadDocumentBound.mockResolvedValue({ pdf, sha256: DROPPED.id });
  loadDocument.mockResolvedValue(pdf);

  mockInvoke.mockImplementation((command: string) => {
    switch (command) {
      case "library_get_document_by_path":
        return Promise.resolve(null);
      case "library_add_document":
      case "library_open_document":
        return Promise.resolve(DROPPED);
      case "highlights_list_for_document":
        return Promise.resolve({ highlights: [], total: 0 });
      case "library_list_documents":
      case "collections_list":
      case "collections_list_memberships":
      case "session_list":
        return Promise.resolve([]);
      case "session_create":
        return Promise.resolve(SESSION);
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

describe("drag a PDF into the shell", () => {
  it("shows the public target, opens the verified book, and reports an active session", async () => {
    render(<ReaderView />);
    await waitFor(() => expect(emit).toBeTypeOf("function"));

    act(() => emit({ type: "enter", paths: [DROPPED.filePath] }));
    expect(
      screen.getByRole("status", {
        name: "Drop one PDF to create a reading session",
      }),
    ).toBeInTheDocument();

    act(() => emit({ type: "drop", paths: [DROPPED.filePath] }));

    expect(await screen.findByTestId("pdf-viewer")).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Session “Data Engineering” created",
      }),
    ).toBeInTheDocument();
    expect(useDocumentStore.getState().currentDocument?.id).toBe(DROPPED.id);
    expect(useSessionStore.getState().activeSessionId).toBe("session-1");
    expect(mockInvoke).toHaveBeenCalledWith("session_create", {
      name: "Data Engineering",
      documentIds: [DROPPED.id],
    });
  });
});
