import { create } from "zustand";
import {
  collectionsAddDocument,
  collectionsCreate,
  collectionsDelete,
  collectionsList,
  collectionsListMemberships,
  collectionsRemoveDocument,
  collectionsRename,
} from "../lib/api";
import type { Collection, CollectionMembership } from "../lib/schemas";
import { ALL_DOCUMENTS } from "../domain/library/shelves";

interface CollectionsState {
  shelves: Collection[];
  memberships: CollectionMembership[];
  /** `null` means no shelf selected — show the whole library. */
  selectedShelfId: string | null;
  isLoading: boolean;
  error: string | null;

  loadShelves: () => Promise<void>;
  createShelf: (name: string) => Promise<void>;
  renameShelf: (id: string, name: string) => Promise<void>;
  deleteShelf: (id: string) => Promise<void>;
  fileDocument: (shelfId: string, documentId: string) => Promise<void>;
  unfileDocument: (shelfId: string, documentId: string) => Promise<void>;
  selectShelf: (id: string | null) => void;
  reset: () => void;
}

const initialState = {
  shelves: [] as Collection[],
  memberships: [] as CollectionMembership[],
  selectedShelfId: ALL_DOCUMENTS,
  isLoading: false,
  error: null as string | null,
};

// Tauri IPC rejects with a plain string, so that case is worth surfacing. Any
// other value is not: `String(undefined)` is the *truthy* "undefined", which
// would shoulder the fallback aside and show the user a word instead of a
// reason.
const message = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error !== "") return error;
  return fallback;
};

export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  ...initialState,

  loadShelves: async () => {
    set({ isLoading: true, error: null });
    try {
      // Both in one pass: a shelf list without its memberships would render
      // counts the grid cannot honour.
      const [shelves, memberships] = await Promise.all([
        collectionsList(),
        collectionsListMemberships(),
      ]);
      set({ shelves, memberships, isLoading: false });
    } catch (error) {
      set({
        error: message(error, "Failed to load shelves"),
        isLoading: false,
      });
    }
  },

  createShelf: async (name) => {
    set({ error: null });
    try {
      await collectionsCreate(name);
      await get().loadShelves();
    } catch (error) {
      set({ error: message(error, "Failed to create shelf") });
    }
  },

  renameShelf: async (id, name) => {
    set({ error: null });
    try {
      await collectionsRename(id, name);
      await get().loadShelves();
    } catch (error) {
      set({ error: message(error, "Failed to rename shelf") });
    }
  },

  deleteShelf: async (id) => {
    set({ error: null });
    try {
      await collectionsDelete(id);
      // Selecting a shelf that no longer exists would filter the grid down to
      // nothing with no way back.
      if (get().selectedShelfId === id) set({ selectedShelfId: ALL_DOCUMENTS });
      await get().loadShelves();
    } catch (error) {
      set({ error: message(error, "Failed to delete shelf") });
    }
  },

  fileDocument: async (shelfId, documentId) => {
    set({ error: null });
    try {
      await collectionsAddDocument(shelfId, documentId);
      await get().loadShelves();
    } catch (error) {
      set({ error: message(error, "Failed to add to shelf") });
    }
  },

  unfileDocument: async (shelfId, documentId) => {
    set({ error: null });
    try {
      await collectionsRemoveDocument(shelfId, documentId);
      await get().loadShelves();
    } catch (error) {
      set({ error: message(error, "Failed to remove from shelf") });
    }
  },

  selectShelf: (id) => set({ selectedShelfId: id }),

  reset: () => set(initialState),
}));
