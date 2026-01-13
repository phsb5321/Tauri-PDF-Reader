import { create } from 'zustand';
import type { Document, Highlight } from '../lib/schemas';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface DocumentState {
  // Current document
  currentDocument: Document | null;
  pdfDocument: PDFDocumentProxy | null;

  // Navigation
  currentPage: number;
  totalPages: number;
  scrollPosition: number;

  // Zoom
  zoomLevel: number;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Text layer detection (for scanned PDFs)
  hasTextLayer: boolean | null;
  textLayerChecked: boolean;

  // Highlights for current document
  highlights: Highlight[];
  highlightsForPage: Map<number, Highlight[]>;

  // Selection state
  selectedHighlightId: string | null;

  // Actions
  setDocument: (doc: Document | null) => void;
  setPdfDocument: (pdf: PDFDocumentProxy | null) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setScrollPosition: (position: number) => void;
  setZoomLevel: (zoom: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasTextLayer: (hasText: boolean) => void;
  setHighlights: (highlights: Highlight[]) => void;
  addHighlight: (highlight: Highlight) => void;
  removeHighlight: (id: string) => void;
  updateHighlight: (id: string, updates: Partial<Highlight>) => void;
  setSelectedHighlight: (id: string | null) => void;
  getHighlightsForPage: (page: number) => Highlight[];
  reset: () => void;
}

const initialState = {
  currentDocument: null as Document | null,
  pdfDocument: null as PDFDocumentProxy | null,
  currentPage: 1,
  totalPages: 0,
  scrollPosition: 0,
  zoomLevel: 1.0,
  isLoading: false,
  error: null as string | null,
  hasTextLayer: null as boolean | null,
  textLayerChecked: false,
  highlights: [] as Highlight[],
  highlightsForPage: new Map<number, Highlight[]>(),
  selectedHighlightId: null as string | null,
};

export const useDocumentStore = create<DocumentState>((set, get) => ({
  ...initialState,

  setDocument: (doc) => {
    if (doc) {
      set({
        currentDocument: doc,
        currentPage: doc.currentPage,
        scrollPosition: doc.scrollPosition,
      });
    } else {
      set({ currentDocument: null });
    }
  },

  setPdfDocument: (pdf) =>
    set({
      pdfDocument: pdf,
      totalPages: pdf?.numPages ?? 0,
      // Reset text layer check for new document
      hasTextLayer: null,
      textLayerChecked: false,
    }),

  setCurrentPage: (page) => {
    const { totalPages } = get();
    const clampedPage = Math.max(1, Math.min(page, totalPages || 1));
    set({ currentPage: clampedPage });
  },

  setTotalPages: (total) => set({ totalPages: total }),

  setScrollPosition: (position) => {
    const clampedPosition = Math.max(0, Math.min(1, position));
    set({ scrollPosition: clampedPosition });
  },

  setZoomLevel: (zoom) => {
    const clampedZoom = Math.max(0.25, Math.min(4.0, zoom));
    set({ zoomLevel: clampedZoom });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  setHasTextLayer: (hasText) => set({ hasTextLayer: hasText, textLayerChecked: true }),

  setHighlights: (highlights) => {
    // Group highlights by page for efficient lookup
    const highlightsForPage = new Map<number, Highlight[]>();
    for (const highlight of highlights) {
      const pageHighlights = highlightsForPage.get(highlight.pageNumber) ?? [];
      pageHighlights.push(highlight);
      highlightsForPage.set(highlight.pageNumber, pageHighlights);
    }
    set({ highlights, highlightsForPage });
  },

  addHighlight: (highlight) => {
    const { highlights, highlightsForPage } = get();
    const newHighlights = [...highlights, highlight];

    // Update page-grouped highlights
    const newHighlightsForPage = new Map(highlightsForPage);
    const pageHighlights = newHighlightsForPage.get(highlight.pageNumber) ?? [];
    newHighlightsForPage.set(highlight.pageNumber, [...pageHighlights, highlight]);

    set({ highlights: newHighlights, highlightsForPage: newHighlightsForPage });
  },

  removeHighlight: (id) => {
    const { highlights, highlightsForPage, selectedHighlightId } = get();
    const highlight = highlights.find((h) => h.id === id);
    if (!highlight) return;

    const newHighlights = highlights.filter((h) => h.id !== id);

    // Update page-grouped highlights
    const newHighlightsForPage = new Map(highlightsForPage);
    const pageHighlights = newHighlightsForPage.get(highlight.pageNumber) ?? [];
    newHighlightsForPage.set(
      highlight.pageNumber,
      pageHighlights.filter((h) => h.id !== id)
    );

    set({
      highlights: newHighlights,
      highlightsForPage: newHighlightsForPage,
      // Clear selection if deleted highlight was selected
      selectedHighlightId: selectedHighlightId === id ? null : selectedHighlightId,
    });
  },

  updateHighlight: (id, updates) => {
    const { highlights } = get();
    const newHighlights = highlights.map((h) =>
      h.id === id ? { ...h, ...updates } : h
    );

    // Rebuild page-grouped highlights
    const newHighlightsForPage = new Map<number, Highlight[]>();
    for (const highlight of newHighlights) {
      const pageHighlights = newHighlightsForPage.get(highlight.pageNumber) ?? [];
      pageHighlights.push(highlight);
      newHighlightsForPage.set(highlight.pageNumber, pageHighlights);
    }

    set({ highlights: newHighlights, highlightsForPage: newHighlightsForPage });
  },

  setSelectedHighlight: (id) => set({ selectedHighlightId: id }),

  getHighlightsForPage: (page) => {
    const { highlightsForPage } = get();
    return highlightsForPage.get(page) ?? [];
  },

  reset: () => set(initialState),
}));
