/**
 * TTS Word Highlight Component
 *
 * Renders karaoke-style read-along highlighting inside the PDF text layer
 * using the CSS Custom Highlight API. Two tiers are painted: a calm band over
 * the spoken run so the eye has a landing zone, and a strong mark on the
 * current word. On engines without that API the progress rail remains
 * truthful, but no in-page word is painted; there is no fake overlay fallback.
 */

import { useEffect, useRef, useCallback } from "react";
import {
  useTtsHighlightStore,
  selectCurrentWord,
} from "../../stores/tts-highlight-store";
import { resolveCharRange } from "../../lib/tts-tracking";
import { rangeFromAnnotatedPdfText } from "../../lib/pdf-text";
import type { WordTiming } from "../../lib/api/ai-tts";
import "./TtsWordHighlight.css";

interface TtsWordHighlightProps {
  pageNumber: number;
  scale: number;
}

const SENTENCE_HIGHLIGHT = "tts-active-sentence";
const WORD_HIGHLIGHT = "tts-current-word";
const TEXT_LAYER_POLL_MS = 50;
const TEXT_LAYER_TIMEOUT_MS = 2000;

// Check if CSS Custom Highlight API is supported
const isHighlightApiSupported =
  typeof CSS !== "undefined" && "highlights" in CSS;

/**
 * Find the text layer div for a specific page number
 */
function findTextLayerDiv(pageNumber: number): HTMLDivElement | null {
  const pageContainer = document.querySelector(
    `[data-page-number="${pageNumber}"]`,
  );
  if (!pageContainer) {
    return null;
  }
  return pageContainer.querySelector(".textLayer") as HTMLDivElement | null;
}

/**
 * Create a Range spanning a character interval of the annotated text layer.
 */
function createCharRange(
  element: Element,
  charOffset: number,
  charLength: number,
): Range | null {
  const annotated = rangeFromAnnotatedPdfText(
    element,
    charOffset,
    charOffset + charLength,
  );
  if (annotated) return annotated;
  // A partially annotated layer has a known normalized coordinate model. If a
  // word cannot resolve inside it, fail closed rather than drifting through raw
  // PDF.js node lengths. The raw fallback is only for wholly legacy layers.
  if (element.querySelector("span[data-tts-start]")) return null;

  // Fallback for text layers created before annotation was available.
  // Collect the text-layer's text nodes in document order.
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    nodes.push(node as Text);
  }

  // Resolve the char range to (node, offset) pairs (pure + unit-tested). Returns
  // null when the word starts beyond this page's text (it belongs to another
  // page); when the word straddles the page boundary the end is clamped to the
  // last node so the on-page portion still highlights.
  const lengths = nodes.map((t) => (t.textContent ?? "").length);
  const resolved = resolveCharRange(lengths, charOffset, charLength);
  if (!resolved) return null;

  try {
    const range = document.createRange();
    range.setStart(nodes[resolved.startIndex], resolved.startOffset);
    range.setEnd(nodes[resolved.endIndex], resolved.endOffset);
    return range;
  } catch {
    return null;
  }
}

/**
 * Register exactly one range under `name`. The previous entry is deleted
 * first so a late callback can never leave two words painted at once.
 */
function setHighlightRange(
  name: string,
  range: Range | null,
  priority: number,
): void {
  if (!isHighlightApiSupported) return;

  try {
    CSS.highlights.delete(name);
    if (!range) return;
    const highlight = new Highlight(range);
    highlight.priority = priority;
    CSS.highlights.set(name, highlight);
  } catch (e) {
    console.warn(`[TtsHighlight] Failed to apply ${name}:`, e);
  }
}

/**
 * Clear both read-along tiers.
 */
function clearHighlight(): void {
  if (!isHighlightApiSupported) return;

  try {
    CSS.highlights.delete(WORD_HIGHLIGHT);
    CSS.highlights.delete(SENTENCE_HIGHLIGHT);
  } catch {
    // Ignore errors
  }
}

export function TtsWordHighlight({ pageNumber, scale }: TtsWordHighlightProps) {
  // One cursor epoch. Every deferred callback captures it, so a repaint
  // scheduled for a previous word, page, or scale is dropped instead of
  // overwriting the current one.
  const epochRef = useRef(0);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  const isActive = useTtsHighlightStore((s) => s.isActive);
  const storePageNumber = useTtsHighlightStore((s) => s.pageNumber);
  const currentWordIndex = useTtsHighlightStore((s) => s.currentWordIndex);
  const currentText = useTtsHighlightStore((s) => s.currentText);
  const wordTimings = useTtsHighlightStore((s) => s.wordTimings);
  const currentWord = useTtsHighlightStore(selectCurrentWord);

  const isActiveOnThisPage = isActive && storePageNumber === pageNumber;

  /** Paint the calm band covering the whole run being spoken. */
  const paintSentence = useCallback(
    (epoch: number) => {
      const textLayer = textLayerRef.current;
      if (!textLayer || epoch !== epochRef.current) return;

      const first = wordTimings[0];
      const last = wordTimings[wordTimings.length - 1];
      if (!first || !last || last.charEnd <= first.charStart) {
        setHighlightRange(SENTENCE_HIGHLIGHT, null, 0);
        return;
      }
      setHighlightRange(
        SENTENCE_HIGHLIGHT,
        createCharRange(
          textLayer,
          first.charStart,
          last.charEnd - first.charStart,
        ),
        0,
      );
    },
    [wordTimings],
  );

  /** Paint the strong mark on the word currently being spoken. */
  const paintWord = useCallback((word: WordTiming, epoch: number) => {
    const textLayer = textLayerRef.current;
    if (!textLayer || epoch !== epochRef.current) return;

    const range = createCharRange(
      textLayer,
      word.charStart,
      word.charEnd - word.charStart,
    );
    if (!range) {
      console.warn(
        "[TtsHighlight] Could not create range for word:",
        word.word,
      );
      return;
    }
    setHighlightRange(WORD_HIGHLIGHT, range, 1);
  }, []);

  // Resolve the text layer once per page/scale/run — never per word — and keep
  // every timer and observer callback cancellable.
  useEffect(() => {
    const epoch = ++epochRef.current;
    clearHighlight();
    textLayerRef.current = null;

    if (!isActiveOnThisPage || !currentText) return;

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let giveUpTimer: ReturnType<typeof setTimeout> | null = null;
    let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      if (giveUpTimer) clearTimeout(giveUpTimer);
      pollTimer = null;
      giveUpTimer = null;
    };

    const setupTextLayer = (): boolean => {
      if (epoch !== epochRef.current) return true;
      const textLayer = findTextLayerDiv(pageNumber);
      if (!textLayer || textLayer.querySelectorAll("span").length === 0) {
        return false;
      }

      textLayerRef.current = textLayer;
      paintSentence(epoch);
      const word = useTtsHighlightStore.getState();
      const active = selectCurrentWord(word);
      if (active) paintWord(active, epoch);
      return true;
    };

    if (!setupTextLayer()) {
      pollTimer = setInterval(() => {
        if (setupTextLayer()) stopPolling();
      }, TEXT_LAYER_POLL_MS);
      giveUpTimer = setTimeout(stopPolling, TEXT_LAYER_TIMEOUT_MS);
    }

    const observed = findTextLayerDiv(pageNumber);
    if (observed) {
      observer = new MutationObserver(() => {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => {
          rebuildTimer = null;
          setupTextLayer();
        }, TEXT_LAYER_POLL_MS);
      });
      observer.observe(observed, { childList: true, subtree: true });
    }

    return () => {
      // Retiring the epoch is what makes any callback already in flight a
      // no-op, even if its timer fires before this cleanup cancels it.
      epochRef.current += 1;
      stopPolling();
      if (rebuildTimer) clearTimeout(rebuildTimer);
      observer?.disconnect();
      clearHighlight();
      textLayerRef.current = null;
    };
  }, [
    isActiveOnThisPage,
    pageNumber,
    scale,
    currentText,
    paintSentence,
    paintWord,
  ]);

  // Advance the word mark. The band is repainted only when the run changes.
  useEffect(() => {
    if (!isActiveOnThisPage || !currentWord) {
      setHighlightRange(WORD_HIGHLIGHT, null, 1);
      return;
    }
    paintWord(currentWord, epochRef.current);
  }, [isActiveOnThisPage, currentWord, currentWordIndex, paintWord]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      epochRef.current += 1;
      clearHighlight();
    };
  }, []);

  // The visible treatment is the in-page CSS Highlight. A floating debug pill
  // duplicated the bottom progress and obscured the book, so production renders
  // no extra overlay chrome.
  return null;
}
