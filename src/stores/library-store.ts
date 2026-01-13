import { create } from 'zustand';
import type { Document } from '../lib/schemas';
import {
  libraryListDocuments,
  libraryRemoveDocument,
  libraryUpdateTitle,
  libraryCheckFileExists,
  libraryRelocateDocument,
} from '../lib/tauri-invoke';

export type SortOrder = 'recent' | 'created' | 'title';
export type ViewMode = 'grid' | 'list';

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
  searchQuery: '',
  sortOrder: 'recent' as SortOrder,
  viewMode: 'grid' as ViewMode,
  selectedDocumentId: null as string | null,
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  ...initialState,

  loadDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const { sortOrder } = get();
      const orderBy = sortOrder === 'recent' ? 'last_opened' : sortOrder;
      const documents = await libraryListDocuments(orderBy);
      set({ documents, isLoading: false });
    } catch (error) {
      console.error('Failed to load documents:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load library',
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
      console.error('Failed to remove document:', error);
      throw error;
    }
  },

  updateDocumentTitle: async (id, title) => {
    try {
      const updated = await libraryUpdateTitle(id, title);
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === id ? { ...d, ...updated } : d
        ),
      }));
    } catch (error) {
      console.error('Failed to update document title:', error);
      throw error;
    }
  },

  relocateDocument: async (id, newPath) => {
    try {
      const updated = await libraryRelocateDocument(id, newPath);
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === id ? { ...d, ...updated } : d
        ),
      }));
    } catch (error) {
      console.error('Failed to relocate document:', error);
      throw error;
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
    set({ sortOrder: order });
    // Reload to get properly sorted results
    get().loadDocuments();
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setSelectedDocument: (id) => set({ selectedDocumentId: id }),

  getFilteredDocuments: () => {
    const { documents, searchQuery, sortOrder } = get();

    let filtered = documents;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = documents.filter(
        (d) =>
          d.title?.toLowerCase().includes(query) ||
          d.filePath.toLowerCase().includes(query)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortOrder) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'created':
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        case 'recent':
        default:
          return (b.lastOpenedAt || b.createdAt || '').localeCompare(
            a.lastOpenedAt || a.createdAt || ''
          );
      }
    });
  },

  reset: () => set(initialState),
}));

// Selectors
export const selectDocumentCount = (state: LibraryState) => state.documents.length;
export const selectHasDocuments = (state: LibraryState) => state.documents.length > 0;
