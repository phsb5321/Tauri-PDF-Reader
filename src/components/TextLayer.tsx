import { useEffect, useRef, useState, useCallback } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { useDocumentStore } from '../stores/document-store';
import type { Rect } from '../lib/schemas';
import './TextLayer.css';

interface PdfTextContent {
  items: unknown[];
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

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

// Type guard for TextItem
function isTextItem(item: unknown): item is TextItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    'transform' in item
  );
}

export function TextLayer({ page, scale, onTextSelect }: TextLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [textContent, setTextContent] = useState<PdfTextContent | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const { getHighlightsForPage, selectedHighlightId, setSelectedHighlight } =
    useDocumentStore();

  const pageNumber = page.pageNumber;
  const highlights = getHighlightsForPage(pageNumber);
  const viewport = page.getViewport({ scale });

  // Load text content
  useEffect(() => {
    let cancelled = false;

    page.getTextContent().then((content) => {
      if (!cancelled) {
        setTextContent(content);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [page]);

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    if (!isSelecting) return;
    setIsSelecting(false);

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Get selection rects relative to the container
    const range = selection.getRangeAt(0);
    const clientRects = range.getClientRects();
    const containerRect = containerRef.current.getBoundingClientRect();

    const rects: Rect[] = [];
    for (let i = 0; i < clientRects.length; i++) {
      const rect = clientRects[i];
      // Convert to page coordinates (unscaled)
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

  // Handle highlight click
  const handleHighlightClick = useCallback(
    (highlightId: string) => {
      setSelectedHighlight(
        selectedHighlightId === highlightId ? null : highlightId
      );
    },
    [selectedHighlightId, setSelectedHighlight]
  );

  // Render text spans
  const renderTextSpans = () => {
    if (!textContent) return null;

    return textContent.items.map((item, index) => {
      if (!isTextItem(item)) return null;

      // Transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const [scaleX, , , scaleY, tx, ty] = item.transform;
      const fontSize = Math.sqrt(scaleX * scaleX + scaleY * scaleY);
      const fontHeight = fontSize * scale;

      // Position in page coordinates, then scale
      const left = tx * scale;
      // PDF coordinates have origin at bottom-left, flip Y
      const top = viewport.height - ty * scale - fontHeight;

      return (
        <span
          key={index}
          className="text-layer-span"
          style={{
            left: `${left}px`,
            top: `${top}px`,
            fontSize: `${fontHeight}px`,
            transform: `scaleX(${item.width > 0 ? (item.width * scale) / (item.str.length * fontHeight * 0.5) : 1})`,
          }}
        >
          {item.str}
        </span>
      );
    });
  };

  // Render highlight overlays
  const renderHighlights = () => {
    return highlights.map((highlight) => (
      <div
        key={highlight.id}
        className={`highlight-group ${selectedHighlightId === highlight.id ? 'selected' : ''}`}
        onClick={() => handleHighlightClick(highlight.id)}
      >
        {highlight.rects.map((rect, index) => (
          <div
            key={index}
            className="highlight-rect"
            style={{
              left: `${rect.x * scale}px`,
              top: `${rect.y * scale}px`,
              width: `${rect.width * scale}px`,
              height: `${rect.height * scale}px`,
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
      className="text-layer"
      style={{
        width: `${viewport.width}px`,
        height: `${viewport.height}px`,
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {renderHighlights()}
      {renderTextSpans()}
    </div>
  );
}

// Hook for managing text selection and highlighting
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
