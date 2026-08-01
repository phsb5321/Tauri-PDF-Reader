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
import { usePageNavigation } from "../../hooks/usePageNavigation";
import { aiTtsPause, aiTtsResume } from "../../lib/tauri-invoke";
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
  // Page navigation lives in its own module because the order it does things in
  // (stop playback, then read the page, then write) is load-bearing and needs a
  // seam to assert through. See usePageNavigation.
  const { goToPrevPage, goToNextPage } = usePageNavigation();

  // Toggle ongoing playback (playing <-> paused). Starting from idle needs the
  // page text, so that stays with the playback bar's play button.
  //
  // Playback state is read at call time rather than captured from this render,
  // so the callback has no changing dependency and the handlers object below
  // keeps stable references.
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
    onPrevPage: goToPrevPage,
    onNextPage: goToNextPage,
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
