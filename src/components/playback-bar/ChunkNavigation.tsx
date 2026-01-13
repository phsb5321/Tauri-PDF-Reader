import { useCallback } from 'react';
import { useTtsStore } from '../../stores/tts-store';
import './ChunkNavigation.css';

interface ChunkNavigationProps {
  onPreviousChunk?: () => void;
  onNextChunk?: () => void;
  disabled?: boolean;
}

export function ChunkNavigation({
  onPreviousChunk,
  onNextChunk,
  disabled = false,
}: ChunkNavigationProps) {
  const { chunks, currentChunkIndex, previousChunk, nextChunk } = useTtsStore();

  const hasPrevious = currentChunkIndex > 0;
  const hasNext = currentChunkIndex < chunks.length - 1;

  const handlePrevious = useCallback(() => {
    if (hasPrevious) {
      previousChunk();
      onPreviousChunk?.();
    }
  }, [hasPrevious, previousChunk, onPreviousChunk]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      nextChunk();
      onNextChunk?.();
    }
  }, [hasNext, nextChunk, onNextChunk]);

  if (chunks.length === 0) {
    return null;
  }

  return (
    <div className="chunk-navigation">
      <button
        className="chunk-nav-button"
        onClick={handlePrevious}
        disabled={disabled || !hasPrevious}
        title="Previous chunk"
        aria-label="Go to previous text chunk"
      >
        <svg viewBox="0 0 24 24" className="chunk-nav-icon">
          <path d="M19 20L9 12l10-8v16z" />
          <rect x="5" y="4" width="2" height="16" />
        </svg>
      </button>

      <span className="chunk-counter">
        {currentChunkIndex >= 0 ? currentChunkIndex + 1 : '-'} / {chunks.length}
      </span>

      <button
        className="chunk-nav-button"
        onClick={handleNext}
        disabled={disabled || !hasNext}
        title="Next chunk"
        aria-label="Go to next text chunk"
      >
        <svg viewBox="0 0 24 24" className="chunk-nav-icon">
          <path d="M5 4l10 8-10 8V4z" />
          <rect x="17" y="4" width="2" height="16" />
        </svg>
      </button>
    </div>
  );
}
