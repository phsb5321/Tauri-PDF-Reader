import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { Document } from "../../lib/schemas";
import {
  documentsOnShelf,
  unfiledDocuments,
  type Membership,
} from "../../domain/library/shelves";
import {
  useLibraryStore,
  deriveFilteredDocuments,
  selectDocumentCount,
  selectFilteredDocuments,
} from "../../stores/library-store";

// Spec 240-style discipline on spec 248 (FINAL correction 2/2): adapter mock
// handles live in vi.hoisted so hoisted vi.mock factories never touch a
// not-yet-initialized binding. LibraryView is a NAMED export. Platform-free.

const {
  listDocuments,
  updateTitle,
  removeDocument,
  relocateDocument,
  healDocument,
  stableCollectionsFns,
} = vi.hoisted(() => {
  const listDocuments = vi.fn();
  const updateTitle = vi.fn();
  const removeDocument = vi.fn();
  const relocateDocument = vi.fn();
  const healDocument = vi.fn();
  const stableCollectionsFns = {
    loadShelves: vi.fn(async () => undefined),
    createShelf: vi.fn(),
    renameShelf: vi.fn(),
    deleteShelf: vi.fn(),
    fileDocument: vi.fn(),
    unfileDocument: vi.fn(),
    selectShelf: vi.fn(),
  };
  return {
    listDocuments,
    updateTitle,
    removeDocument,
    relocateDocument,
    healDocument,
    stableCollectionsFns,
  };
});

// Canonical adapter module (what the deprecated barrel re-exports).
vi.mock("../../lib/api/library", () => ({
  libraryListDocuments: listDocuments,
  libraryUpdateTitle: updateTitle,
  libraryRemoveDocument: removeDocument,
  libraryRelocateDocument: relocateDocument,
  libraryHealDocument: healDocument,
}));

// The store imports the deprecated barrel; same handles.
vi.mock("../../lib/tauri-invoke", () => ({
  libraryListDocuments: listDocuments,
  libraryUpdateTitle: updateTitle,
  libraryRemoveDocument: removeDocument,
  libraryRelocateDocument: relocateDocument,
  libraryHealDocument: healDocument,
}));

vi.mock("../../stores/collections-store", () => ({
  useCollectionsStore: () => ({
    shelves: [],
    memberships: [],
    selectedShelfId: null,
    ...stableCollectionsFns,
  }),
}));

vi.mock("./ResumeSection", () => ({ ResumeSection: () => <div /> }));
vi.mock("./DocumentCard", () => ({
  DocumentCard: (props: { document: Document }) => (
    <div data-testid="doc-card" data-doc-title={props.document.title} />
  ),
}));
vi.mock("./ShelfSidebar", () => ({ ShelfSidebar: () => <div /> }));
vi.mock("./SearchBar", () => ({ SearchBar: () => <div /> }));

import { LibraryView } from "./LibraryView";

function doc(id: string, overrides: Partial<Document> = {}): Document {
  return {
    id,
    filePath: `/books/${id}.pdf`,
    title: `Doc ${id}`,
    pageCount: 3,
    currentPage: 1,
    scrollPosition: 0,
    lastTtsChunkId: null,
    lastOpenedAt: null,
    fileHash: `hash-${id}`,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// Discriminating seed: recent/title/created orders are ALL different.
const SEED: Document[] = [
  doc("a", {
    title: "Alpha",
    lastOpenedAt: "2026-01-05T00:00:00Z",
    createdAt: "2026-01-10T00:00:00Z",
  }),
  doc("b", {
    title: "Beta",
    lastOpenedAt: "2026-03-01T00:00:00Z",
    createdAt: "2026-01-05T00:00:00Z",
  }),
  doc("c", {
    title: "Gamma",
    lastOpenedAt: "2026-02-01T00:00:00Z",
    createdAt: "2026-01-15T00:00:00Z",
  }),
];

const MEMBERSHIPS: Membership[] = [{ documentId: "a", collectionId: "s1" }];

const freshStore = (documents: Document[] = SEED) => {
  useLibraryStore.setState({
    documents,
    isLoading: false,
    error: null,
    searchQuery: "",
    sortOrder: "recent",
    viewMode: "grid",
    selectedDocumentId: null,
  });
  return useLibraryStore;
};

const titles = () =>
  selectFilteredDocuments(useLibraryStore.getState()).map((d) => d.title);

describe("library derived data — store contract (spec 248, correction 2)", () => {
  beforeEach(() => {
    listDocuments.mockReset();
    listDocuments.mockResolvedValue(SEED);
    updateTitle.mockReset();
    removeDocument.mockReset();
    removeDocument.mockResolvedValue(undefined);
    relocateDocument.mockReset();
    relocateDocument.mockResolvedValue(undefined);
    healDocument.mockReset();
    freshStore([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("initial load fetches exactly once", async () => {
    await act(async () => {
      await useLibraryStore.getState().loadDocuments();
    });
    expect(listDocuments).toHaveBeenCalledTimes(1);
    expect(useLibraryStore.getState().documents).toHaveLength(3);
  });

  it("recent/title/created produce three DIFFERENT orders with no extra fetch", async () => {
    await act(async () => {
      await useLibraryStore.getState().loadDocuments();
    });
    expect(listDocuments).toHaveBeenCalledTimes(1);

    const state = useLibraryStore.getState();
    expect(titles()).toEqual(["Beta", "Gamma", "Alpha"]); // recent desc

    act(() => {
      state.setSortOrder("title");
    });
    expect(titles()).toEqual(["Alpha", "Beta", "Gamma"]); // title asc

    act(() => {
      useLibraryStore.getState().setSortOrder("created");
    });
    expect(titles()).toEqual(["Gamma", "Alpha", "Beta"]); // created desc

    expect(listDocuments).toHaveBeenCalledTimes(1); // still no refetch
  });

  it("selection-only change keeps derived identity (memo hit)", () => {
    freshStore(SEED);
    const first = selectFilteredDocuments(useLibraryStore.getState());
    act(() => {
      useLibraryStore.getState().setSelectedDocument("b");
    });
    expect(selectFilteredDocuments(useLibraryStore.getState())).toBe(first);
  });

  it("viewMode-only change keeps derived identity (memo hit)", () => {
    freshStore(SEED);
    const first = selectFilteredDocuments(useLibraryStore.getState());
    act(() => {
      useLibraryStore.getState().setViewMode("list");
    });
    expect(selectFilteredDocuments(useLibraryStore.getState())).toBe(first);
  });

  it("query change recomputes correct filtered results", () => {
    freshStore(SEED);
    act(() => {
      useLibraryStore.getState().setSearchQuery("bet");
    });
    expect(titles()).toEqual(["Beta"]);
  });

  it("rename: typed adapter returns the updated Document; search follows", async () => {
    freshStore(SEED);
    // Merge into the EXISTING seed document — title Beta stays Beta except
    // for the intended rename; no field silently resets to builder defaults.
    updateTitle.mockResolvedValue({ ...SEED[2], title: "Zeta" });
    const before = selectFilteredDocuments(useLibraryStore.getState());
    await act(async () => {
      await useLibraryStore.getState().updateDocumentTitle("c", "Zeta");
    });
    const after = selectFilteredDocuments(useLibraryStore.getState());
    expect(after).not.toBe(before); // memo invalidated by documents change
    act(() => {
      useLibraryStore.getState().setSearchQuery("zet");
    });
    expect(titles()).toEqual(["Zeta"]);
    // Unrelated fields survive the merge (fixture merged, not rebuilt).
    expect(
      useLibraryStore.getState().documents.find((d) => d.id === "c")
        ?.lastOpenedAt,
    ).toBe("2026-02-01T00:00:00Z");
  });

  it("remove: derived list excludes the removed id with fresh identity", async () => {
    freshStore(SEED);
    const before = selectFilteredDocuments(useLibraryStore.getState());
    await act(async () => {
      await useLibraryStore.getState().removeDocument("a");
    });
    const after = selectFilteredDocuments(useLibraryStore.getState());
    expect(after).not.toBe(before);
    expect(after.map((d) => d.id)).toEqual(["b", "c"]);
  });

  it("relocate: merged into the seed document (Beta title kept) and searchable", async () => {
    freshStore(SEED);
    // Merge the path change into the existing synthetic seed document — do
    // NOT rebuild from builder defaults (that would silently reset Beta).
    relocateDocument.mockResolvedValue({
      ...SEED[1],
      filePath: "/moved/beta.pdf",
    });
    const before = selectFilteredDocuments(useLibraryStore.getState());
    await act(async () => {
      await useLibraryStore.getState().relocateDocument("b", "/moved/beta.pdf");
    });
    const after = selectFilteredDocuments(useLibraryStore.getState());
    expect(after).not.toBe(before);
    expect(after.find((d) => d.id === "b")?.title).toBe("Beta");
    act(() => {
      useLibraryStore.getState().setSearchQuery("/moved");
    });
    expect(titles()).toEqual(["Beta"]);
  });

  it("heal: merges the existing seed document and invalidates identity", async () => {
    freshStore(SEED);
    healDocument.mockResolvedValue({ ...SEED[0] });
    const before = selectFilteredDocuments(useLibraryStore.getState());
    let healed: Document | null = null;
    await act(async () => {
      healed = await useLibraryStore.getState().healDocument("a");
    });
    expect(healed?.id).toBe("a");
    const after = selectFilteredDocuments(useLibraryStore.getState());
    expect(after).not.toBe(before);
    expect(after).toHaveLength(3);
  });

  it("explicit load remains the refresh path over a DISTINCT array", async () => {
    // First fetch: the seed. Second fetch: a DISTINCT copied array — real IPC
    // returns a fresh array every time, which is what invalidates the memo.
    listDocuments.mockResolvedValueOnce(SEED).mockResolvedValueOnce([...SEED]);
    await act(async () => {
      await useLibraryStore.getState().loadDocuments();
    });
    const before = selectFilteredDocuments(useLibraryStore.getState());
    await act(async () => {
      await useLibraryStore.getState().loadDocuments();
    });
    expect(listDocuments).toHaveBeenCalledTimes(2);
    expect(selectFilteredDocuments(useLibraryStore.getState())).not.toBe(
      before,
    );
  });

  it("equal sort values retain stable document order", () => {
    freshStore([
      doc("x", { lastOpenedAt: "2026-05-01T00:00:00Z", title: "Same" }),
      doc("y", { lastOpenedAt: "2026-05-01T00:00:00Z", title: "Same" }),
    ]);
    const ids = selectFilteredDocuments(useLibraryStore.getState()).map(
      (d) => d.id,
    );
    expect(ids).toEqual(["x", "y"]);
  });

  it("complete-library counts are unaffected by the search box", () => {
    freshStore(SEED);
    act(() => {
      useLibraryStore.getState().setSearchQuery("alpha");
    });
    expect(selectDocumentCount(useLibraryStore.getState())).toBe(3);
  });

  it("derive never mutates a frozen input array", () => {
    const frozen = Object.freeze(SEED.map((d) => Object.freeze({ ...d })));
    expect(() => deriveFilteredDocuments(frozen, "", "recent")).not.toThrow();
    expect(frozen).toHaveLength(3);
  });
});

describe("shelf helpers stay input-driven with the real Membership shape", () => {
  it("documentsOnShelf/unfiledDocuments use collectionId (no masking)", () => {
    freshStore(SEED);
    const onShelf = documentsOnShelf(
      useLibraryStore.getState().documents,
      MEMBERSHIPS,
      "s1",
    );
    expect(onShelf.map((d) => d.id)).toEqual(["a"]);
    expect(
      unfiledDocuments(useLibraryStore.getState().documents, MEMBERSHIPS).map(
        (d) => d.id,
      ),
    ).toEqual(["b", "c"]);
  });
});

describe("LibraryView contract — order changes without refetch (final)", () => {
  beforeEach(() => {
    listDocuments.mockReset();
    listDocuments.mockResolvedValue(SEED);
    updateTitle.mockReset();
    removeDocument.mockReset();
    removeDocument.mockResolvedValue(undefined);
    relocateDocument.mockReset();
    relocateDocument.mockResolvedValue(undefined);
    healDocument.mockReset();
    freshStore([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("named-export view mounts, loads once, sort via public label reorders cards", async () => {
    render(
      <LibraryView
        onDocumentSelect={vi.fn()}
        onResumeAndPlay={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenDocument={vi.fn()}
      />,
    );
    await vi.waitFor(() => {
      expect(screen.getAllByTestId("doc-card")[0]).toHaveAttribute(
        "data-doc-title",
        "Beta",
      ); // recent order first
    });
    expect(listDocuments).toHaveBeenCalledTimes(1);

    // Public accessible label from LibraryView's <label htmlFor="sort-select">.
    const sortSelect = screen.getByLabelText("Sort:");
    act(() => {
      fireEvent.change(sortSelect, { target: { value: "title" } });
    });
    const titles = screen
      .getAllByTestId("doc-card")
      .map((el) => el.getAttribute("data-doc-title"));
    expect(titles).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(listDocuments).toHaveBeenCalledTimes(1); // no refetch on sort
  });
});
