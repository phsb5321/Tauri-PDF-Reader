import { useEffect, useRef, useState, useCallback } from 'react';
import { TextLayer as PdfJsTextLayer } from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist';
import { useDocumentStore } from '../stores/document-store';
import type { Rect } from '../lib/schemas';
import { TtsWordHighlight } from './pdf-viewer/TtsWordHighlight';
import './TextLayer.css';

interface TextLayerProps {
  page: PDFPageProxy;
  scale: number;
  onTextSelect?: (selection: TextSelection) => void;
}

export interface TextSelection {
  text: string;
  rects: Rect[];
  pageNumber: number;
}

function clearContainer(container: HTMLElement): void {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

export function TextLayer({ page, scale, onTextSelect }: TextLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textLayerDivRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<PdfJsTextLayer | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [textLayerReady, setTextLayerReady] = useState(false);

  const { getHighlightsForPage, selectedHighlightId, setSelectedHighlight } =
    useDocumentStore();

  const pageNumber = page.pageNumber;
  const highlights = getHighlightsForPage(pageNumber);
  const viewport = page.getViewport({ scale });

  useEffect(() => {
    const textLayerDiv = textLayerDivRef.current;
    if (!textLayerDiv) return;

    let cancelled = false;
    setTextLayerReady(false);

    if (textLayerRef.current) {
      textLayerRef.current.cancel();
      textLayerRef.current = null;
    }

    clearContainer(textLayerDiv);

    const renderTextLayer = async () => {
      try {
        const textContent = await page.getTextContent();
        if (cancelled) return;

        textLayerDiv.style.setProperty('--scale-factor', String(scale));

        textLayerRef.current = new PdfJsTextLayer({
          container: textLayerDiv,
          textContentSource: textContent,
          viewport: viewport,
        });

        await textLayerRef.current.render();
        
        if (!cancelled) {
          setTimeout(() => {
            if (!cancelled) {
              setTextLayerReady(true);
            }
          }, 50);
        }
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.message.includes('cancel'))) {
          console.error('[TextLayer] Error rendering text layer:', error);
        }
      }
    };

    renderTextLayer();

    return () => {
      cancelled = true;
      setTextLayerReady(false);
      if (textLayerRef.current) {
        textLayerRef.current.cancel();
        textLayerRef.current = null;
      }
    };
  }, [page, scale, viewport]);

  const handleMouseUp = useCallback(() => {
    if (!isSelecting) return;
    setIsSelecting(false);

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    const clientRects = range.getClientRects();
    const containerRect = containerRef.current.getBoundingClientRect();

    const rects: Rect[] = [];
    for (let i = 0; i < clientRects.length; i++) {
      const rect = clientRects[i];
      rects.push({
        x: (rect.left - containerRect.left) / scale,
        y: (rect.top - containerRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      });
    }

    if (rects.length > 0 && onTextSelect) {
      onTextSelect({
        text: selectedText,
        rects,
        pageNumber,
      });
    }
  }, [isSelecting, scale, pageNumber, onTextSelect]);

  const handleMouseDown = useCallback(() => {
    setIsSelecting(true);
    setSelectedHighlight(null);
  }, [setSelectedHighlight]);

  const handleHighlightClick = useCallback(
    (highlightId: string) => {
      setSelectedHighlight(
        selectedHighlightId === highlightId ? null : highlightId
      );
    },
    [selectedHighlightId, setSelectedHighlight]
  );

  const renderHighlights = () => {
    return highlights.map((highlight) => (
      <div
        key={highlight.id}
        className={'highlight-group ' + (selectedHighlightId === highlight.id ? 'selected' : '')}
        onClick={() => handleHighlightClick(highlight.id)}
      >
        {highlight.rects.map((rect, index) => (
          <div
            key={index}
            className="highlight-rect"
            style={{
              left: rect.x * scale + 'px',
              top: rect.y * scale + 'px',
              width: rect.width * scale + 'px',
              height: rect.height * scale + 'px',
              backgroundColor: highlight.color,
            }}
          />
        ))}
      </div>
    ));
  };

  return (
    <div
      ref={containerRef}
      className="text-layer-container"
      style={{
        width: viewport.width + 'px',
        height: viewport.height + 'px',
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div
        ref={textLayerDivRef}
        className="textLayer"
        style={{
          width: viewport.width + 'px',
          height: viewport.height + 'px',
        }}
      />
      <div className="highlight-layer">
        {renderHighlights()}
      </div>
      {/* TTS word highlight - renders when text layer is ready and TTS is active */}
      {textLayerReady && (
        <TtsWordHighlight
          pageNumber={pageNumber}
          scale={scale}
        />
      )}
    </div>
  );
}

export function useTextSelection() {
  const [pendingSelection, setPendingSelection] = useState<TextSelection | null>(
    null
  );

  const handleTextSelect = useCallback((selection: TextSelection) => {
    setPendingSelection(selection);
  }, []);

  const clearSelection = useCallback(() => {
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return {
    pendingSelection,
    handleTextSelect,
    clearSelection,
  };
}
