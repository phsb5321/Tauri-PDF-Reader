import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist";

// Check if running in Tauri environment
function isTauriAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window &&
    window.__TAURI_INTERNALS__ !== undefined
  );
}

// Read the PDF bytes for the reader via the frontend fs plugin. The
// capability scope covers `$APPLOCALDATA/**` plus dialog-granted paths; the
// card/resume path depends on the grant persisting (persisted-scope), and
// `useOpenPdf` runs the reauthorization rung when a stored book's grant is
// gone (issue #120).
async function readFileFromTauri(filePath: string): Promise<Uint8Array> {
  // Slice 109 B1 test seam (VITE_E2E build only, tree-shaken out): the
  // packaged lane cannot drive the native file dialog, so the bridge also
  // serves the fixture bytes for the fs read. The PDF PARSE that follows is
  // the real pdf.js path; only the file-bytes transport is faked.
  const fixtureBytes = (globalThis as Record<string, unknown>)
    .__E2E_FS_FIXTURE_BYTES__;
  if (
    import.meta.env.VITE_E2E === "true" &&
    fixtureBytes instanceof Uint8Array
  ) {
    // A COPY per read, like the fs read this stands in for: pdf.js transfers
    // the buffer it is handed to its worker, which detaches it. Returning the
    // stored array by reference emptied it on the first parse, so the open
    // path's final hash-bound read saw 0 bytes and refused the book it had
    // just verified (PDF_HASH_MISMATCH). Pinned by pdf-service.e2e-seam.test.
    return new Uint8Array(fixtureBytes);
  }
  if (!isTauriAvailable()) {
    throw new Error(
      "Not running in Tauri environment. Please use the desktop app to open local files.",
    );
  }
  const { readFile } = await import("@tauri-apps/plugin-fs");
  return readFile(filePath);
}

/**
 * plugin-fs rejects reads outside the capability scope with one of:
 * - v2.4.x: "forbidden path: {path}, maybe it is not allowed on the scope for
 *   `allow-read-file` permission in your capability file"
 * - other versions/platforms: "path not allowed on the configured scope"
 * Shared by pdf-service (which must pass these through raw) and the
 * reauthorization rung in useOpenPdf (which fires on them).
 */
export function isScopeDenial(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /not allowed on the configured scope/i.test(message) ||
    /forbidden path: .*not allowed on the scope/i.test(message)
  );
}

/**
 * SHA-256 of the buffer, lowercase hex — the same fingerprint the backend
 * computes over the file (`compute_file_hash`), which is also a library row's
 * id. Fails closed when WebCrypto is unavailable rather than opening bytes it
 * cannot account for.
 */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "PDF_VERIFY_UNAVAILABLE: Cannot verify the file content in this environment — the book was not opened.",
    );
  }
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// CMaps are bundled into the app at build time (vite copies
// node_modules/pdfjs-dist/cmaps -> public/cmaps); never a CDN. The URL is
// built against the document base so it is absolute: pdf.js resolves a bare
// relative path against the worker script URL when useWorkerFetch is on
// (http-served Windows builds), and against the document in the tauri://
// main-thread path — an absolute URL is identical in both.
const CMAP_URL =
  typeof document === "undefined"
    ? "cmaps/"
    : new URL("cmaps/", document.baseURI).toString();

export type CoverLoadResult =
  | { doc: PDFDocumentProxy }
  | { tooBig: true }
  | null;

export interface PageRenderOptions {
  canvas: HTMLCanvasElement;
  scale: number;
  page: PDFPageProxy;
  /** Optional output scale override (for quality modes). If not provided, uses RenderPolicy. */
  outputScale?: number;
}

// Type guard for TextItem
function isTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item
  );
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

function rethrowPdfLoadError(error: unknown): never {
  console.error("[PDF Service] Error loading PDF:", error);
  if (!(error instanceof Error)) throw error;

  console.error("[PDF Service] Error message:", error.message);
  // Scope denials MUST pass through raw: the reauthorization rung depends on
  // the plugin's exact message, which a generic access mapping would swallow.
  if (isScopeDenial(error)) throw error;
  if (error.message.includes("password")) {
    throw new Error("PDF_PASSWORD_REQUIRED: This PDF is password protected");
  }
  if (error.message.includes("Invalid PDF")) {
    throw new Error("PDF_INVALID: The file is not a valid PDF or is corrupted");
  }
  if (
    error.message.includes("denied") ||
    error.message.includes("permission")
  ) {
    throw new Error(
      "PDF_ACCESS_DENIED: Cannot access the file. Check file permissions.",
    );
  }
  throw error;
}

/**
 * PDF service for loading and rendering PDF documents
 */
export const pdfService = {
  /**
   * Load a PDF document from a local file path.
   *
   * `options.expectedSha256` binds the BYTES THAT ARE OPENED to a verified
   * fingerprint: the read buffer is hashed (SHA-256, WebCrypto) and compared
   * before pdf.js ever sees it. The reauthorization rung passes the row id
   * (which IS the file's SHA-256, verified by `library_relocate_document`) —
   * so a file swapped between the backend's verification and this read is
   * refused instead of being rendered. Fails closed when WebCrypto is
   * unavailable.
   */
  /**
   * Load a PDF for cover generation — same fs read + pdf.js path as
   * `loadDocument`, but size-bounded (a source above `maxBytes` returns
   * `{ tooBig: true }` BEFORE the bytes are handed to pdf.js) and, when the
   * library row carries a hash, SHA-verified against it — a swapped file must
   * never be cached under the old content-hash id (the #122 row-verification
   * discipline applies to covers too). Returns null when the file cannot be
   * read or verified.
   */
  async loadDocumentForCover(
    filePath: string,
    maxBytes: number,
    expectedSha256?: string | null,
  ): Promise<CoverLoadResult> {
    try {
      const fileData = await readFileFromTauri(filePath);
      if (fileData.byteLength > maxBytes) {
        return { tooBig: true };
      }
      if (expectedSha256) {
        const sha256 = await sha256Hex(fileData);
        if (sha256 !== expectedSha256.toLowerCase()) {
          return null; // swapped/changed file — never cache under this id
        }
      }
      const loadingTask = getDocument({
        data: fileData,
        cMapUrl: CMAP_URL,
        cMapPacked: true,
      });
      try {
        return { doc: await loadingTask.promise };
      } catch (error) {
        // A failed loading task keeps its worker resources alive — destroy it
        // before reporting the miss (Codex gate 121).
        void loadingTask.destroy().catch(() => {});
        throw error;
      }
    } catch (error) {
      // NOTE (Codex MINOR): the size preflight (backend stat) and this
      // post-read byteLength belt bound the PARSE amplification; a file
      // replaced between the stat and this read costs exactly one transient
      // read — the belt still stops it being handed to pdf.js.
      console.warn("[PDF Service] Cover load failed:", error);
      return null;
    }
  },

  async loadDocument(
    filePath: string,
    options?: { expectedSha256?: string },
  ): Promise<PDFDocumentProxy> {
    return (await this.loadDocumentBound(filePath, options)).pdf;
  },

  /**
   * Load a PDF and report the fingerprint of the BYTES THAT WERE OPENED.
   *
   * A fresh import has no row to check against yet, so it cannot pass
   * `expectedSha256` — the row is created from the file only afterwards, and
   * a swap in between would bind one book's row to another book's bytes. The
   * returned `sha256` is what closes that: the caller compares it to the id
   * the library hands back and refuses the mismatch.
   */
  async loadDocumentBound(
    filePath: string,
    options?: { expectedSha256?: string },
  ): Promise<{ pdf: PDFDocumentProxy; sha256: string }> {
    console.log("[PDF Service] Loading document:", filePath);

    try {
      const fileData = await readFileFromTauri(filePath);
      const sha256 = await sha256Hex(fileData);
      if (
        options?.expectedSha256 &&
        sha256 !== options.expectedSha256.toLowerCase()
      ) {
        throw new Error(
          "PDF_HASH_MISMATCH: File content changed after verification — the book was not opened.",
        );
      }
      console.log(
        "[PDF Service] File read successfully, size:",
        fileData.byteLength,
        "bytes",
      );

      console.log("[PDF Service] Creating PDF document...");
      const loadingTask = getDocument({
        data: fileData,
        // Enable built-in CMap support for better character rendering
        // Bundled locally at build time — see CMAP_URL above.
        cMapUrl: CMAP_URL,
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;
      console.log(
        "[PDF Service] PDF loaded successfully, pages:",
        pdf.numPages,
      );
      return { pdf, sha256 };
    } catch (error) {
      rethrowPdfLoadError(error);
    }
  },

  /**
   * Load a PDF from a URL (for testing/development)
   */
  async loadDocumentFromUrl(url: string): Promise<PDFDocumentProxy> {
    const loadingTask = getDocument({
      url,
      // Bundled locally at build time — see CMAP_URL above.
      cMapUrl: CMAP_URL,
      cMapPacked: true,
    });

    return loadingTask.promise;
  },

  /**
   * Get a specific page from a PDF document
   */
  async getPage(
    pdf: PDFDocumentProxy,
    pageNumber: number,
  ): Promise<PDFPageProxy> {
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error(
        `Invalid page number: ${pageNumber}. Document has ${pdf.numPages} pages.`,
      );
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
  renderPage(options: PageRenderOptions): {
    promise: Promise<void>;
    cancel: () => void;
  } {
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
    const context = canvas.getContext("2d", {
      alpha: false, // Opaque canvas - faster rendering (PDF.js uses opaque background)
      desynchronized: true, // Direct GPU→display path (critical for Tauri WebView performance)
      willReadFrequently: false, // Keep GPU acceleration enabled
    });
    if (!context) {
      throw new Error("Could not get canvas 2D context");
    }

    // Enable high-quality image rendering
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    // Create transform matrix for HiDPI rendering
    const transform:
      | [number, number, number, number, number, number]
      | undefined =
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

    const text = items.map((item) => item.str).join(" ");

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
  calculateFitPageScale(
    page: PDFPageProxy,
    containerWidth: number,
    containerHeight: number,
  ): number {
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
      console.error("Error getting PDF outline:", error);
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
  pdf: PDFDocumentProxy,
): Promise<OutlineItem[]> {
  const result: OutlineItem[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;

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
        if (typeof dest === "string") {
          const resolvedDest = await pdf.getDestination(dest);
          dest = resolvedDest;
        }

        if (Array.isArray(dest) && dest.length > 0) {
          const ref = dest[0];
          if (ref && typeof ref === "object" && "num" in ref) {
            const pageIndex = await pdf.getPageIndex(ref);
            pageNumber = pageIndex + 1; // Convert 0-indexed to 1-indexed
          }
        }
      } catch (e) {
        console.warn("Could not resolve outline destination:", e);
      }
    }

    const children = outlineItem.items
      ? await processOutlineItems(outlineItem.items, pdf)
      : [];

    result.push({
      title: outlineItem.title || "Untitled",
      pageNumber,
      children,
    });
  }

  return result;
}
