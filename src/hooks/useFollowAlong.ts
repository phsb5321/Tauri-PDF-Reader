import { useEffect, useRef, useCallback } from 'react';
import { useTtsStore } from '../stores/tts-store';
import { useDocumentStore } from '../stores/document-store';

interface UseFollowAlongOptions {
  containerRef: React.RefObject<HTMLElement>;
  enabled?: boolean;
  scrollBehavior?: ScrollBehavior;
  offsetTop?: number;
}

/**
 * Hook for auto-scrolling to follow TTS reading position
 * - Scrolls to keep current reading position visible
 * - Auto-navigates to next page when TTS crosses page boundary
 * - Pauses follow-along on manual scroll, resumes on user action
 */
export function useFollowAlong({
  containerRef,
  enabled = true,
  scrollBehavior = 'smooth',
  offsetTop = 100,
}: UseFollowAlongOptions) {
  const { followAlong, currentChunkIndex, playbackState, getCurrentChunk, setFollowAlong } =
    useTtsStore();
  const { currentPage, totalPages, setCurrentPage } = useDocumentStore();

  const isManualScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);

  const isPlaying = playbackState === 'playing';
  const shouldFollow = enabled && followAlong && isPlaying;

  // Handle scroll position for current chunk
  const scrollToChunk = useCallback(() => {
    if (!shouldFollow || !containerRef.current) return;

    const currentChunk = getCurrentChunk();
    if (!currentChunk) return;

    // Check if chunk is on current page
    if (currentChunk.pageNumber !== currentPage) {
      // Navigate to the page containing the current chunk
      if (currentChunk.pageNumber >= 1 && currentChunk.pageNumber <= totalPages) {
        setCurrentPage(currentChunk.pageNumber);
      }
      return;
    }

    // Find the element that corresponds to the current reading position
    const container = containerRef.current;
    const pageElement = container.querySelector(
      `[data-page-number="${currentChunk.pageNumber}"]`
    );

    if (!pageElement) return;

    // Calculate scroll position to center the reading position
    const pageRect = pageElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Estimate position within page based on chunk offset
    const pageHeight = pageRect.height;
    const pageText = currentChunk.text;
    const estimatedPosition = currentChunk.startOffset / (pageText.length || 1);
    const targetY = pageRect.top + pageHeight * estimatedPosition - containerRect.top;

    // Only scroll if the target is not visible
    const isVisible =
      targetY >= offsetTop && targetY <= containerRect.height - offsetTop;

    if (!isVisible && !isManualScrollingRef.current) {
      container.scrollTo({
        top: container.scrollTop + targetY - offsetTop,
        behavior: scrollBehavior,
      });
    }
  }, [
    shouldFollow,
    containerRef,
    getCurrentChunk,
    currentPage,
    totalPages,
    setCurrentPage,
    offsetTop,
    scrollBehavior,
  ]);

  // Scroll when chunk changes
  useEffect(() => {
    if (shouldFollow && currentChunkIndex >= 0) {
      scrollToChunk();
    }
  }, [shouldFollow, currentChunkIndex, scrollToChunk]);

  // Detect manual scrolling and pause follow-along
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const scrollDelta = Math.abs(currentScrollTop - lastScrollTopRef.current);

      // Only consider it manual scroll if the delta is significant
      // and we're not in the middle of an auto-scroll
      if (scrollDelta > 50 && shouldFollow) {
        isManualScrollingRef.current = true;

        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          window.clearTimeout(scrollTimeoutRef.current);
        }

        // Resume follow-along after user stops scrolling
        scrollTimeoutRef.current = window.setTimeout(() => {
          isManualScrollingRef.current = false;
        }, 2000);
      }

      lastScrollTopRef.current = currentScrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [enabled, containerRef, shouldFollow]);

  // Auto-page turn when TTS crosses page boundary
  useEffect(() => {
    if (!shouldFollow) return;

    const currentChunk = getCurrentChunk();
    if (!currentChunk) return;

    // Navigate to chunk's page if different from current
    if (currentChunk.pageNumber !== currentPage) {
      if (currentChunk.pageNumber >= 1 && currentChunk.pageNumber <= totalPages) {
        setCurrentPage(currentChunk.pageNumber);
      }
    }
  }, [shouldFollow, getCurrentChunk, currentPage, totalPages, setCurrentPage]);

  // Toggle follow-along
  const toggleFollowAlong = useCallback(() => {
    setFollowAlong(!followAlong);
    isManualScrollingRef.current = false;
  }, [followAlong, setFollowAlong]);

  // Resume follow-along (e.g., after manual scroll)
  const resumeFollowAlong = useCallback(() => {
    isManualScrollingRef.current = false;
    setFollowAlong(true);
    scrollToChunk();
  }, [setFollowAlong, scrollToChunk]);

  return {
    followAlong,
    isManualScrolling: isManualScrollingRef.current,
    toggleFollowAlong,
    resumeFollowAlong,
    scrollToChunk,
  };
}
