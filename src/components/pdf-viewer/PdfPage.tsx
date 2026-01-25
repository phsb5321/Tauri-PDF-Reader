import { useEffect, useRef, useState, useCallback, memo } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { pdfService } from '../../services/pdf-service';
import { TextLayer, type TextSelection } from '../TextLayer';
import { HighlightOverlay } from './HighlightOverlay';
import { TtsHighlight } from './TtsHighlight';
import { useHighlightCreation } from './HighlightCreationHandler';
import { useDocumentStore } from '../../stores/document-store';
import { useTtsStore } from '../../stores/tts-store';
import { useRenderStore } from '../../stores/render-store';
import { calculateRenderPlan } from '../../domain/rendering';
import type { Highlight } from '../../lib/schemas';
import type { TextChunk } from '../../lib/text-chunking';
import './PdfPage.css';

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface PdfPageProps {
  page: PDFPageProxy;
  scale: number;
  pageNumber: number;
  isCurrentPage?: boolean;
  onTextSelect?: (selection: TextSelection) => void;
  onRenderComplete?: () => void;
  currentTtsChunk?: TextChunk | null;
}

/**
 * PdfPage component renders a single PDF page with:
 * - Canvas for the PDF content (high-DPI rendering)
 * - Text layer for text selection (PDF.js native)
 * - Highlight overlay for user highlights
 * - TTS highlight for current reading position
 */
export const PdfPage = memo(function PdfPage({
  page,
  scale,
  pageNumber,
  isCurrentPage = false,
  onTextSelect,
  onRenderComplete,
  currentTtsChunk,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textItems, setTextItems] = useState<TextItem[]>([]);

  const { currentDocument, getHighlightsForPage, selectedHighlightId, setSelectedHighlight } = useDocumentStore();
  const { playbackState } = useTtsStore();
  const { settings, displayInfo, setCurrentRenderPlan } = useRenderStore();

  // Highlight creation orchestration
  const {
    handleTextSelect: handleHighlightTextSelect,
    ToolbarComponent: highlightToolbar,
  } = useHighlightCreation({
    documentId: currentDocument?.id ?? null,
    scale,
    containerRef: containerRef as React.RefObject<HTMLElement>,
    onSuccess: (highlight) => {
      console.debug('[PdfPage] Highlight created successfully:', highlight.id);
    },
    onError: (error) => {
      console.error('[PdfPage] Highlight creation error:', error);
    },
  });

  // Logical viewport (for CSS sizing)
  const viewport = page.getViewport({ scale });
  const highlights = getHighlightsForPage(pageNumber);
  const isPlaying = playbackState === 'playing';

  // Render the page to canvas with high-DPI support using RenderPolicy
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cancel any in-flight render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const render = async () => {
      setIsRendering(true);
      setError(null);

      try {
        // Get page dimensions at scale 1 for render plan calculation
        const baseViewport = page.getViewport({ scale: 1 });

        // Calculate render plan using RenderPolicy
        const renderPlan = calculateRenderPlan({
          pageWidth: baseViewport.width,
          pageHeight: baseViewport.height,
          zoomLevel: scale,
          settings,
          displayInfo,
        });

        // Store current render plan for debug overlay
        if (isCurrentPage) {
          setCurrentRenderPlan(renderPlan);
        }

        // Use pdf-service with calculated output scale
        const renderTask = pdfService.renderPage({
          canvas,
          scale,
          page,
          outputScale: renderPlan.outputScale,
        });

        // Store reference for cancellation
        renderTaskRef.current = renderTask;

        await renderTask.promise;

        // Load text items for TTS highlighting
        const textContent = await pdfService.getPageText(page);
        if (!cancelled) {
          setTextItems(textContent.items);
          onRenderComplete?.();
        }
      } catch (err) {
        if (!cancelled) {
          // Ignore cancelled render errors
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (!errorMessage.includes('Rendering cancelled')) {
            console.error('Error rendering page:', err);
            setError(errorMessage);
          }
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
          renderTaskRef.current = null;
        }
      }
    };

    render();

    return () => {
      cancelled = true;
      // Cancel render on unmount or dependency change
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [page, scale, settings.qualityMode, settings.maxMegapixels, displayInfo.devicePixelRatio, isCurrentPage, onRenderComplete, setCurrentRenderPlan]);

  // Handle highlight click
  const handleHighlightClick = useCallback(
    (highlight: Highlight) => {
      setSelectedHighlight(
        selectedHighlightId === highlight.id ? null : highlight.id
      );
    },
    [selectedHighlightId, setSelectedHighlight]
  );

  // Handle text selection - wire to highlight creation and parent callback
  const handleTextSelection = useCallback(
    (selection: TextSelection) => {
      // Trigger highlight toolbar
      handleHighlightTextSelect(selection);
      // Also forward to parent if provided
      onTextSelect?.(selection);
    },
    [handleHighlightTextSelect, onTextSelect]
  );

  if (error) {
    return (
      <div
        className="pdf-page pdf-page--error"
        style={{ width: viewport.width, height: viewport.height }}
      >
        <div className="pdf-page-error">
          <span className="error-icon">!</span>
          <p>Error rendering page {pageNumber}</p>
          <small>{error}</small>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`pdf-page ${isCurrentPage ? 'pdf-page--current' : ''}`}
      style={{ width: Math.round(viewport.width), height: Math.round(viewport.height) }}
      data-page-number={pageNumber}
    >
      {/* PDF canvas layer - rendered at high-DPI, CSS-scaled down */}
      <canvas
        ref={canvasRef}
        className="pdf-page-canvas"
      />

      {/* Text layer for selection - PDF.js native TextLayer */}
      <TextLayer
        page={page}
        scale={scale}
        onTextSelect={handleTextSelection}
      />

      {/* Highlight overlay */}
      {highlights.length > 0 && (
        <HighlightOverlay
          highlights={highlights}
          scale={scale}
          viewportWidth={viewport.width}
          viewportHeight={viewport.height}
          selectedHighlightId={selectedHighlightId}
          onHighlightClick={handleHighlightClick}
        />
      )}

      {/* TTS highlight when playing on this page */}
      {isCurrentPage && isPlaying && currentTtsChunk && textItems.length > 0 && (
        <TtsHighlight
          chunk={currentTtsChunk}
          scale={scale}
          viewportWidth={viewport.width}
          viewportHeight={viewport.height}
          textItems={textItems}
        />
      )}

      {/* Loading overlay */}
      {isRendering && (
        <div className="pdf-page-loading">
          <div className="loading-spinner" />
        </div>
      )}

      {/* Highlight creation toolbar */}
      {highlightToolbar}
    </div>
  );
});

export default PdfPage;
