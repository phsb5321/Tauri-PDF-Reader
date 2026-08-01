import { useCallback } from "react";
import { AppLayout } from "../layout/AppLayout";
import { Toolbar } from "../Toolbar";
import { PdfViewer } from "../PdfViewer";
import { AiPlaybackBar } from "../playback-bar/AiPlaybackBar";
import { useDocumentStore } from "../../stores/document-store";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import { pdfService } from "../../services/pdf-service";
import { useAutoSave } from "../../hooks/useAutoSave";
import { useTtsPrebuffer } from "../../hooks/useTtsPrebuffer";
import { useOpenPdf } from "../../hooks/useOpenPdf";
import {
  useMenuActions,
  type MenuActionHandlers,
} from "../../hooks/useMenuActions";
import { useCommandKeys } from "../../hooks/useCommandKeys";
import { aiTtsPause, aiTtsResume, aiTtsStop } from "../../lib/tauri-invoke";
import "./ReaderView.css";

export function ReaderView() {
  const { pdfDocument, currentPage, currentDocument, scrollPosition } =
    useDocumentStore();
  const { openPdf } = useOpenPdf();

  // One set of reader commands, reached two ways: the native menu (File / View
  // / Playback / Help — exported over AT-SPI on Linux to a global menu bar,
  // emitting "menu-action" events) and the keyboard. Both dispatchers below get
  // the same handlers object, so a command cannot behave differently depending
  // on how it was invoked.
  //
  // Page navigation goes through the store (which clamps to [1, totalPages]);
  // useAutoSave below persists the new page. Stop TTS first, mirroring
  // PageNavigation's on-navigation guard.
  //
  // Both the page and the playback state are read from the store at call time
  // rather than captured from this render. A held PageDown fires keydown faster
  // than React re-renders, so a captured `currentPage` would make every repeat
  // in a burst compute the same target and the page would advance once for
  // several presses. Reading `getState()` also leaves this callback with no
  // changing dependency, so the handlers object below keeps stable references.
  const goToPageBy = useCallback(async (delta: number) => {
    const playbackState = useAiTtsStore.getState().playbackState;
    const currentPage = useDocumentStore.getState().currentPage;
    if (playbackState === "playing" || playbackState === "paused") {
      try {
        await aiTtsStop();
      } catch (error) {
        console.error("Failed to stop TTS on navigation:", error);
      }
    }
    useDocumentStore.getState().setCurrentPage(currentPage + delta);
  }, []);

  // Toggle ongoing playback (playing <-> paused). Starting from idle needs the
  // page text, so that stays with the playback bar's play button.
  const handleMenuPlayPause = useCallback(async () => {
    try {
      const playbackState = useAiTtsStore.getState().playbackState;
      if (playbackState === "playing") {
        await aiTtsPause();
      } else if (playbackState === "paused") {
        await aiTtsResume();
      }
    } catch (error) {
      console.error("Failed to toggle TTS from menu:", error);
    }
  }, []);

  const commandHandlers: MenuActionHandlers = {
    onOpen: () => {
      void openPdf();
    },
    onPlayPause: () => {
      void handleMenuPlayPause();
    },
    onPrevPage: () => {
      void goToPageBy(-1);
    },
    onNextPage: () => {
      void goToPageBy(1);
    },
  };

  useMenuActions(commandHandlers);
  useCommandKeys(commandHandlers);

  // Auto-save reading progress
  useAutoSave({
    documentId: currentDocument?.id ?? null,
    currentPage,
    scrollPosition,
    enabled: !!currentDocument,
  });

  // Pre-buffer TTS audio for current and next pages
  // This ensures instant playback when user clicks play
  useTtsPrebuffer(pdfDocument, currentPage, {
    enabled: true,
    lookahead: 1, // Pre-buffer current page + 1 page ahead
    debounceMs: 1000, // Wait 1s after page change before buffering
  });

  // Get text content from current page for TTS
  const getCurrentPageText = useCallback(async (): Promise<string | null> => {
    if (!pdfDocument) return null;

    try {
      const page = await pdfService.getPage(pdfDocument, currentPage);
      const textContent = await page.getTextContent();

      // Extract text from text items
      const text = textContent.items
        .map((item) => {
          if ("str" in item) {
            return item.str;
          }
          return "";
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      return text || null;
    } catch (error) {
      console.error("Error extracting text:", error);
      return null;
    }
  }, [pdfDocument, currentPage]);

  return (
    <AppLayout
      header={<Toolbar />}
      footer={pdfDocument && <AiPlaybackBar getText={getCurrentPageText} />}
    >
      <PdfViewer />
    </AppLayout>
  );
}
