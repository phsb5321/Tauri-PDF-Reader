import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import { convertFileSrc } from '@tauri-apps/api/core';

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
   * Uses Tauri's asset protocol for secure local file access
   */
  async loadDocument(filePath: string): Promise<PDFDocumentProxy> {
    // Convert local file path to asset URL for Tauri
    const assetUrl = convertFileSrc(filePath);

    try {
      const loadingTask = getDocument({
        url: assetUrl,
        // Enable built-in CMap support for better character rendering
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;
      return pdf;
    } catch (error) {
      // Handle common PDF errors
      if (error instanceof Error) {
        if (error.message.includes('password')) {
          throw new Error('PDF_PASSWORD_REQUIRED: This PDF is password protected');
        }
        if (error.message.includes('Invalid PDF')) {
          throw new Error('PDF_INVALID: The file is not a valid PDF or is corrupted');
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
   */
  async renderPage(options: PageRenderOptions): Promise<void> {
    const { canvas, scale, page } = options;
    const viewport = page.getViewport({ scale });

    // Set canvas dimensions
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get canvas 2D context');
    }

    const renderContext = {
      canvasContext: context,
      viewport,
    };

    await page.render(renderContext).promise;
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
