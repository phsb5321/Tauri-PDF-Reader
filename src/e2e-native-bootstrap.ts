/**
 * E2E native-path bootstrap.
 *
 * Unlike `e2e-bridge.ts` (which drives the karaoke loop directly through
 * `window.__E2E__.startKaraoke`), this bootstrap shims NOTHING about the play
 * path. It only performs the two steps a WebDriver genuinely cannot:
 *
 *   1. Initialize TTS — the native ElevenLabs key entry / settings dialog is
 *      not reachable by WebDriver. The `e2e-tts-fixture` Rust build makes
 *      `ai_tts_init` succeed with no network, so the REAL play button renders
 *      (`canPlay = initialized && !error`).
 *   2. Open the fixture PDF — the native GTK file dialog is not reachable by
 *      WebDriver. We load the bundled fixture through the SAME pdf-service path
 *      the real "open" flow uses.
 *
 * After that, the test clicks the REAL `.ai-playback-button`, which runs the
 * real `handlePlay → speakWithHighlight → invoke(ai_tts_speak_with_timestamps)`
 * chain. The fixture Rust backend returns real marks and emits the real
 * `ai-tts:playback-starting` event, so the karaoke index advances through the
 * REAL `useTtsWordHighlight` rAF loop over real wall-clock. `window.__E2E_READ__`
 * is read-only — it observes the store, it never drives it.
 *
 * Included only when built with `VITE_E2E_NATIVE=true` (see main.tsx) AND the
 * Rust binary is compiled with `--features e2e-tts-fixture`. Never ships normal.
 */

import { aiTtsInit } from "./lib/tauri-invoke";
import { pdfService } from "./services/pdf-service";
import { useAiTtsStore } from "./stores/ai-tts-store";
import { useDocumentStore } from "./stores/document-store";
import { useTtsHighlightStore } from "./stores/tts-highlight-store";

export interface E2ENativeRead {
  /** True once TTS is initialized AND the fixture PDF is loaded. */
  ready: boolean;
  /** Last bootstrap error message, if any (null on success). */
  error: string | null;
  /** Live karaoke index from the real highlight store (-1 before play). */
  currentWordIndex: () => number;
  /** Whether the real karaoke loop is active. */
  isActive: () => boolean;
  /** Number of marks the real backend returned (0 before play). */
  wordCount: () => number;
  /** Real TTS playback state machine value. */
  playbackState: () => string;
}

export async function installE2ENativeBootstrap(): Promise<void> {
  const read: E2ENativeRead = {
    ready: false,
    error: null,
    currentWordIndex: () => useTtsHighlightStore.getState().currentWordIndex,
    isActive: () => useTtsHighlightStore.getState().isActive,
    wordCount: () => useTtsHighlightStore.getState().wordTimings.length,
    playbackState: () => useAiTtsStore.getState().playbackState,
  };
  (window as unknown as { __E2E_READ__: E2ENativeRead }).__E2E_READ__ = read;

  try {
    // 1) Real init command → e2e-tts-fixture backend (no network). Mirrors what
    //    useAiTts.initialize() does (aiTtsInit → setApiKey → setInitialized) so
    //    the real play button renders: the bar gates on `needsApiKey` (= !apiKey)
    //    for the setup view, and `canPlay` (= initialized && !error) for enabled.
    await aiTtsInit("e2e-fixture-key");
    const tts = useAiTtsStore.getState();
    tts.setApiKey("e2e-fixture-key");
    tts.setInitialized(true);

    // 2) Real PDF load path (no native dialog).
    const pdf = await pdfService.loadDocumentFromUrl("/e2e-fixture.pdf");
    const store = useDocumentStore.getState();
    store.setPdfDocument(pdf);
    store.setDocument({
      id: "e2e-native-fixture",
      filePath: "/e2e-fixture.pdf",
      title: "E2E Native Fixture",
      pageCount: pdf.numPages,
      currentPage: 1,
      scrollPosition: 0,
      lastOpenedAt: new Date().toISOString(),
    } as never);

    read.ready = true;
    // eslint-disable-next-line no-console
    console.info("[e2e-native] bootstrap ready (TTS init + fixture loaded)");
  } catch (e) {
    read.error = e instanceof Error ? e.message : String(e);
    console.error("[e2e-native] bootstrap failed", e);
  }
}
