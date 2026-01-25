import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';

// Check if running in Tauri environment
function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' &&
         '__TAURI_INTERNALS__' in window &&
         window.__TAURI_INTERNALS__ !== undefined;
}

// Dynamic import for Tauri fs plugin (only in Tauri context)
async function readFileFromTauri(filePath: string): Promise<Uint8Array> {
  if (!isTauriAvailable()) {
    throw new Error('Not running in Tauri environment. Please use the desktop app to open local files.');
  }
  const { readFile } = await import('@tauri-apps/plugin-fs');
  return readFile(filePath);
}

// Extend Window interface for Tauri
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

// Define TextItem interface for PDF.js text content
interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

// Configure PDF.js worker
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface PageRenderOptions {
  canvas: HTMLCanvasElement;
  scale: number;
  page: PDFPageProxy;
  /** Optional output scale override (for quality modes). If not provided, uses RenderPolicy. */
  outputScale?: number;
}

// Type guard for TextItem
function isTextItem(item: unknown): item is PdfTextItem {
  return typeof item === 'object' && item !== null && 'str' in item && 'transform' in item;
}

export interface TextContent {
  text: string;
  items: Array<{
    str: string;
    transform: number[];
    width: number;
    height: number;
  }>;
}

/**
 * PDF service for loading and rendering PDF documents
 */
export const pdfService = {
  /**
   * Load a PDF document from a local file path
   * Uses Tauri's fs plugin to read the file as binary data
   */
  async loadDocument(filePath: string): Promise<PDFDocumentProxy> {
    console.log('[PDF Service] Loading document:', filePath);

    try {
      // Read the file as binary data using Tauri's fs plugin
      console.log('[PDF Service] Reading file with fs plugin...');
      console.log('[PDF Service] Tauri available:', isTauriAvailable());
      const fileData = await readFileFromTauri(filePath);
      console.log('[PDF Service] File read successfully, size:', fileData.byteLength, 'bytes');

      console.log('[PDF Service] Creating PDF document...');
      const loadingTask = getDocument({
        data: fileData,
        // Enable built-in CMap support for better character rendering
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;
      console.log('[PDF Service] PDF loaded successfully, pages:', pdf.numPages);
      return pdf;
    } catch (error) {
      console.error('[PDF Service] Error loading PDF:', error);
      // Handle common PDF errors
      if (error instanceof Error) {
        console.error('[PDF Service] Error message:', error.message);
        if (error.message.includes('password')) {
          throw new Error('PDF_PASSWORD_REQUIRED: This PDF is password protected');
        }
        if (error.message.includes('Invalid PDF')) {
          throw new Error('PDF_INVALID: The file is not a valid PDF or is corrupted');
        }
        if (error.message.includes('denied') || error.message.includes('permission')) {
          throw new Error('PDF_ACCESS_DENIED: Cannot access the file. Check file permissions.');
        }
      }
      throw error;
    }
  },

  /**
   * Load a PDF from a URL (for testing/development)
   */
  async loadDocumentFromUrl(url: string): Promise<PDFDocumentProxy> {
    const loadingTask = getDocument({
      url,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
    });

    return loadingTask.promise;
  },

  /**
   * Get a specific page from a PDF document
   */
  async getPage(pdf: PDFDocumentProxy, pageNumber: number): Promise<PDFPageProxy> {
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error(`Invalid page number: ${pageNumber}. Document has ${pdf.numPages} pages.`);
    }
    return pdf.getPage(pageNumber);
  },

  /**
   * Render a PDF page to a canvas
   * Uses the official PDF.js HiDPI approach with transform matrix
   * Reference: https://mozilla.github.io/pdf.js/examples/
   *
   * @param options.canvas - Canvas element to render to
   * @param options.scale - Zoom level (1.0 = 100%)
   * @param options.page - PDF.js page object
   * @param options.outputScale - Optional output scale override (for quality modes)
   * @returns RenderTask that can be cancelled
   */
  renderPage(options: PageRenderOptions): { promise: Promise<void>; cancel: () => void } {
    const { canvas, scale, page, outputScale: providedOutputScale } = options;

    // Get viewport at the desired scale
    const viewport = page.getViewport({ scale });

    // Support HiDPI screens
    // If outputScale is provided (from RenderPolicy), use it; otherwise use DPR with 2x minimum
    const devicePixelRatio = window.devicePixelRatio || 1;
    const outputScale = providedOutputScale ?? Math.max(devicePixelRatio, 2);

    // Set canvas physical dimensions (scaled for HiDPI)
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);

    // Set canvas CSS dimensions (logical size on screen)
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    // Get hardware-accelerated 2D context with optimal settings
    const context = canvas.getContext('2d', {
      alpha: false,           // Opaque canvas - faster rendering (PDF.js uses opaque background)
      desynchronized: true,   // Direct GPU→display path (critical for Tauri WebView performance)
      willReadFrequently: false, // Keep GPU acceleration enabled
    });
    if (!context) {
      throw new Error('Could not get canvas 2D context');
    }

    // Enable high-quality image rendering
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // Create transform matrix for HiDPI rendering
    const transform: [number, number, number, number, number, number] | undefined =
      outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

    const renderContext = {
      canvasContext: context,
      transform: transform,
      viewport: viewport,
    };

    // Return both the promise and a cancel function
    const renderTask = page.render(renderContext);

    return {
      promise: renderTask.promise.then(() => {}),
      cancel: () => {
        renderTask.cancel();
      },
    };
  },

  /**
   * Legacy async renderPage (for backward compatibility)
   * @deprecated Use renderPage() which returns a cancellable task
   */
  async renderPageAsync(options: PageRenderOptions): Promise<void> {
    const { promise } = this.renderPage(options);
    await promise;
  },

  /**
   * Get text content from a PDF page
   */
  async getPageText(page: PDFPageProxy): Promise<TextContent> {
    const textContent = await page.getTextContent();

    const items: PdfTextItem[] = [];
    for (const rawItem of textContent.items) {
      if (isTextItem(rawItem)) {
        items.push({
          str: rawItem.str,
          transform: rawItem.transform,
          width: rawItem.width,
          height: rawItem.height,
        });
      }
    }

    const text = items.map((item) => item.str).join(' ');

    return { text, items };
  },

  /**
   * Get the viewport dimensions for a page at a given scale
   */
  getViewport(page: PDFPageProxy, scale: number) {
    return page.getViewport({ scale });
  },

  /**
   * Calculate scale to fit page width within a container
   */
  calculateFitWidthScale(page: PDFPageProxy, containerWidth: number): number {
    const viewport = page.getViewport({ scale: 1 });
    return containerWidth / viewport.width;
  },

  /**
   * Calculate scale to fit entire page within a container
   */
  calculateFitPageScale(page: PDFPageProxy, containerWidth: number, containerHeight: number): number {
    const viewport = page.getViewport({ scale: 1 });
    const scaleX = containerWidth / viewport.width;
    const scaleY = containerHeight / viewport.height;
    return Math.min(scaleX, scaleY);
  },

  /**
   * Check if a PDF has a text layer (for OCR detection)
   */
  async hasTextLayer(pdf: PDFDocumentProxy): Promise<boolean> {
    try {
      // Check first few pages for text content
      const pagesToCheck = Math.min(3, pdf.numPages);

      for (let i = 1; i <= pagesToCheck; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        if (textContent.items.length > 0) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  },

  /**
   * Get the PDF outline (table of contents)
   */
  async getOutline(pdf: PDFDocumentProxy): Promise<OutlineItem[]> {
    try {
      const outline = await pdf.getOutline();

      if (!outline) {
        return [];
      }

      return processOutlineItems(outline, pdf);
    } catch (error) {
      console.error('Error getting PDF outline:', error);
      return [];
    }
  },
};

/**
 * Table of contents item
 */
export interface OutlineItem {
  title: string;
  pageNumber: number | null;
  children: OutlineItem[];
}

/**
 * Process PDF.js outline items recursively
 */
async function processOutlineItems(
  items: unknown[],
  pdf: PDFDocumentProxy
): Promise<OutlineItem[]> {
  const result: OutlineItem[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const outlineItem = item as {
      title?: string;
      dest?: unknown;
      items?: unknown[];
    };

    let pageNumber: number | null = null;

    // Resolve destination to page number
    if (outlineItem.dest) {
      try {
        let dest: unknown = outlineItem.dest;

        // Handle string destinations (named destinations)
        if (typeof dest === 'string') {
          const resolvedDest = await pdf.getDestination(dest);
          dest = resolvedDest;
        }

        if (Array.isArray(dest) && dest.length > 0) {
          const ref = dest[0];
          if (ref && typeof ref === 'object' && 'num' in ref) {
            const pageIndex = await pdf.getPageIndex(ref);
            pageNumber = pageIndex + 1; // Convert 0-indexed to 1-indexed
          }
        }
      } catch (e) {
        console.warn('Could not resolve outline destination:', e);
      }
    }

    const children = outlineItem.items
      ? await processOutlineItems(outlineItem.items, pdf)
      : [];

    result.push({
      title: outlineItem.title || 'Untitled',
      pageNumber,
      children,
    });
  }

  return result;
}
