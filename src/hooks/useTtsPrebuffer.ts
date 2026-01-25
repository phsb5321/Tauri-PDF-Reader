/**
 * TTS Pre-buffering Hook
 *
 * Pre-fetches TTS audio when PDF pages load to ensure instant playback.
 * Uses a background queue to avoid blocking the UI.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { aiTtsPrebuffer } from '../lib/tauri-invoke';
import { pdfService } from '../services/pdf-service';
import { useAiTtsStore } from '../stores/ai-tts-store';

export interface UseTtsPrebufferOptions {
  /** Whether pre-buffering is enabled (default: true) */
  enabled?: boolean;
  /** Number of pages ahead to pre-buffer (default: 1) */
  lookahead?: number;
  /** Debounce delay in ms before starting pre-buffer (default: 500) */
  debounceMs?: number;
}

interface PrebufferState {
  /** Pages currently being buffered */
  buffering: Set<number>;
  /** Pages that have been successfully buffered */
  buffered: Set<number>;
  /** Pages that failed to buffer */
  failed: Set<number>;
}

export function useTtsPrebuffer(
  pdfDocument: PDFDocumentProxy | null,
  currentPage: number,
  options: UseTtsPrebufferOptions = {}
) {
  const { enabled = true, lookahead = 1, debounceMs = 500 } = options;
  
  const initialized = useAiTtsStore((s) => s.initialized);
  const selectedVoiceId = useAiTtsStore((s) => s.selectedVoiceId);
  
  const stateRef = useRef<PrebufferState>({
    buffering: new Set(),
    buffered: new Set(),
    failed: new Set(),
  });
  
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Extract text from a PDF page
   */
  const getPageText = useCallback(async (pageNum: number): Promise<string | null> => {
    if (!pdfDocument) return null;
    try {
      const page = await pdfService.getPage(pdfDocument, pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text || null;
    } catch (err) {
      console.error('[TtsPrebuffer] Error extracting text for page', pageNum, err);
      return null;
    }
  }, [pdfDocument]);

  /**
   * Pre-buffer a single page
   */
  const prebufferPage = useCallback(async (pageNum: number): Promise<boolean> => {
    const state = stateRef.current;
    
    // Skip if already buffered, buffering, or failed
    if (state.buffered.has(pageNum) || state.buffering.has(pageNum)) {
      return true;
    }
    
    // Mark as buffering
    state.buffering.add(pageNum);
    
    try {
      const text = await getPageText(pageNum);
      if (!text) {
        state.buffering.delete(pageNum);
        state.failed.add(pageNum);
        return false;
      }
      
      console.debug('[TtsPrebuffer] Pre-buffering page', pageNum, `(${text.length} chars)`);
      
      const result = await aiTtsPrebuffer(text, selectedVoiceId ?? undefined);
      
      state.buffering.delete(pageNum);
      
      if (result.success) {
        state.buffered.add(pageNum);
        console.debug('[TtsPrebuffer] Page', pageNum, 'buffered:', {
          cached: result.cached,
          wordCount: result.wordCount,
          duration: `${result.totalDuration.toFixed(2)}s`,
        });
        return true;
      } else {
        state.failed.add(pageNum);
        console.warn('[TtsPrebuffer] Page', pageNum, 'pre-buffer failed');
        return false;
      }
    } catch (err) {
      state.buffering.delete(pageNum);
      state.failed.add(pageNum);
      console.error('[TtsPrebuffer] Error pre-buffering page', pageNum, err);
      return false;
    }
  }, [getPageText, selectedVoiceId]);

  /**
   * Pre-buffer current page and lookahead pages
   */
  const prebufferPages = useCallback(async (startPage: number, totalPages: number) => {
    if (!initialized || !pdfDocument) return;
    
    // Calculate pages to pre-buffer
    const pagesToBuffer: number[] = [];
    
    // Current page first (highest priority)
    pagesToBuffer.push(startPage);
    
    // Then lookahead pages
    for (let i = 1; i <= lookahead; i++) {
      const nextPage = startPage + i;
      if (nextPage <= totalPages) {
        pagesToBuffer.push(nextPage);
      }
    }
    
    console.debug('[TtsPrebuffer] Queuing pages for pre-buffer:', pagesToBuffer);
    
    // Buffer pages sequentially (to not overwhelm the API)
    for (const pageNum of pagesToBuffer) {
      // Check if we should abort
      if (abortControllerRef.current?.signal.aborted) {
        console.debug('[TtsPrebuffer] Aborted');
        break;
      }
      
      await prebufferPage(pageNum);
    }
  }, [initialized, pdfDocument, lookahead, prebufferPage]);

  /**
   * Trigger pre-buffering when page changes
   */
  useEffect(() => {
    if (!enabled || !initialized || !pdfDocument) return;
    
    // Cancel any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Abort any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    // Debounce the pre-buffer to avoid spamming on rapid page changes
    debounceTimerRef.current = setTimeout(() => {
      const totalPages = pdfDocument.numPages;
      prebufferPages(currentPage, totalPages);
    }, debounceMs);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, initialized, pdfDocument, currentPage, debounceMs, prebufferPages]);

  /**
   * Reset state when document changes
   */
  useEffect(() => {
    if (pdfDocument) {
      console.debug('[TtsPrebuffer] Document changed, resetting buffer state');
      stateRef.current = {
        buffering: new Set(),
        buffered: new Set(),
        failed: new Set(),
      };
    }
  }, [pdfDocument]);

  /**
   * Reset state when voice changes (cached audio is voice-specific)
   */
  const voiceIdRef = useRef(selectedVoiceId);
  useEffect(() => {
    if (voiceIdRef.current !== selectedVoiceId) {
      console.debug('[TtsPrebuffer] Voice changed, resetting buffer state');
      stateRef.current = {
        buffering: new Set(),
        buffered: new Set(),
        failed: new Set(),
      };
      voiceIdRef.current = selectedVoiceId;
    }
  }, [selectedVoiceId]);

  return {
    /** Check if a page has been pre-buffered */
    isPageBuffered: useCallback((pageNum: number) => {
      return stateRef.current.buffered.has(pageNum);
    }, []),
    
    /** Check if a page is currently being buffered */
    isPageBuffering: useCallback((pageNum: number) => {
      return stateRef.current.buffering.has(pageNum);
    }, []),
    
    /** Manually trigger pre-buffer for a specific page */
    prebufferPage,
    
    /** Get current buffer state (for debugging) */
    getBufferState: useCallback(() => ({
      buffered: Array.from(stateRef.current.buffered),
      buffering: Array.from(stateRef.current.buffering),
      failed: Array.from(stateRef.current.failed),
    }), []),
  };
}
