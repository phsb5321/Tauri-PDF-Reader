import { useCallback } from 'react';
import type { Highlight } from '../../lib/schemas';
import './HighlightOverlay.css';

interface HighlightOverlayProps {
  highlights: Highlight[];
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
  selectedHighlightId: string | null;
  onHighlightClick?: (highlight: Highlight) => void;
  onHighlightDoubleClick?: (highlight: Highlight) => void;
}

/**
 * Renders highlight rectangles as an overlay on top of the PDF page
 */
export function HighlightOverlay({
  highlights,
  scale,
  viewportWidth,
  viewportHeight,
  selectedHighlightId,
  onHighlightClick,
  onHighlightDoubleClick,
}: HighlightOverlayProps) {
  const handleClick = useCallback(
    (highlight: Highlight, e: React.MouseEvent) => {
      e.stopPropagation();
      onHighlightClick?.(highlight);
    },
    [onHighlightClick]
  );

  const handleDoubleClick = useCallback(
    (highlight: Highlight, e: React.MouseEvent) => {
      e.stopPropagation();
      onHighlightDoubleClick?.(highlight);
    },
    [onHighlightDoubleClick]
  );

  if (highlights.length === 0) {
    return null;
  }

  return (
    <div
      className="highlight-overlay"
      style={{
        width: viewportWidth,
        height: viewportHeight,
      }}
    >
      {highlights.map((highlight) => (
        <div
          key={highlight.id}
          className={`highlight-group ${selectedHighlightId === highlight.id ? 'selected' : ''}`}
          data-highlight-id={highlight.id}
        >
          {highlight.rects.map((rect, index) => (
            <div
              key={`${highlight.id}-${index}`}
              className="highlight-rect"
              style={{
                left: `${rect.x * scale}px`,
                top: `${rect.y * scale}px`,
                width: `${rect.width * scale}px`,
                height: `${rect.height * scale}px`,
                backgroundColor: hexToRgba(highlight.color, 0.35),
              }}
              onClick={(e) => handleClick(highlight, e)}
              onDoubleClick={(e) => handleDoubleClick(highlight, e)}
              title={highlight.textContent || undefined}
              role="button"
              tabIndex={0}
              aria-label={`Highlight: ${highlight.textContent?.slice(0, 50) || 'No text'}`}
            />
          ))}
          {/* Show note indicator if highlight has a note */}
          {highlight.note && (
            <NoteIndicator
              highlight={highlight}
              scale={scale}
              onClick={(e) => handleClick(highlight, e)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface NoteIndicatorProps {
  highlight: Highlight;
  scale: number;
  onClick: (e: React.MouseEvent) => void;
}

/**
 * Small indicator showing that a highlight has a note
 */
function NoteIndicator({ highlight, scale, onClick }: NoteIndicatorProps) {
  // Position at the end of the last rect
  const lastRect = highlight.rects[highlight.rects.length - 1];
  if (!lastRect) return null;

  return (
    <button
      className="highlight-note-indicator"
      style={{
        left: `${(lastRect.x + lastRect.width) * scale}px`,
        top: `${lastRect.y * scale}px`,
      }}
      onClick={onClick}
      title="This highlight has a note"
      aria-label="View note"
    >
      <svg viewBox="0 0 16 16" className="note-icon">
        <path d="M14 1H2a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V2a1 1 0 00-1-1zM4 4h8v1H4V4zm0 3h8v1H4V7zm0 3h5v1H4v-1z" />
      </svg>
    </button>
  );
}

/**
 * Convert hex color to rgba string
 */
function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;

  if (cleanHex.length !== 6) {
    return `rgba(255, 255, 0, ${alpha})`;
  }

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(255, 255, 0, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
