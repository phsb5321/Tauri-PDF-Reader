/**
 * TTS Word Highlight Component
 *
 * Renders karaoke-style word highlighting on top of PDF text layer.
 * Uses CSS Custom Highlight API for clean, native text highlighting
 * (similar to VoxPage implementation).
 * 
 * Falls back to overlay-based highlighting if CSS Highlight API is not available.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useTtsHighlightStore, selectCurrentWord } from '../../stores/tts-highlight-store';
import type { WordTiming } from '../../lib/api/ai-tts';
import './TtsWordHighlight.css';

interface TtsWordHighlightProps {
  pageNumber: number;
  scale: number;
}

// Check if CSS Custom Highlight API is supported
const isHighlightApiSupported = 
  typeof CSS !== 'undefined' && 
  'highlights' in CSS;

/**
 * Find the text layer div for a specific page number
 */
function findTextLayerDiv(pageNumber: number): HTMLDivElement | null {
  const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
  if (!pageContainer) {
    return null;
  }
  return pageContainer.querySelector('.textLayer') as HTMLDivElement | null;
}

/**
 * Create a Range for a word using character offsets.
 * Uses TreeWalker to traverse text nodes (like VoxPage).
 */
function createWordRange(
  element: Element,
  charOffset: number,
  charLength: number
): Range | null {
  // Use TreeWalker to find text nodes
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  
  let currentOffset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const nodeText = textNode.textContent || '';
    const nodeLength = nodeText.length;

    if (currentOffset + nodeLength > charOffset) {
      // Found the starting node
      const startOffset = charOffset - currentOffset;
      
      try {
        const range = document.createRange();
        range.setStart(textNode, startOffset);

        if (startOffset + charLength <= nodeLength) {
          // Word fits within single text node
          range.setEnd(textNode, startOffset + charLength);
        } else {
          // Word spans multiple text nodes - keep walking
          let remainingLength = charLength - (nodeLength - startOffset);
          let endNode: Node | null = textNode;

          while ((endNode = walker.nextNode()) && remainingLength > 0) {
            const endTextNode = endNode as Text;
            const endNodeLength = endTextNode.textContent?.length || 0;

            if (endNodeLength >= remainingLength) {
              range.setEnd(endTextNode, remainingLength);
              break;
            }
            remainingLength -= endNodeLength;
          }

          // If we couldn't find end, just highlight to end of start node
          if (remainingLength > 0) {
            range.setEnd(textNode, nodeLength);
          }
        }

        return range;
      } catch {
        return null;
      }
    }

    currentOffset += nodeLength;
  }

  return null;
}

/**
 * Apply highlight using CSS Custom Highlight API
 */
function applyHighlight(range: Range): void {
  if (!isHighlightApiSupported) return;
  
  try {
    // Create a Highlight object with the range
    const highlight = new Highlight(range);
    // Register it with CSS highlights registry
    CSS.highlights.set('tts-current-word', highlight);
  } catch (e) {
    console.warn('[TtsHighlight] Failed to apply highlight:', e);
  }
}

/**
 * Clear the CSS highlight
 */
function clearHighlight(): void {
  if (!isHighlightApiSupported) return;
  
  try {
    CSS.highlights.delete('tts-current-word');
  } catch {
    // Ignore errors
  }
}

export function TtsWordHighlight({
  pageNumber,
  scale,
}: TtsWordHighlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastWordKeyRef = useRef<string>('');
  const lastScaleRef = useRef<number>(scale);
  const observerRef = useRef<MutationObserver | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  const isActive = useTtsHighlightStore((s) => s.isActive);
  const storePageNumber = useTtsHighlightStore((s) => s.pageNumber);
  const currentWordIndex = useTtsHighlightStore((s) => s.currentWordIndex);
  const wordTimings = useTtsHighlightStore((s) => s.wordTimings);
  const currentText = useTtsHighlightStore((s) => s.currentText);
  const currentWord = useTtsHighlightStore(selectCurrentWord);

  const isActiveOnThisPage = isActive && storePageNumber === pageNumber;

  // Highlight the current word
  const highlightWord = useCallback((word: WordTiming) => {
    const textLayer = textLayerRef.current;
    if (!textLayer || !currentText) return;

    const charOffset = word.charStart;
    const charLength = word.charEnd - word.charStart;

    const range = createWordRange(textLayer, charOffset, charLength);
    
    if (range) {
      applyHighlight(range);
    } else {
      console.warn('[TtsHighlight] Could not create range for word:', word.word);
    }
  }, [currentText]);

  // Set up text layer reference and observer
  useEffect(() => {
    if (!isActiveOnThisPage || !currentText) {
      clearHighlight();
      textLayerRef.current = null;
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    const setupTextLayer = () => {
      const textLayer = findTextLayerDiv(pageNumber);
      if (!textLayer) return false;
      
      const spans = textLayer.querySelectorAll('span');
      if (spans.length === 0) return false;

      textLayerRef.current = textLayer;
      
      // Re-highlight current word after text layer setup
      if (currentWord) {
        lastWordKeyRef.current = ''; // Force re-highlight
        highlightWord(currentWord);
      }
      
      return true;
    };

    // Try setup immediately
    if (!setupTextLayer()) {
      // Poll for text layer
      const interval = setInterval(() => {
        if (setupTextLayer()) {
          clearInterval(interval);
        }
      }, 50);

      setTimeout(() => clearInterval(interval), 2000);
    }

    // Set up observer to detect text layer rebuilds
    const textLayer = findTextLayerDiv(pageNumber);
    if (textLayer) {
      observerRef.current = new MutationObserver(() => {
        // Text layer was rebuilt, re-setup
        setTimeout(setupTextLayer, 50);
      });

      observerRef.current.observe(textLayer, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearHighlight();
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isActiveOnThisPage, pageNumber, currentText, currentWord, highlightWord]);

  // Detect scale changes
  useEffect(() => {
    if (scale !== lastScaleRef.current) {
      lastScaleRef.current = scale;
      clearHighlight();
      lastWordKeyRef.current = ''; // Force re-highlight after scale change
    }
  }, [scale]);

  // Update highlight when word changes
  useEffect(() => {
    if (!isActiveOnThisPage || !currentWord) {
      clearHighlight();
      return;
    }

    // Skip if same word (perf optimization)
    const wordKey = `${currentWordIndex}-${currentWord.charStart}`;
    if (wordKey === lastWordKeyRef.current) return;
    lastWordKeyRef.current = wordKey;

    highlightWord(currentWord);
  }, [isActiveOnThisPage, currentWord, currentWordIndex, highlightWord]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearHighlight();
    };
  }, []);

  // Don't render anything if TTS is not active
  if (!isActive) {
    return null;
  }

  // Only render debug pill - highlights are handled by CSS Highlight API
  return (
    <div ref={containerRef} className="tts-word-highlight-layer">
      {currentWord && (
        <div className="tts-word-debug">
          "{currentWord.word}" ({currentWordIndex + 1}/{wordTimings.length})
          {!isHighlightApiSupported && ' (no API)'}
        </div>
      )}
    </div>
  );
}
