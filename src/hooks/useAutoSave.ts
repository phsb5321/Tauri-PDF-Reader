import { useEffect, useRef, useCallback } from 'react';
import { libraryUpdateProgress } from '../lib/tauri-invoke';

interface UseAutoSaveOptions {
  documentId: string | null;
  currentPage: number;
  scrollPosition?: number;
  lastTtsChunkId?: string | null;
  enabled?: boolean;
  intervalMs?: number;
}

/**
 * Hook for auto-saving reading progress
 * Saves periodically and on significant actions (page change, TTS progress)
 */
export function useAutoSave({
  documentId,
  currentPage,
  scrollPosition = 0,
  lastTtsChunkId,
  enabled = true,
  intervalMs = 30000, // 30 seconds default
}: UseAutoSaveOptions) {
  const lastSavedRef = useRef({
    page: currentPage,
    scroll: scrollPosition,
    ttsChunk: lastTtsChunkId,
    timestamp: 0,
  });
  const saveTimeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);

  // Save progress to backend
  const saveProgress = useCallback(async () => {
    if (!documentId || !enabled || isSavingRef.current) {
      return;
    }

    // Check if anything has changed
    const hasChanges =
      currentPage !== lastSavedRef.current.page ||
      Math.abs(scrollPosition - lastSavedRef.current.scroll) > 0.05 ||
      lastTtsChunkId !== lastSavedRef.current.ttsChunk;

    if (!hasChanges) {
      return;
    }

    isSavingRef.current = true;

    try {
      await libraryUpdateProgress(
        documentId,
        currentPage,
        scrollPosition,
        lastTtsChunkId ?? undefined
      );

      lastSavedRef.current = {
        page: currentPage,
        scroll: scrollPosition,
        ttsChunk: lastTtsChunkId,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Failed to save progress:', error);
    } finally {
      isSavingRef.current = false;
    }
  }, [documentId, currentPage, scrollPosition, lastTtsChunkId, enabled]);

  // Debounced save for frequent updates
  const scheduleSave = useCallback(
    (delayMs = 1000) => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(saveProgress, delayMs);
    },
    [saveProgress]
  );

  // Save immediately on significant changes (page change)
  useEffect(() => {
    if (!enabled || !documentId) return;

    // Page changed - save with short delay
    if (currentPage !== lastSavedRef.current.page) {
      scheduleSave(500);
    }
  }, [currentPage, documentId, enabled, scheduleSave]);

  // Save on TTS chunk change
  useEffect(() => {
    if (!enabled || !documentId || !lastTtsChunkId) return;

    if (lastTtsChunkId !== lastSavedRef.current.ttsChunk) {
      scheduleSave(2000); // Longer delay for TTS updates
    }
  }, [lastTtsChunkId, documentId, enabled, scheduleSave]);

  // Periodic save interval
  useEffect(() => {
    if (!enabled || !documentId) return;

    const interval = setInterval(saveProgress, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, documentId, intervalMs, saveProgress]);

  // Save on unmount or document change
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      // Final save attempt
      saveProgress();
    };
  }, [documentId, saveProgress]);

  // Save before window unload
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      if (documentId) {
        // Use sync localStorage as fallback for beforeunload
        // The actual save happens via the effect cleanup
        try {
          localStorage.setItem(
            `pdf-reader-unsaved-${documentId}`,
            JSON.stringify({
              page: currentPage,
              scroll: scrollPosition,
              ttsChunk: lastTtsChunkId,
              timestamp: Date.now(),
            })
          );
        } catch {
          // Ignore localStorage errors
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, documentId, currentPage, scrollPosition, lastTtsChunkId]);

  return {
    saveNow: saveProgress,
    lastSaved: lastSavedRef.current.timestamp,
  };
}

/**
 * Check for unsaved progress from a previous session
 */
export function checkUnsavedProgress(documentId: string): {
  page: number;
  scroll: number;
  ttsChunk: string | null;
  timestamp: number;
} | null {
  try {
    const key = `pdf-reader-unsaved-${documentId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      localStorage.removeItem(key);
      return JSON.parse(saved);
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}
