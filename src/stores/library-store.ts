import { create } from "zustand";
import type { Document } from "../lib/schemas";
import {
  libraryListDocuments,
  libraryRemoveDocument,
  libraryUpdateTitle,
  libraryCheckFileExists,
  libraryRelocateDocument,
  libraryHealDocument,
} from "../lib/tauri-invoke";

export type SortOrder = "recent" | "created" | "title";
export type ViewMode = "grid" | "list";

interface LibraryState {
  // Documents
  documents: Document[];
  isLoading: boolean;
  error: string | null;

  // Filters and sorting
  searchQuery: string;
  sortOrder: SortOrder;
  viewMode: ViewMode;

  // Selection state
  selectedDocumentId: string | null;

  // Actions
  loadDocuments: () => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  updateDocumentTitle: (id: string, title: string) => Promise<void>;
  relocateDocument: (id: string, newPath: string) => Promise<void>;
  healDocument: (id: string) => Promise<Document | null>;
  checkFileExists: (id: string) => Promise<boolean>;
  setSearchQuery: (query: string) => void;
  setSortOrder: (order: SortOrder) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedDocument: (id: string | null) => void;
  getFilteredDocuments: () => Document[];
  reset: () => void;
}

const initialState = {
  documents: [] as Document[],
  isLoading: false,
  error: null as string | null,
  searchQuery: "",
  sortOrder: "recent" as SortOrder,
  viewMode: "grid" as ViewMode,
  selectedDocumentId: null as string | null,
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  ...initialState,

  loadDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const { sortOrder } = get();
      const orderBy = sortOrder === "recent" ? "last_opened" : sortOrder;
      const documents = await libraryListDocuments(orderBy);
      set({ documents, isLoading: false });
    } catch (error) {
      console.error("Failed to load documents:", error);
      set({
        error:
          error instanceof Error ? error.message : "Failed to load library",
        isLoading: false,
      });
    }
  },

  removeDocument: async (id) => {
    try {
      await libraryRemoveDocument(id);
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
        selectedDocumentId:
          state.selectedDocumentId === id ? null : state.selectedDocumentId,
      }));
    } catch (error) {
      console.error("Failed to remove document:", error);
      throw error;
    }
  },

  updateDocumentTitle: async (id, title) => {
    try {
      const updated = await libraryUpdateTitle(id, title);
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === id ? { ...d, ...updated } : d,
        ),
      }));
    } catch (error) {
      console.error("Failed to update document title:", error);
      throw error;
    }
  },

  relocateDocument: async (id, newPath) => {
    try {
      const updated = await libraryRelocateDocument(id, newPath);
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === id ? { ...d, ...updated } : d,
        ),
      }));
    } catch (error) {
      console.error("Failed to relocate document:", error);
      throw error;
    }
  },

  /**
   * Relink a document by content hash and merge the result.
   *
   * Returns null instead of throwing when the file cannot be found: healing is
   * a best effort attempted on the way to opening a document, and a failure
   * here should leave the caller free to carry on and report the real problem
   * — that the file is gone — rather than replace it with a healing error.
   */
  healDocument: async (id) => {
    try {
      const healed = await libraryHealDocument(id);
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === id ? { ...d, ...healed } : d,
        ),
      }));
      return healed;
    } catch (error) {
      console.error("Failed to heal document:", error);
      return null;
    }
  },

  checkFileExists: async (id) => {
    try {
      const response = await libraryCheckFileExists(id);
      return response.exists;
    } catch {
      return false;
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSortOrder: (order) => {
    // Spec 248: the local list is already complete — sorting is derived
    // client-side (see deriveFilteredDocuments), so changing the order must
    // NOT refetch the whole library over IPC.
    set({ sortOrder: order });
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setSelectedDocument: (id) => set({ selectedDocumentId: id }),

  getFilteredDocuments: () =>
    deriveFilteredDocuments(
      get().documents,
      get().searchQuery,
      get().sortOrder,
    ),

  reset: () => set(initialState),
}));

// Selectors

/**
 * Pure derive (spec 248): exactly the previous filter+sort behavior, as a
 * function of the actual inputs. Array.prototype.sort is stable in the
 * runtime, so equal sort keys retain document order (tie behavior kept).
 * Inputs are never mutated — the sort works on a copy.
 */
export function deriveFilteredDocuments(
  documents: readonly Document[],
  searchQuery: string,
  sortOrder: SortOrder,
): Document[] {
  let filtered = documents as Document[];

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (d) =>
        d.title?.toLowerCase().includes(query) ||
        d.filePath.toLowerCase().includes(query),
    );
  }

  return [...filtered].sort((a, b) => {
    switch (sortOrder) {
      case "title":
        return (a.title || "").localeCompare(b.title || "");
      case "created":
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      case "recent":
      default:
        return (b.lastOpenedAt || b.createdAt || "").localeCompare(
          a.lastOpenedAt || a.createdAt || "",
        );
    }
  });
}

/** Single-entry memo keyed by the ACTUAL derive inputs (array identity). */
let filteredDocumentsMemo: {
  documents: Document[];
  searchQuery: string;
  sortOrder: SortOrder;
  result: Document[];
} | null = null;

/**
 * Memoized derived-documents selector (spec 248). Stable across selection,
 * view-mode and unrelated state changes: re-derivation happens only when a
 * real input (documents identity, query, sort order) changes. Pair with
 * `useLibraryStore(selectFilteredDocuments)` in the view so the derived
 * array identity is stable for downstream memos.
 */
export const selectFilteredDocuments = (state: LibraryState): Document[] => {
  const memo = filteredDocumentsMemo;
  if (
    memo !== null &&
    memo.documents === state.documents &&
    memo.searchQuery === state.searchQuery &&
    memo.sortOrder === state.sortOrder
  ) {
    return memo.result;
  }
  const result = deriveFilteredDocuments(
    state.documents,
    state.searchQuery,
    state.sortOrder,
  );
  filteredDocumentsMemo = {
    documents: state.documents,
    searchQuery: state.searchQuery,
    sortOrder: state.sortOrder,
    result,
  };
  return result;
};

export const selectDocumentCount = (state: LibraryState) =>
  state.documents.length;
export const selectHasDocuments = (state: LibraryState) =>
  state.documents.length > 0;
