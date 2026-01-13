import { useEffect, useRef, useState, useCallback, memo } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { pdfService } from '../../services/pdf-service';
import { TextLayer, type TextSelection } from '../TextLayer';
import { HighlightOverlay } from './HighlightOverlay';
import { TtsHighlight } from './TtsHighlight';
import { useDocumentStore } from '../../stores/document-store';
import { useTtsStore } from '../../stores/tts-store';
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
 * - Canvas for the PDF content
 * - Text layer for text selection
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
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textItems, setTextItems] = useState<TextItem[]>([]);

  const { getHighlightsForPage, selectedHighlightId, setSelectedHighlight } = useDocumentStore();
  const { playbackState } = useTtsStore();

  const viewport = page.getViewport({ scale });
  const highlights = getHighlightsForPage(pageNumber);
  const isPlaying = playbackState === 'playing';

  // Render the page to canvas
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = async () => {
      setIsRendering(true);
      setError(null);

      try {
        await pdfService.renderPage({
          canvas,
          scale,
          page,
        });

        // Load text items for TTS highlighting
        const textContent = await pdfService.getPageText(page);
        if (!cancelled) {
          setTextItems(textContent.items);
          onRenderComplete?.();
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error rendering page:', err);
          setError(err instanceof Error ? err.message : 'Failed to render page');
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [page, scale, onRenderComplete]);

  // Handle highlight click
  const handleHighlightClick = useCallback(
    (highlight: Highlight) => {
      setSelectedHighlight(
        selectedHighlightId === highlight.id ? null : highlight.id
      );
    },
    [selectedHighlightId, setSelectedHighlight]
  );

  // Handle text selection
  const handleTextSelection = useCallback(
    (selection: TextSelection) => {
      onTextSelect?.(selection);
    },
    [onTextSelect]
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
      style={{ width: viewport.width, height: viewport.height }}
      data-page-number={pageNumber}
    >
      {/* PDF canvas layer */}
      <canvas
        ref={canvasRef}
        className="pdf-page-canvas"
        width={viewport.width}
        height={viewport.height}
      />

      {/* Text layer for selection */}
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
    </div>
  );
});

export default PdfPage;
