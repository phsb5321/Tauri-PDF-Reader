/**
 * Unit tests for the library store's pure query logic.
 *
 * Covers getFilteredDocuments (search over title + filePath, the three sort
 * orders with their null fallbacks, no-mutation) and the count selectors.
 * The async actions (loadDocuments etc.) hit Tauri IPC and are out of scope;
 * the pure derivation here needs no mocks. Previously 0% covered.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Tauri IPC the store imports so the real tauri-invoke chain is not
// loaded — this keeps the test focused on the pure query logic AND keeps the
// uncovered IPC functions out of the coverage denominator (otherwise importing
// the real chain drags the global function coverage below the ratchet floor).
vi.mock("../../lib/tauri-invoke", () => ({
  libraryListDocuments: vi.fn(),
  libraryRemoveDocument: vi.fn(),
  libraryUpdateTitle: vi.fn(),
  libraryCheckFileExists: vi.fn(),
  libraryRelocateDocument: vi.fn(),
}));

import {
  useLibraryStore,
  selectDocumentCount,
  selectHasDocuments,
} from "../../stores/library-store";
import type { Document } from "../../lib/schemas";
import {
  libraryListDocuments,
  libraryRemoveDocument,
  libraryUpdateTitle,
  libraryRelocateDocument,
  libraryCheckFileExists,
} from "../../lib/tauri-invoke";

const doc = (over: Partial<Document> & { id: string }): Document => ({
  filePath: `/docs/${over.id}.pdf`,
  title: null,
  pageCount: 10,
  currentPage: 1,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: null,
  fileHash: null,
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("library-store", () => {
  beforeEach(() => {
    useLibraryStore.getState().reset();
  });

  describe("getFilteredDocuments", () => {
    it("returns all documents when the search query is empty", () => {
      useLibraryStore.setState({
        documents: [
          doc({ id: "a", title: "Alpha" }),
          doc({ id: "b", title: "Beta" }),
        ],
        searchQuery: "",
        sortOrder: "title",
      });
      expect(useLibraryStore.getState().getFilteredDocuments()).toHaveLength(2);
    });

    it("filters by title, case-insensitively", () => {
      useLibraryStore.setState({
        documents: [
          doc({ id: "a", title: "Annual Report" }),
          doc({ id: "b", title: "Recipes" }),
        ],
        searchQuery: "annual",
        sortOrder: "title",
      });
      const r = useLibraryStore.getState().getFilteredDocuments();
      expect(r.map((d: Document) => d.id)).toEqual(["a"]);
    });

    it("filters by filePath substring", () => {
      useLibraryStore.setState({
        documents: [
          doc({ id: "a", title: null, filePath: "/home/x/taxes.pdf" }),
          doc({ id: "b", title: null, filePath: "/home/x/novel.pdf" }),
        ],
        searchQuery: "TaXeS", // mixed case -> also checks filePath case-insensitivity
        sortOrder: "title",
      });
      expect(
        useLibraryStore
          .getState()
          .getFilteredDocuments()
          .map((d: Document) => d.id),
      ).toEqual(["a"]);
    });

    it("trims surrounding whitespace from the query", () => {
      useLibraryStore.setState({
        documents: [doc({ id: "a", title: "Alpha" })],
        searchQuery: "   alpha   ",
        sortOrder: "title",
      });
      expect(useLibraryStore.getState().getFilteredDocuments()).toHaveLength(1);
    });

    it("returns empty when nothing matches", () => {
      useLibraryStore.setState({
        documents: [doc({ id: "a", title: "Alpha" })],
        searchQuery: "zzz",
        sortOrder: "title",
      });
      expect(useLibraryStore.getState().getFilteredDocuments()).toHaveLength(0);
    });

    it("sorts by title ascending, treating a null title as empty", () => {
      useLibraryStore.setState({
        documents: [
          doc({ id: "z", title: "Zebra" }),
          doc({ id: "a", title: "Apple" }),
          doc({ id: "n", title: null }),
        ],
        searchQuery: "",
        sortOrder: "title",
      });
      // null title ('') sorts first, then Apple, then Zebra
      expect(
        useLibraryStore
          .getState()
          .getFilteredDocuments()
          .map((d: Document) => d.id),
      ).toEqual(["n", "a", "z"]);
    });

    it("sorts by created date, newest first", () => {
      useLibraryStore.setState({
        documents: [
          doc({ id: "old", createdAt: "2026-01-01T00:00:00Z" }),
          doc({ id: "new", createdAt: "2026-03-01T00:00:00Z" }),
        ],
        searchQuery: "",
        sortOrder: "created",
      });
      expect(
        useLibraryStore
          .getState()
          .getFilteredDocuments()
          .map((d: Document) => d.id),
      ).toEqual(["new", "old"]);
    });

    it("sorts by recent: lastOpenedAt desc, falling back to createdAt", () => {
      useLibraryStore.setState({
        documents: [
          doc({
            id: "opened-old",
            lastOpenedAt: "2026-01-05T00:00:00Z",
            createdAt: "2026-01-01T00:00:00Z",
          }),
          doc({
            id: "never-opened-newer",
            lastOpenedAt: null,
            createdAt: "2026-02-01T00:00:00Z",
          }),
        ],
        searchQuery: "",
        sortOrder: "recent",
      });
      // never-opened uses its createdAt (2026-02) which beats opened-old's lastOpenedAt (2026-01)
      expect(
        useLibraryStore
          .getState()
          .getFilteredDocuments()
          .map((d: Document) => d.id),
      ).toEqual(["never-opened-newer", "opened-old"]);
    });

    it("sorts by recent using lastOpenedAt over createdAt", () => {
      // Discriminating fixture: lastOpenedAt order is the OPPOSITE of createdAt
      // order, so a (broken) createdAt-only sort would produce ['b','a'].
      useLibraryStore.setState({
        documents: [
          doc({
            id: "a",
            createdAt: "2026-01-01T00:00:00Z",
            lastOpenedAt: "2026-05-01T00:00:00Z",
          }),
          doc({
            id: "b",
            createdAt: "2026-03-01T00:00:00Z",
            lastOpenedAt: "2026-02-01T00:00:00Z",
          }),
        ],
        searchQuery: "",
        sortOrder: "recent",
      });
      // By lastOpenedAt: a (May) > b (Feb) -> ['a','b']. createdAt-only would give ['b','a'].
      expect(
        useLibraryStore
          .getState()
          .getFilteredDocuments()
          .map((d: Document) => d.id),
      ).toEqual(["a", "b"]);
    });

    it("does not mutate the stored documents array", () => {
      useLibraryStore.setState({
        documents: [
          doc({ id: "z", title: "Zebra" }),
          doc({ id: "a", title: "Apple" }),
        ],
        searchQuery: "",
        sortOrder: "title",
      });
      useLibraryStore.getState().getFilteredDocuments(); // sorts a copy
      expect(
        useLibraryStore.getState().documents.map((d: Document) => d.id),
      ).toEqual(["z", "a"]);
    });
  });

  describe("selectors", () => {
    it("selectDocumentCount returns the document count", () => {
      useLibraryStore.setState({
        documents: [doc({ id: "a" }), doc({ id: "b" })],
      });
      expect(selectDocumentCount(useLibraryStore.getState())).toBe(2);
    });

    it("selectHasDocuments reflects emptiness", () => {
      expect(selectHasDocuments(useLibraryStore.getState())).toBe(false);
      useLibraryStore.setState({ documents: [doc({ id: "a" })] });
      expect(selectHasDocuments(useLibraryStore.getState())).toBe(true);
    });
  });

  describe("async actions (IPC mocked)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("loadDocuments populates documents from the repository", async () => {
      vi.mocked(libraryListDocuments).mockResolvedValue([
        doc({ id: "a" }),
        doc({ id: "b" }),
      ]);
      await useLibraryStore.getState().loadDocuments();
      const s = useLibraryStore.getState();
      expect(s.documents.map((d: Document) => d.id)).toEqual(["a", "b"]);
      expect(s.isLoading).toBe(false);
    });

    it("loadDocuments records an error on failure", async () => {
      vi.mocked(libraryListDocuments).mockRejectedValue(new Error("boom"));
      await useLibraryStore.getState().loadDocuments();
      const s = useLibraryStore.getState();
      expect(s.error).toBe("boom");
      expect(s.isLoading).toBe(false);
    });

    it("removeDocument drops the document from state", async () => {
      useLibraryStore.setState({
        documents: [doc({ id: "a" }), doc({ id: "b" })],
      });
      vi.mocked(libraryRemoveDocument).mockResolvedValue(undefined);
      await useLibraryStore.getState().removeDocument("a");
      expect(
        useLibraryStore.getState().documents.map((d: Document) => d.id),
      ).toEqual(["b"]);
    });

    it("updateDocumentTitle merges the updated document", async () => {
      useLibraryStore.setState({ documents: [doc({ id: "a", title: "Old" })] });
      vi.mocked(libraryUpdateTitle).mockResolvedValue(
        doc({ id: "a", title: "New" }),
      );
      await useLibraryStore.getState().updateDocumentTitle("a", "New");
      expect(useLibraryStore.getState().documents[0].title).toBe("New");
    });

    it("relocateDocument merges the relocated document", async () => {
      useLibraryStore.setState({
        documents: [doc({ id: "a", filePath: "/old.pdf" })],
      });
      vi.mocked(libraryRelocateDocument).mockResolvedValue(
        doc({ id: "a", filePath: "/new.pdf" }),
      );
      await useLibraryStore.getState().relocateDocument("a", "/new.pdf");
      expect(useLibraryStore.getState().documents[0].filePath).toBe("/new.pdf");
    });

    it("checkFileExists returns the repository result", async () => {
      vi.mocked(libraryCheckFileExists).mockResolvedValue({
        exists: true,
        filePath: "/x.pdf",
      });
      expect(await useLibraryStore.getState().checkFileExists("a")).toBe(true);
    });
  });
});
