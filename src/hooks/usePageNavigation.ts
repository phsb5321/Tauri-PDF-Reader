/**
 * usePageNavigation Hook
 *
 * Page-by-page navigation as one action, reached from the native View menu, the
 * keyboard (`PageUp`/`PageDown`/arrows/`Space`) and anything else that dispatches
 * `prev-page` / `next-page`. It lives here rather than inline in `ReaderView`
 * for the reason `dispatchMenuAction` lives in `useMenuActions`: the ordering
 * below is the part that can be wrong, and a function in a component body has no
 * seam to assert it through.
 *
 * The ordering that matters: stop playback FIRST, then read the page, then
 * write. Reading the page before the `await` looks equivalent and is not. A held
 * navigation key fires `keydown` far faster than an IPC round-trip completes, so
 * every repeat that arrives while the first `aiTtsStop()` is still in flight
 * would read the same pre-navigation page and compute the same target — the
 * reader would advance one page for a burst of presses. Reading after the await
 * means each call sees the page the previous one wrote.
 *
 * @module hooks/usePageNavigation
 */

import { useCallback } from "react";
import { useDocumentStore } from "../stores/document-store";
import { useAiTtsStore } from "../stores/ai-tts-store";
import { aiTtsStop } from "../lib/tauri-invoke";

/**
 * Move `delta` pages, stopping any active playback first.
 *
 * State is read from the stores at call time, never captured from a render: a
 * key repeat outruns React's re-render, so a captured value is stale by the
 * second press. The store clamps the result to `[1, totalPages]`, so a delta
 * that would leave the document is a no-op rather than an error.
 */
export async function navigatePageBy(delta: number): Promise<void> {
  const { playbackState } = useAiTtsStore.getState();

  // Mirrors PageNavigation's on-navigation guard: audio for the page you just
  // left is worse than a moment of silence.
  if (playbackState === "playing" || playbackState === "paused") {
    try {
      await aiTtsStop();
    } catch (error) {
      console.error("Failed to stop TTS on navigation:", error);
    }
  }

  // After the await, deliberately. See the module note.
  const { currentPage, setCurrentPage } = useDocumentStore.getState();
  setCurrentPage(currentPage + delta);
}

/**
 * Provides the two page-navigation actions as stable callbacks.
 *
 * Stable because `navigatePageBy` takes no React state: the callbacks have no
 * dependencies to change, so the handlers object built from them does not force
 * the command dispatchers to re-register their listeners on every render.
 */
export function usePageNavigation() {
  const goToPrevPage = useCallback(() => {
    void navigatePageBy(-1);
  }, []);

  const goToNextPage = useCallback(() => {
    void navigatePageBy(1);
  }, []);

  return { goToPrevPage, goToNextPage };
}
