/**
 * E2E test bridge.
 *
 * Exposes a small `window.__E2E__` API so the WebDriver (tauri-driver +
 * WebdriverIO) critical-loop test can drive the app WITHOUT the native file
 * dialog (which WebDriver cannot reach) and without a live ElevenLabs key or an
 * audio device. It only touches the SAME services/stores the real UI uses, and
 * the karaoke advance is asserted through the REAL mounted rAF loop
 * (`useTtsWordHighlight` in `AiPlaybackBar`) over real wall-clock — not a copied
 * selector — so a regression in the loop is catchable end-to-end.
 *
 * Included only when built with `VITE_E2E=true` (see main.tsx), so it never
 * ships in a normal build.
 */

import { pdfService } from "./services/pdf-service";
import { useDocumentStore } from "./stores/document-store";
import { useTtsHighlightStore } from "./stores/tts-highlight-store";
import type { WordTiming } from "./lib/api/ai-tts";

export interface E2EBridge {
  /** Load the bundled fixture PDF by URL (no fs scope / no dialog) into the store. */
  loadFixture: () => Promise<{ pages: number }>;
  /** Current document + highlight snapshot, for assertions. */
  getState: () => {
    hasDocument: boolean;
    totalPages: number;
    currentPage: number;
    highlightActive: boolean;
    currentWordIndex: number;
    wordCount: number;
  };
  /**
   * Start karaoke highlighting with explicit timing marks (no audio needed).
   * The real rAF loop mounted by AiPlaybackBar then advances `currentWordIndex`
   * over real time — the test waits and reads `getState()` to prove sync.
   */
  startKaraoke: (
    text: string,
    timings: WordTiming[],
    totalDuration: number,
  ) => void;
  /** Emit a `menu-action` event (as the native menu does) so the real
   *  `useMenuActions` listener handles it — proves menu dispatch end-to-end. */
  emitMenu: (action: string) => Promise<void>;
  /**
   * Slice 109 B1: let the REAL toolbar Open button complete without a
   * native dialog (which WebDriver cannot reach). Patches the Tauri IPC for
   * the dialog command (returns the fixture path, relative to the app's cwd
   * so the backend can hash the real file) and the fs read command (serves
   * the fixture bytes to the webview). Everything else delegates to the
   * original invoke. Returns true once installed.
   */
  installDialogFixture: () => Promise<boolean>;
  /** Slice 109 B4: arm the seams with corrupt bytes — a failed open must be visible. */
  installCorruptOpenFixture: () => Promise<boolean>;
  /** Slice 111 measure: grow the root font size so the lane can assert rem scaling. */
  setRootFontSize: (px: number) => void;
  /** True once the bridge is installed (sanity probe). */
  ready: true;
}

export function installE2EBridge(): void {
  const bridge: E2EBridge = {
    async loadFixture() {
      const pdf = await pdfService.loadDocumentFromUrl("/e2e-fixture.pdf");
      const store = useDocumentStore.getState();
      store.setPdfDocument(pdf);
      store.setDocument({
        id: "e2e-fixture",
        filePath: "/e2e-fixture.pdf",
        title: "E2E Fixture",
        pageCount: pdf.numPages,
        currentPage: 1,
        scrollPosition: 0,
        lastOpenedAt: new Date().toISOString(),
      } as never);
      return { pages: pdf.numPages };
    },
    getState() {
      const d = useDocumentStore.getState();
      const h = useTtsHighlightStore.getState();
      return {
        hasDocument: d.currentDocument !== null,
        totalPages: d.totalPages,
        currentPage: d.currentPage,
        highlightActive: h.isActive,
        currentWordIndex: h.currentWordIndex,
        wordCount: h.wordTimings.length,
      };
    },
    startKaraoke(text, timings, totalDuration) {
      useTtsHighlightStore
        .getState()
        .startHighlighting(text, timings, totalDuration, 1);
    },
    async emitMenu(action) {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("menu-action", action);
    },
    async installDialogFixture() {
      // Arm the two VITE_E2E-only seams: the dialog adapter returns the
      // fixture path (relative to the app's cwd so the BACKEND hashes the
      // real file in libraryAddDocument), and pdf-service's fs read serves
      // the fixture bytes to the webview. Only these two boundaries are
      // faked — the PDF parse, the IPC, the backend hash, the store and the
      // shell surface flip are the real flow.
      const response = await fetch("/e2e-fixture.pdf");
      const bytes = new Uint8Array(await response.arrayBuffer());
      (globalThis as Record<string, unknown>).__E2E_DIALOG_FIXTURE__ =
        "public/e2e-fixture.pdf";
      (globalThis as Record<string, unknown>).__E2E_FS_FIXTURE_BYTES__ = bytes;
      return true;
    },
    async installCorruptOpenFixture() {
      // Slice 109 B4: same seams, but the served bytes are NOT a PDF — the
      // toolbar open must fail visibly on the library surface instead of
      // silently.
      (globalThis as Record<string, unknown>).__E2E_DIALOG_FIXTURE__ =
        "public/e2e-fixture.pdf";
      (globalThis as Record<string, unknown>).__E2E_FS_FIXTURE_BYTES__ =
        new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0x00, 0x00]);
      return true;
    },
    setRootFontSize(px) {
      document.documentElement.style.fontSize = `${px}px`;
    },
    ready: true,
  };

  (window as unknown as { __E2E__: E2EBridge }).__E2E__ = bridge;
  // eslint-disable-next-line no-console
  console.info("[e2e-bridge] window.__E2E__ installed");
}
