import { useRef, useCallback, useEffect } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

interface CachedPage {
  page: PDFPageProxy;
  canvas: HTMLCanvasElement;
  scale: number;
  timestamp: number;
}

interface PageCacheOptions {
  maxCacheSize?: number;
  preRenderAdjacent?: number;
}

const DEFAULT_MAX_CACHE_SIZE = 10;
const DEFAULT_PRE_RENDER_ADJACENT = 2;

/**
 * Hook for caching and pre-rendering PDF pages for smoother navigation
 * Particularly useful for large PDFs (1000+ pages)
 */
export function usePageCache(
  pdfDocument: PDFDocumentProxy | null,
  currentPage: number,
  scale: number,
  options: PageCacheOptions = {}
) {
  const {
    maxCacheSize = DEFAULT_MAX_CACHE_SIZE,
    preRenderAdjacent = DEFAULT_PRE_RENDER_ADJACENT,
  } = options;

  const cacheRef = useRef<Map<number, CachedPage>>(new Map());
  const preRenderingRef = useRef<Set<number>>(new Set());

  /**
   * Get a page from cache or load it
   */
  const getPage = useCallback(
    async (pageNumber: number): Promise<PDFPageProxy | null> => {
      if (!pdfDocument) return null;
      if (pageNumber < 1 || pageNumber > pdfDocument.numPages) return null;

      const cached = cacheRef.current.get(pageNumber);
      if (cached) {
        // Update timestamp for LRU
        cached.timestamp = Date.now();
        return cached.page;
      }

      try {
        const page = await pdfDocument.getPage(pageNumber);
        return page;
      } catch (err) {
        console.error(`Failed to load page ${pageNumber}:`, err);
        return null;
      }
    },
    [pdfDocument]
  );

  /**
   * Pre-render a page to an offscreen canvas
   */
  const preRenderPage = useCallback(
    async (pageNumber: number): Promise<HTMLCanvasElement | null> => {
      if (!pdfDocument) return null;
      if (pageNumber < 1 || pageNumber > pdfDocument.numPages) return null;

      // Check if already cached with same scale
      const cached = cacheRef.current.get(pageNumber);
      if (cached && cached.scale === scale) {
        cached.timestamp = Date.now();
        return cached.canvas;
      }

      // Check if already being pre-rendered
      if (preRenderingRef.current.has(pageNumber)) {
        return null;
      }

      preRenderingRef.current.add(pageNumber);

      try {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        // Create offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Could not get canvas 2D context');
        }

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        // Cache the rendered page
        cacheRef.current.set(pageNumber, {
          page,
          canvas,
          scale,
          timestamp: Date.now(),
        });

        // Evict old entries if cache is full
        evictOldEntries(cacheRef.current, maxCacheSize);

        return canvas;
      } catch (err) {
        console.error(`Failed to pre-render page ${pageNumber}:`, err);
        return null;
      } finally {
        preRenderingRef.current.delete(pageNumber);
      }
    },
    [pdfDocument, scale, maxCacheSize]
  );

  /**
   * Get a pre-rendered canvas for a page (if available)
   */
  const getCachedCanvas = useCallback(
    (pageNumber: number): HTMLCanvasElement | null => {
      const cached = cacheRef.current.get(pageNumber);
      if (cached && cached.scale === scale) {
        cached.timestamp = Date.now();
        return cached.canvas;
      }
      return null;
    },
    [scale]
  );

  /**
   * Pre-render adjacent pages when current page changes
   */
  useEffect(() => {
    if (!pdfDocument || preRenderAdjacent <= 0) return;

    const pagesToPreRender: number[] = [];

    // Add adjacent pages (before and after current)
    for (let i = 1; i <= preRenderAdjacent; i++) {
      const nextPage = currentPage + i;
      const prevPage = currentPage - i;

      if (nextPage <= pdfDocument.numPages) {
        pagesToPreRender.push(nextPage);
      }
      if (prevPage >= 1) {
        pagesToPreRender.push(prevPage);
      }
    }

    // Pre-render in priority order (closer pages first)
    pagesToPreRender.forEach((pageNum) => {
      // Use requestIdleCallback for non-blocking pre-rendering
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(
          () => {
            preRenderPage(pageNum);
          },
          { timeout: 5000 }
        );
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          preRenderPage(pageNum);
        }, 100);
      }
    });
  }, [pdfDocument, currentPage, preRenderAdjacent, preRenderPage]);

  /**
   * Clear cache when document changes
   */
  useEffect(() => {
    return () => {
      cacheRef.current.clear();
      preRenderingRef.current.clear();
    };
  }, [pdfDocument]);

  /**
   * Clear cache when scale changes significantly
   */
  useEffect(() => {
    // Clear cache when scale changes - old renders won't be valid
    cacheRef.current.clear();
  }, [scale]);

  return {
    getPage,
    preRenderPage,
    getCachedCanvas,
    cacheSize: cacheRef.current.size,
    clearCache: () => cacheRef.current.clear(),
  };
}

/**
 * Evict oldest entries from cache using LRU strategy
 */
function evictOldEntries(cache: Map<number, CachedPage>, maxSize: number): void {
  if (cache.size <= maxSize) return;

  // Sort entries by timestamp (oldest first)
  const entries = Array.from(cache.entries()).sort(
    ([, a], [, b]) => a.timestamp - b.timestamp
  );

  // Remove oldest entries until we're at max size
  const toRemove = entries.slice(0, cache.size - maxSize);
  for (const [pageNum] of toRemove) {
    cache.delete(pageNum);
  }
}

/**
 * For large PDFs, determines which pages should be in the "virtual window"
 * This is useful for continuous scroll views
 */
export function getVirtualPageWindow(
  currentPage: number,
  totalPages: number,
  windowSize: number = 5
): { start: number; end: number; pages: number[] } {
  const halfWindow = Math.floor(windowSize / 2);

  let start = currentPage - halfWindow;
  let end = currentPage + halfWindow;

  // Adjust for boundaries
  if (start < 1) {
    end += 1 - start;
    start = 1;
  }

  if (end > totalPages) {
    start -= end - totalPages;
    end = totalPages;
  }

  // Clamp start
  start = Math.max(1, start);

  // Generate page numbers in the window
  const pages: number[] = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return { start, end, pages };
}
