import { useEffect, useRef, useCallback, useState } from 'react';
import { useDocumentStore } from '../stores/document-store';
import { pdfService } from '../services/pdf-service';
import { usePageCache } from '../hooks/usePageCache';
import { ScannedPdfWarning } from './common';
import './PdfViewer.css';

// Enable page pre-rendering for large PDFs (1000+ pages get more aggressive caching)
const LARGE_PDF_THRESHOLD = 1000;

export function PdfViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const {
    pdfDocument,
    currentPage,
    totalPages,
    zoomLevel,
    isLoading,
    error,
    hasTextLayer,
    textLayerChecked,
    setCurrentPage,
    setHasTextLayer,
  } = useDocumentStore();

  // Determine cache settings based on PDF size
  const isLargePdf = totalPages >= LARGE_PDF_THRESHOLD;
  const cacheOptions = {
    maxCacheSize: isLargePdf ? 15 : 10,
    preRenderAdjacent: isLargePdf ? 3 : 2,
  };

  // Use page cache for smoother navigation
  const { getCachedCanvas, preRenderPage } = usePageCache(
    pdfDocument,
    currentPage,
    zoomLevel,
    cacheOptions
  );

  // Render the current page
  const renderPage = useCallback(async () => {
    if (!pdfDocument || !canvasRef.current) return;

    try {
      // Check if we have a cached render
      const cachedCanvas = getCachedCanvas(currentPage);
      if (cachedCanvas) {
        // Copy cached canvas to display canvas
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = cachedCanvas.width;
          canvasRef.current.height = cachedCanvas.height;
          ctx.drawImage(cachedCanvas, 0, 0);
          return;
        }
      }

      // No cache hit - render directly
      const page = await pdfService.getPage(pdfDocument, currentPage);

      await pdfService.renderPage({
        canvas: canvasRef.current,
        scale: zoomLevel,
        page,
      });

      // Pre-render this page for future use
      preRenderPage(currentPage);
    } catch (err) {
      console.error('Error rendering page:', err);
    }
  }, [pdfDocument, currentPage, zoomLevel, getCachedCanvas, preRenderPage]);

  // Render page when document, page, or zoom changes
  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Check for text layer when document loads
  useEffect(() => {
    if (!pdfDocument || textLayerChecked) return;

    const checkTextLayer = async () => {
      try {
        const hasText = await pdfService.hasTextLayer(pdfDocument);
        setHasTextLayer(hasText);
        // Reset warning dismissal for new document
        setWarningDismissed(false);
      } catch (err) {
        console.error('Error checking text layer:', err);
        setHasTextLayer(false);
      }
    };

    checkTextLayer();
  }, [pdfDocument, textLayerChecked, setHasTextLayer]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pdfDocument) return;

      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          setCurrentPage(Math.max(1, currentPage - 1));
          break;
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          setCurrentPage(Math.min(pdfDocument.numPages, currentPage + 1));
          break;
        case 'Home':
          e.preventDefault();
          setCurrentPage(1);
          break;
        case 'End':
          e.preventDefault();
          setCurrentPage(pdfDocument.numPages);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pdfDocument, currentPage, setCurrentPage]);

  // Empty state
  if (!pdfDocument && !isLoading && !error) {
    return (
      <div className="pdf-viewer-empty">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" className="empty-icon">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <h2>No PDF Open</h2>
          <p>Click &quot;Open&quot; to select a PDF file</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="pdf-viewer-loading">
        <div className="loading-spinner" />
        <p>Loading PDF...</p>
      </div>
    );
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

  const showScannedWarning = textLayerChecked && hasTextLayer === false && !warningDismissed;

  return (
    <div className="pdf-viewer" ref={containerRef}>
      {showScannedWarning && (
        <ScannedPdfWarning onDismiss={() => setWarningDismissed(true)} />
      )}
      <div className="pdf-page-container">
        <canvas ref={canvasRef} className="pdf-canvas" />
      </div>
    </div>
  );
}
