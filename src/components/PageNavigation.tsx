import { useState, useEffect, useCallback, useRef } from "react";
import { useDocumentStore } from "../stores/document-store";
import { useAiTtsStore } from "../stores/ai-tts-store";
import { useAnnounce, ANNOUNCEMENTS } from "../hooks/useAnnounce";
import { aiTtsStop } from "../lib/tauri-invoke";
import { commands } from "../lib/bindings";
import { enqueueProgressWrite } from "../hooks/useAutoSave";
import "./PageNavigation.css";

/**
 * Full-string page-number policy (257, p16 corrective acceptance 15/09/2026):
 * only trimmed ASCII digits within the safe-integer range commit. `parseInt`
 * accepted "12junk" as 12 and "1.5" as 1; plain `Number` accepts digit strings
 * like "9007199254740993" or hundreds of 9s that already lost precision —
 * those are invalid drafts that must reset with zero navigation and zero
 * progress calls. An out-of-range but precise value is clamped once, at commit.
 */
function parseDraftPage(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const page = Number(trimmed);
  return Number.isSafeInteger(page) ? page : null;
}

export function PageNavigation() {
  const { currentDocument, currentPage, totalPages, setCurrentPage } =
    useDocumentStore();
  const playbackState = useAiTtsStore((state) => state.playbackState);
  const { announce } = useAnnounce();
  const [inputValue, setInputValue] = useState(String(currentPage));
  // One dispatch per drafted target: set when a commit dispatches, cleared
  // when the store lands. A blur that arrives while the commit is still in
  // flight (stop-audio await) sees the marker and must not dispatch again.
  const dispatchedTargetRef = useRef<number | null>(null);

  // Sync the visible draft to the store page on every external or committed
  // change. This is also the stale-intent invalidation: an external page
  // change while a draft is dirty rewrites the input, so a later blur finds
  // the input equal to the current page and never replays the stale draft.
  // Document identity is part of the key: a swap that lands on the same page
  // number must still invalidate the draft and any in-flight dispatch marker.
  useEffect(() => {
    dispatchedTargetRef.current = null;
    setInputValue(String(currentPage));
  }, [currentPage, currentDocument]);

  const saveProgress = useCallback(
    async (page: number) => {
      if (currentDocument) {
        // The direct write must serialize through the SAME app-wide chain
        // as the autosave (useAutoSave.enqueueProgressWrite): an un-serialized
        // delayed direct write could otherwise land after the close flush and
        // revert the row.
        void enqueueProgressWrite(async () => {
          try {
            // Using tauri-specta generated bindings for type-safe command invocation
            const result = await commands.libraryUpdateProgress(
              currentDocument.id,
              page,
              null,
              null,
            );
            if (result.status === "error") {
              console.error("Failed to save reading progress:", result.error);
            }
          } catch (error) {
            console.error("Failed to save reading progress:", error);
          }
        });
      }
    },
    [currentDocument],
  );

  const goToPage = useCallback(
    async (page: number) => {
      const clampedPage = Math.max(1, Math.min(page, totalPages));

      // Stop TTS playback on page navigation (T023).
      // INTEGRATION GAP (LECT-130, reported 257 15/09/2026): this stop-on-browse
      // — and the same stop inside the frozen usePageNavigation hook — conflicts
      // with the independent-view/narration requirement. Unchanged here on
      // purpose: repairing narration semantics belongs to the narration owners,
      // not this leaf, and is NOT accepted as correct by 257.
      if (
        playbackState === "loading" ||
        playbackState === "playing" ||
        playbackState === "paused"
      ) {
        try {
          console.debug("[PageNavigation] Stopping TTS before page navigation");
          await aiTtsStop();
        } catch (error) {
          console.error("[PageNavigation] Failed to stop TTS:", error);
        }
      }

      setCurrentPage(clampedPage);
      saveProgress(clampedPage);

      // Announce page change for screen readers (T036)
      announce(ANNOUNCEMENTS.pageChange(clampedPage, totalPages));
    },
    [totalPages, setCurrentPage, saveProgress, playbackState, announce],
  );

  /**
   * Commit the editable draft exactly once. Enter and blur both funnel here:
   * an invalid draft or a draft equal to the current page resets with zero
   * navigation and zero progress calls; a fresh out-of-range value clamps
   * once; a value whose dispatch is still in flight is never re-dispatched.
   */
  const commitDraft = useCallback((): void => {
    const page = parseDraftPage(inputValue);
    // Clamp first, then compare: the no-op guard must look at the clamped
    // target, or page 1 + draft "0" would "navigate" to page 1 — firing
    // stop-audio, a progress write and an announcement for the same page.
    const target =
      page === null ? null : Math.max(1, Math.min(page, totalPages));
    if (target === null || target === currentPage) {
      dispatchedTargetRef.current = null;
      setInputValue(String(currentPage));
      return;
    }
    if (dispatchedTargetRef.current === target) {
      // Enter already dispatched this exact target and the store has not
      // landed yet; a trailing blur must stay silent.
      setInputValue(String(target));
      return;
    }
    dispatchedTargetRef.current = target;
    setInputValue(String(target));
    void goToPage(target);
  }, [inputValue, currentPage, totalPages, goToPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Escape") {
      // Cancel: restore the displayed page. A blur afterwards finds the input
      // equal to the current page and dispatches nothing.
      e.preventDefault();
      dispatchedTargetRef.current = null;
      setInputValue(String(currentPage));
    }
  };

  const handleInputBlur = () => {
    commitDraft();
  };

  return (
    <div className="page-navigation">
      <button
        type="button"
        className="nav-button"
        onClick={handlePrevPage}
        disabled={currentPage <= 1}
        title="Previous page (Left Arrow)"
        aria-label="Previous page"
      >
        <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div className="page-input-container" role="group" aria-label="Page position">
        <input
          type="text"
          className="page-input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          aria-label="Current page"
          aria-describedby="page-total-readout"
          inputMode="numeric"
          enterKeyHint="go"
          autoComplete="off"
        />
        <span className="page-separator">/</span>
        <span className="total-pages" id="page-total-readout">
          {totalPages}
        </span>
      </div>

      <button
        type="button"
        className="nav-button"
        onClick={handleNextPage}
        disabled={currentPage >= totalPages}
        title="Next page (Right Arrow)"
        aria-label="Next page"
      >
        <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
