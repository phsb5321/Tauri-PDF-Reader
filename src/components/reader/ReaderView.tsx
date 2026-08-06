/**
 * ReaderView — the application shell.
 *
 * Owns the two surfaces a reader moves between: the reading home (the library,
 * with its Continue-reading shelf) and the document itself. They share one
 * chrome and, more importantly, one command surface — `useMenuActions` and
 * `useCommandKeys` are mounted here exactly once, so a command reached from the
 * native menu, from the keyboard, or from either surface runs the same handler.
 * Hosting the home in a sibling shell would mean a second subscription to the
 * same events, which is the defect `useCommandKeys` was written to remove.
 *
 * @module components/reader/ReaderView
 */

import { useCallback, useState } from "react";
import { AppLayout } from "../layout/AppLayout";
import { Toolbar } from "../Toolbar";
import { PdfViewer } from "../PdfViewer";
import { LibraryView } from "../library/LibraryView";
import { AiPlaybackBar } from "../playback-bar/AiPlaybackBar";
import { SettingsPanel } from "../settings/SettingsPanel";
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
import { libraryGetDocument } from "../../lib/api/library";
import { useSessionStore } from "../../stores/session-store";
import type { Document } from "../../lib/schemas";
import "./ReaderView.css";

export function ReaderView() {
  const { pdfDocument, currentPage, currentDocument, scrollPosition, setCurrentPage } =
    useDocumentStore();
  const { openPdf, resumeDocument } = useOpenPdf();

  // The reading home is the landing surface, so this starts true: a reader with
  // nothing loaded has nothing to show, and the library is where a returning
  // reader picks up. It is a view swap rather than a close — the loaded
  // `pdfDocument` stays alive behind the home, which is what lets View ->
  // Library go back and forth without re-reading the file or losing the page.
  const [showLibrary, setShowLibrary] = useState(true);

  // Settings lives at the shell level, not inside `AiPlaybackBar`, precisely
  // because that bar only mounts once a document is open (below). A reader
  // on the reading home — where they would go first to enter an API key —
  // must be able to reach it too.
  const [showSettings, setShowSettings] = useState(false);

  // Leave the home only once something is actually showing. A cancelled dialog
  // or a file that failed to load must not strand the reader on a blank page.
  const handleResume = useCallback(
    async (document: Document) => {
      if (await resumeDocument(document)) setShowLibrary(false);
    },
    [resumeDocument],
  );

  const handleOpen = useCallback(async () => {
    if (await openPdf()) setShowLibrary(false);
  }, [openPdf]);

  // Restore a reading session: open the document the reader was last on (the
  // SessionDocument with the highest `position` — the backend returns them
  // ordered by position ASC, session_repo.rs:46) at ITS saved page. The
  // session's page is authoritative here: nothing syncs SessionDocument
  // currentPage to the library row while a session is active, so the row's
  // page can be stale. A session with nothing openable leaves the library
  // showing — the SessionMenu already reports missing documents, and the
  // reader must never be stranded on a blank surface.
  const handleSessionRestored = useCallback(
    async (_sessionId: string) => {
      const session = useSessionStore.getState().activeSession;
      if (!session || session.documents.length === 0) return;

      const lastRead = session.documents.reduce((latest, doc) =>
        doc.position > latest.position ? doc : latest,
      );
      const document = await libraryGetDocument(lastRead.documentId);
      if (!document) return; // missing — store-side missingDocuments covers it

      // `resumeDocument` re-fetches the row (libraryOpenDocument) and lands on
      // the row's page, which can be stale — nothing syncs SessionDocument
      // currentPage to the library row while a session is active. Land on the
      // session's saved page explicitly; the store clamps to totalPages.
      if (await resumeDocument(document)) {
        setCurrentPage(lastRead.currentPage);
        setShowLibrary(false);
      }
    },
    [resumeDocument, setCurrentPage],
  );

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
      void handleOpen();
    },
    onToggleLibrary: () => setShowLibrary((showing) => !showing),
    onSettings: () => setShowSettings(true),
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

  // Nothing loaded means nothing to read, so the home wins regardless of the
  // toggle. The playback bar is deliberately NOT tied to this: audio started in
  // the reader keeps playing while the home is up, and hiding its controls
  // would leave a reader with no way to stop it.
  const libraryShowing = showLibrary || !pdfDocument;

  return (
    <AppLayout
      header={<Toolbar onSessionRestored={handleSessionRestored} />}
      footer={pdfDocument && <AiPlaybackBar getText={getCurrentPageText} />}
    >
      {libraryShowing ? (
        <LibraryView
          onDocumentSelect={(document) => {
            void handleResume(document);
          }}
        />
      ) : (
        <PdfViewer />
      )}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </AppLayout>
  );
}
