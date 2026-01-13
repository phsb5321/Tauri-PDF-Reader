import { useCallback, useEffect, useRef, useState } from 'react';
import { HIGHLIGHT_COLORS } from '../../lib/constants';
import type { Rect } from '../../lib/schemas';
import './HighlightToolbar.css';

interface HighlightToolbarProps {
  position: { x: number; y: number } | null;
  onHighlight: (color: string) => void;
  onCancel: () => void;
  selectedRects: Rect[];
  containerRef: React.RefObject<HTMLElement>;
}

/**
 * Floating toolbar that appears when text is selected
 * Allows user to choose highlight color
 */
export function HighlightToolbar({
  position,
  onHighlight,
  onCancel,
  selectedRects,
  containerRef,
}: HighlightToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ x: number; y: number } | null>(null);

  // Calculate position to keep toolbar within viewport
  useEffect(() => {
    if (!position || !toolbarRef.current || !containerRef.current) {
      setAdjustedPosition(null);
      return;
    }

    const toolbar = toolbarRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();

    let x = position.x;
    let y = position.y;

    // Calculate the center of the first selection rect for positioning
    if (selectedRects.length > 0) {
      const firstRect = selectedRects[0];
      x = firstRect.x + firstRect.width / 2;
      y = firstRect.y - 10; // Position above selection
    }

    // Convert to screen coordinates for viewport boundary check
    const screenY = containerRect.top + y;

    // Adjust to keep within container bounds
    const adjustedX = Math.max(
      0,
      Math.min(x - toolbarRect.width / 2, containerRect.width - toolbarRect.width)
    );

    // Position above selection, or below if not enough space
    let adjustedY = y - toolbarRect.height - 8;
    if (screenY - toolbarRect.height - 8 < 0) {
      // Position below selection instead
      const lastRect = selectedRects[selectedRects.length - 1];
      adjustedY = lastRect ? lastRect.y + lastRect.height + 8 : y + 20;
    }

    setAdjustedPosition({ x: adjustedX, y: adjustedY });
  }, [position, selectedRects, containerRef]);

  // Handle click outside to cancel
  useEffect(() => {
    if (!position) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    // Delay to avoid immediate trigger
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [position, onCancel]);

  // Handle escape key
  useEffect(() => {
    if (!position) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [position, onCancel]);

  const handleColorClick = useCallback(
    (color: string) => {
      onHighlight(color);
    },
    [onHighlight]
  );

  if (!position || !adjustedPosition) {
    return null;
  }

  return (
    <div
      ref={toolbarRef}
      className="highlight-toolbar"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      role="toolbar"
      aria-label="Highlight colors"
    >
      <div className="highlight-toolbar-colors">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.id}
            className="highlight-color-button"
            style={{ backgroundColor: color.hex }}
            onClick={() => handleColorClick(color.hex)}
            title={`Highlight with ${color.name}`}
            aria-label={`Highlight with ${color.name}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Calculate toolbar position based on selection rects
 */
export function calculateToolbarPosition(
  rects: Rect[],
  scale: number
): { x: number; y: number } | null {
  if (rects.length === 0) return null;

  // Find the topmost rect
  const sortedByY = [...rects].sort((a, b) => a.y - b.y);
  const topRect = sortedByY[0];

  // Position at center top of selection
  const allX = rects.flatMap((r) => [r.x, r.x + r.width]);
  const centerX = (Math.min(...allX) + Math.max(...allX)) / 2;

  return {
    x: centerX * scale,
    y: topRect.y * scale,
  };
}
