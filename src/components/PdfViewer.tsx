import { useEffect, useRef, useCallback, useState } from "react";
import { TextLayer as PdfJsTextLayer } from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";
import { useDocumentStore } from "../stores/document-store";
import { useRenderStore } from "../stores/render-store";
import { pdfService } from "../services/pdf-service";
import {
  calculateRenderPlan,
  calculateFitWidthZoom,
  calculateFitPageZoom,
} from "../domain/rendering";
import { ScannedPdfWarning, MemoryCapWarning } from "./common";
import { DebugOverlay } from "./settings/DebugOverlay";
import { EmptyState } from "../ui/components/EmptyState/EmptyState";
import { PdfSkeleton } from "./pdf-viewer/PdfSkeleton";
import { useHighlightCreation } from "./pdf-viewer/HighlightCreationHandler";
import { HighlightOverlay } from "./pdf-viewer/HighlightOverlay";
import { TtsWordHighlight } from "./pdf-viewer/TtsWordHighlight";
import type { TextSelection } from "./TextLayer";
import type { Rect } from "../lib/schemas";
import { selectionToPageEnd } from "../lib/selection-narration";
import { nextPdfWheelZoom } from "../lib/pdf-wheel-zoom";
import { annotatePdfTextLayer } from "../lib/pdf-text";
import { markPdfPageReady } from "../lib/pdf-page-ready";
import "./PdfViewer.css";

// Padding around the PDF page
const PAGE_PADDING = 40;

// Debounce delay for render operations (prevents render thrash during zoom/resize)
const RENDER_DEBOUNCE_MS = 150;

/**
 * Clear all child elements from a container safely
 */
function clearContainer(container: HTMLElement): void {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

interface PdfViewerProps {
  onReadFromHere?: (text: string, baseOffset: number) => void;
}

export function PdfViewer({ onReadFromHere }: Readonly<PdfViewerProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const textLayerInstanceRef = useRef<PdfJsTextLayer | null>(null);
  const renderTaskRef = useRef<ReturnType<PDFPageProxy["render"]> | null>(null);
  const renderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderGenerationRef = useRef(0);

  const [warningDismissed, setWarningDismissed] = useState(false);
  const [memoryWarningDismissed, setMemoryWarningDismissed] = useState(false);
  const {
    pdfDocument,
    currentDocument,
    currentPage,
    zoomLevel,
    fitMode,
    isLoading,
    error,
    hasTextLayer,
    textLayerChecked,
    setCurrentPage,
    setFitMode,
    setHasTextLayer,
    getHighlightsForPage,
    selectedHighlightId,
    setSelectedHighlight,
  } = useDocumentStore();

  // Render settings and display info from render store
  const {
    settings,
    displayInfo,
    currentRenderPlan,
    setDisplayInfo,
    setCurrentRenderPlan,
  } = useRenderStore();

  // Track viewport dimensions for highlight overlay
  const [viewportDimensions, setViewportDimensions] = useState({
    width: 0,
    height: 0,
  });

  // Get highlights for current page
  const highlights = getHighlightsForPage(currentPage);

  // Highlight creation orchestration
  const {
    handleTextSelect: handleHighlightTextSelect,
    ToolbarComponent: highlightToolbar,
  } = useHighlightCreation({
    documentId: currentDocument?.id ?? null,
    scale: zoomLevel,
    containerRef: pageContainerRef as React.RefObject<HTMLElement>,
    onSuccess: (highlight) => {
      console.debug(
        "[PdfViewer] Highlight created successfully:",
        highlight.id,
      );
    },
    onError: (error) => {
      console.error("[PdfViewer] Highlight creation error:", error);
    },
    onReadFromHere,
  });

  // Handle text selection from text layer
  const handleTextSelection = useCallback(() => {
    console.debug("[PdfViewer] handleTextSelection called");
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !pageContainerRef.current) {
      console.debug("[PdfViewer] No valid selection or no container");
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      console.debug("[PdfViewer] No selected text");
      return;
    }
    console.debug("[PdfViewer] Selected text:", selectedText.substring(0, 50));

    // Get selection rects relative to the page container
    const range = selection.getRangeAt(0);
    const clientRects = range.getClientRects();
    const containerRect = pageContainerRef.current.getBoundingClientRect();

    const rects: Rect[] = [];
    for (let i = 0; i < clientRects.length; i++) {
      const rect = clientRects[i];
      // Convert to page coordinates (unscaled)
      rects.push({
        x: (rect.left - containerRect.left) / zoomLevel,
        y: (rect.top - containerRect.top) / zoomLevel,
        width: rect.width / zoomLevel,
        height: rect.height / zoomLevel,
      });
    }

    if (rects.length > 0) {
      const narration = textLayerRef.current
        ? selectionToPageEnd(selection, textLayerRef.current)
        : null;
      const textSelection: TextSelection = {
        text: selectedText,
        rects,
        pageNumber: currentPage,
        narrationText: narration?.text,
        narrationOffset: narration?.baseOffset,
      };
      console.debug("[PdfViewer] Forwarding selection to highlight handler:", {
        textLength: selectedText.length,
        rectsCount: rects.length,
        pageNumber: currentPage,
      });
      handleHighlightTextSelect(textSelection);
    } else {
      console.debug("[PdfViewer] No rects found for selection");
    }
  }, [zoomLevel, currentPage, handleHighlightTextSelect]);

  // Use document-level mouseup to capture text selection
  useEffect(() => {
    console.debug("[PdfViewer] Setting up mouseup listener");

    const handleDocumentMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Use closest() for reliable page root detection (T015)
      // This works regardless of component tree structure
      const pageRoot = target.closest("[data-page-number]");

      console.debug("[PdfViewer] Document mouseup fired", {
        target: target?.className,
        pageRoot: pageRoot
          ? `page ${pageRoot.getAttribute("data-page-number")}`
          : "none",
      });

      if (!pageRoot) {
        console.debug("[PdfViewer] Click outside any page");
        return;
      }

      // Check selection immediately
      const selection = window.getSelection();
      console.debug("[PdfViewer] Selection state:", {
        hasSelection: !!selection,
        isCollapsed: selection?.isCollapsed,
        text: selection?.toString().substring(0, 30),
      });

      // Small delay to let the selection finalize
      setTimeout(handleTextSelection, 10);
    };

    document.addEventListener("mouseup", handleDocumentMouseUp);
    console.debug("[PdfViewer] Mouseup listener added");

    return () => {
      document.removeEventListener("mouseup", handleDocumentMouseUp);
      console.debug("[PdfViewer] Mouseup listener removed");
    };
  }, [handleTextSelection]);

  // Handle highlight click
  const handleHighlightClick = useCallback(
    (highlight: { id: string }) => {
      setSelectedHighlight(
        selectedHighlightId === highlight.id ? null : highlight.id,
      );
    },
    [selectedHighlightId, setSelectedHighlight],
  );

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const { zoomLevel: currentZoom, setZoomLevel } =
      useDocumentStore.getState();
    setZoomLevel(nextPdfWheelZoom(currentZoom, event.deltaY));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Render the current page with canvas + text layer
  const renderPage = useCallback(
    async (generation: number) => {
      if (
        !pdfDocument ||
        !canvasRef.current ||
        !textLayerRef.current ||
        generation !== renderGenerationRef.current
      ) {
        return;
      }
      const pageNumber = currentPage;

      // Cancel any previous render
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
      }

      // Cancel previous text layer
      if (textLayerInstanceRef.current) {
        textLayerInstanceRef.current.cancel();
        textLayerInstanceRef.current = null;
      }

      // Clear text layer safely
      clearContainer(textLayerRef.current);

      try {
        // Get the page
        const page = await pdfService.getPage(pdfDocument, pageNumber);
        if (generation !== renderGenerationRef.current) return;
        pageRef.current = page;

        const canvas = canvasRef.current;
        const textLayerDiv = textLayerRef.current;

        // Get base viewport (scale=1) for RenderPolicy calculation
        const baseViewport = page.getViewport({ scale: 1 });

        // Calculate render plan using RenderPolicy
        const renderPlan = calculateRenderPlan({
          pageWidth: baseViewport.width,
          pageHeight: baseViewport.height,
          zoomLevel,
          settings,
          displayInfo,
        });

        // Store current render plan for debug overlay
        setCurrentRenderPlan(renderPlan);

        // Get viewport at the desired zoom level
        const viewport = page.getViewport({ scale: zoomLevel });

        // Update viewport dimensions for highlight overlay
        setViewportDimensions({
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height),
        });

        // Set canvas physical dimensions (scaled for HiDPI based on render plan)
        canvas.width = renderPlan.canvasWidth;
        canvas.height = renderPlan.canvasHeight;

        // Set canvas CSS dimensions (logical size)
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        // Set text layer dimensions
        textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
        textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
        textLayerDiv.style.setProperty("--scale-factor", String(zoomLevel));

        // Get hardware-accelerated 2D context with optimal settings
        const context = canvas.getContext("2d", {
          alpha: false, // Opaque canvas - faster rendering
          desynchronized: true, // Direct to display - hardware accelerated
          willReadFrequently: false, // Keep GPU acceleration enabled
        });
        if (!context) {
          throw new Error("Could not get canvas 2D context");
        }

        // An opaque canvas starts black. Paint the PDF page background before
        // pdf.js draws so a cancelled/failed render never leaves a black void.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Enable high-quality image rendering
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        // Create transform matrix for HiDPI rendering using render plan's output scale
        const transform:
          | [number, number, number, number, number, number]
          | undefined =
          renderPlan.outputScale !== 1
            ? [renderPlan.outputScale, 0, 0, renderPlan.outputScale, 0, 0]
            : undefined;

        // Render canvas
        renderTaskRef.current = page.render({
          canvasContext: context,
          transform: transform,
          viewport: viewport,
        });

        await renderTaskRef.current.promise;
        if (generation !== renderGenerationRef.current) return;

        // Render text layer for selectable text
        const textContent = await page.getTextContent();
        if (generation !== renderGenerationRef.current) return;

        textLayerInstanceRef.current = new PdfJsTextLayer({
          container: textLayerDiv,
          textContentSource: textContent,
          viewport: viewport,
        });

        await textLayerInstanceRef.current.render();
        if (generation !== renderGenerationRef.current) return;
        annotatePdfTextLayer(textLayerDiv, textContent.items);

        const pageContainer = pageContainerRef.current;
        if (pageContainer) {
          pageContainer.dataset.renderReady = "true";
          pageContainer.setAttribute("aria-busy", "false");
        }
        markPdfPageReady(pageNumber);

        console.log(
          "[PdfViewer] Rendered page",
          pageNumber,
          "zoom:",
          zoomLevel,
          "outputScale:",
          renderPlan.outputScale,
          "megapixels:",
          renderPlan.megapixels.toFixed(2),
          renderPlan.wasCapped ? "(CAPPED)" : "",
        );
      } catch (err) {
        // Ignore cancellation errors
        if (err instanceof Error && err.message.includes("cancel")) {
          return;
        }
        console.error("Error rendering page:", err);
      }
    },
    [
      pdfDocument,
      currentPage,
      zoomLevel,
      settings,
      displayInfo,
      setCurrentRenderPlan,
    ],
  );

  // Debounced render to prevent thrash during continuous zoom/resize (T019)
  useEffect(() => {
    // Clear any pending debounced render and make readiness fail closed before
    // React reuses this page container for a new page or zoom.
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current);
    }
    const generation = ++renderGenerationRef.current;
    if (pageContainerRef.current) {
      pageContainerRef.current.dataset.renderReady = "false";
      pageContainerRef.current.setAttribute("aria-busy", "true");
    }

    // Debounce the render call
    renderDebounceRef.current = setTimeout(() => {
      void renderPage(generation);
    }, RENDER_DEBOUNCE_MS);

    return () => {
      if (renderGenerationRef.current === generation) {
        renderGenerationRef.current += 1;
      }
      // Cancel debounce timer
      if (renderDebounceRef.current) {
        clearTimeout(renderDebounceRef.current);
      }
      // Cancel in-flight render
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
      }
      if (textLayerInstanceRef.current) {
        textLayerInstanceRef.current.cancel();
      }
    };
  }, [renderPage]);

  // Update DisplayInfo on mount and when DPR/viewport changes (T017, T018)
  useEffect(() => {
    const updateDisplayInfo = () => {
      const container = containerRef.current;
      setDisplayInfo({
        devicePixelRatio: window.devicePixelRatio || 1,
        viewportWidth: container?.clientWidth ?? window.innerWidth,
        viewportHeight: container?.clientHeight ?? window.innerHeight,
      });
    };

    // Initial update
    updateDisplayInfo();

    // Listen for DPR changes (display switch detection)
    const mediaQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    const handleDprChange = () => {
      console.log("[PdfViewer] DPR changed to:", window.devicePixelRatio);
      updateDisplayInfo();
    };

    // Use addEventListener with options for modern browsers
    mediaQuery.addEventListener("change", handleDprChange);

    // Listen for resize events
    const handleResize = () => {
      updateDisplayInfo();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      mediaQuery.removeEventListener("change", handleDprChange);
      window.removeEventListener("resize", handleResize);
    };
  }, [setDisplayInfo]);

  // Recalculate zoom for fit modes on window resize (T027)
  useEffect(() => {
    if (!pdfDocument || fitMode === "none") return;

    let cancelled = false;

    const recalculateFitZoom = async () => {
      try {
        const container = containerRef.current;
        if (!container) return;

        // Get the first page to determine PDF dimensions
        const page = await pdfDocument.getPage(currentPage);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const containerWidth = container.clientWidth - PAGE_PADDING * 2;
        const containerHeight = container.clientHeight - PAGE_PADDING * 2;

        let newZoom: number;

        if (fitMode === "fit-width") {
          newZoom = calculateFitWidthZoom({
            pageWidth: baseViewport.width,
            pageHeight: baseViewport.height,
            containerWidth,
            containerHeight,
            padding: 0, // Already subtracted
          });
        } else if (fitMode === "fit-page") {
          newZoom = calculateFitPageZoom({
            pageWidth: baseViewport.width,
            pageHeight: baseViewport.height,
            containerWidth,
            containerHeight,
            padding: 0, // Already subtracted
          });
        } else {
          return;
        }

        // Clamp zoom to reasonable bounds
        newZoom = Math.max(0.25, Math.min(4.0, newZoom));

        // Only update if significantly different (avoid render loops)
        if (Math.abs(newZoom - zoomLevel) > 0.01) {
          // Directly set zoom without clearing fit mode
          useDocumentStore.setState({ zoomLevel: newZoom });
          console.log(`[PdfViewer] ${fitMode} zoom:`, newZoom.toFixed(2));
        }
      } catch (err) {
        console.error("Error calculating fit zoom:", err);
      }
    };

    recalculateFitZoom();

    return () => {
      cancelled = true;
    };
  }, [
    pdfDocument,
    currentPage,
    fitMode,
    displayInfo.viewportWidth,
    displayInfo.viewportHeight,
    zoomLevel,
  ]);

  // Start with the complete page visible. Fit-width can approach 300% on a
  // desktop monitor, hiding most of a portrait page below the fold before the
  // reader has chosen any zoom mode.
  const initialZoomSetRef = useRef(false);

  useEffect(() => {
    if (!pdfDocument || !containerRef.current) return;
    if (initialZoomSetRef.current) return;

    const calculateAndSetFitPage = async () => {
      try {
        const page = await pdfDocument.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });
        const containerWidth =
          containerRef.current!.clientWidth - PAGE_PADDING * 2;
        const containerHeight =
          containerRef.current!.clientHeight - PAGE_PADDING * 2;
        const initialZoom = Math.max(
          0.25,
          Math.min(
            4.0,
            calculateFitPageZoom({
              pageWidth: viewport.width,
              pageHeight: viewport.height,
              containerWidth,
              containerHeight,
              padding: 0,
            }),
          ),
        );

        setFitMode("fit-page");
        useDocumentStore.setState({ zoomLevel: initialZoom });
        initialZoomSetRef.current = true;
        console.log(
          "[PdfViewer] Set initial zoom to:",
          initialZoom,
          "(fit-page)",
        );
      } catch (err) {
        console.error("Error calculating fit-page:", err);
      }
    };

    calculateAndSetFitPage();
  }, [pdfDocument, setFitMode]);

  // Reset initial zoom flag when document changes
  useEffect(() => {
    initialZoomSetRef.current = false;
  }, [pdfDocument]);

  // Check for text layer when document loads
  useEffect(() => {
    if (!pdfDocument || textLayerChecked) return;

    const checkTextLayer = async () => {
      try {
        const hasText = await pdfService.hasTextLayer(pdfDocument);
        setHasTextLayer(hasText);
        setWarningDismissed(false);
      } catch (err) {
        console.error("Error checking text layer:", err);
        setHasTextLayer(false);
      }
    };

    checkTextLayer();
  }, [pdfDocument, textLayerChecked, setHasTextLayer]);

  // Jump to the first or last page.
  //
  // Page-by-page navigation used to live here too — PageUp/PageDown, the arrows
  // and Space — on this same listener. It moved to `useCommandKeys`, which
  // reaches the same commands the native menu does and therefore applies the
  // stop-playback-first guard this listener never had. Home/End stay because
  // there is no `MenuAction` id for them: the native menu has no first/last-page
  // item, and inventing an id `src-tauri` never emits would put a dead entry in
  // the registry. They overlap with nothing, so no key has two owners.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pdfDocument) return;

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "Home":
          e.preventDefault();
          setCurrentPage(1);
          break;
        case "End":
          e.preventDefault();
          setCurrentPage(pdfDocument.numPages);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pdfDocument, setCurrentPage]);

  // Empty state
  if (!pdfDocument && !isLoading && !error) {
    return (
      <div className="pdf-viewer-empty">
        <EmptyState
          title="Open a PDF to get started"
          description="Press Ctrl+O or use the Open button in the toolbar"
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          }
        />
      </div>
    );
  }

  // Loading state - show skeleton placeholder
  if (isLoading) {
    return <PdfSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="pdf-viewer-error">
        <svg viewBox="0 0 24 24" className="error-icon">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h2>Error Loading PDF</h2>
        <p>{error}</p>
      </div>
    );
  }

  const showScannedWarning =
    textLayerChecked && hasTextLayer === false && !warningDismissed;
  const showMemoryWarning =
    currentRenderPlan?.wasCapped &&
    !memoryWarningDismissed &&
    settings.maxMegapixels > 0;

  return (
    <div className="pdf-viewer" ref={containerRef}>
      {showScannedWarning && (
        <ScannedPdfWarning onDismiss={() => setWarningDismissed(true)} />
      )}
      <div
        className="pdf-page-container"
        ref={pageContainerRef}
        data-page-number={currentPage}
      >
        {/* Canvas layer - visual rendering */}
        <canvas ref={canvasRef} className="pdf-canvas" />
        {/* Text layer - selectable text overlay (native mouseup listener in useEffect) */}
        <div ref={textLayerRef} className="textLayer" />
        {/* TTS word highlight overlay - karaoke-style highlighting */}
        <TtsWordHighlight pageNumber={currentPage} scale={zoomLevel} />
        {/* Highlight overlay */}
        {highlights.length > 0 && viewportDimensions.width > 0 && (
          <HighlightOverlay
            highlights={highlights}
            scale={zoomLevel}
            viewportWidth={viewportDimensions.width}
            viewportHeight={viewportDimensions.height}
            selectedHighlightId={selectedHighlightId}
            onHighlightClick={handleHighlightClick}
          />
        )}
        {/* Highlight creation toolbar */}
        {highlightToolbar}
      </div>
      {/* Memory cap warning when render quality is reduced */}
      {showMemoryWarning && (
        <MemoryCapWarning
          cappedMegapixels={currentRenderPlan?.megapixels}
          maxMegapixels={settings.maxMegapixels}
          onDismiss={() => setMemoryWarningDismissed(true)}
        />
      )}
      {/* Debug overlay when enabled in settings */}
      {settings.debugOverlayEnabled && <DebugOverlay />}
    </div>
  );
}
