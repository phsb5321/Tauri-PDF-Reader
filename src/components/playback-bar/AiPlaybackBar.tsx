import { useCallback, useEffect, useState, useRef } from "react";
import { useAiTts } from "../../hooks/useAiTts";
import { useTtsWordHighlight } from "../../hooks/useTtsWordHighlight";
import { useAudioCache } from "../../hooks/useAudioCache";
import { useAnnounce, ANNOUNCEMENTS } from "../../hooks/useAnnounce";
import { useDocumentStore } from "../../stores/document-store";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import { pdfService } from "../../services/pdf-service";
import { aiTtsPrebuffer } from "../../lib/api/ai-tts";
import {
  planProsodyRuns,
  resolveProsodyLanguage,
  type AlignmentSegment,
  type ProsodyBoundary,
  type ProsodyLanguage,
  type ProsodySource,
  type SpokenRun,
} from "../../lib/prosody-plan";
import { AI_TTS_SETUP_MESSAGE } from "../../lib/constants";
import { narrationPerformancePolicy } from "../../lib/narration-performance";
import {
  getPdfPageReadyEpoch,
  waitForPdfPageReady,
} from "../../lib/pdf-page-ready";
import { buildPdfText, type BuiltPdfText } from "../../lib/pdf-text";
import { AiVoiceSelector } from "./AiVoiceSelector";
import { AiSpeedSlider } from "./AiSpeedSlider";
import { NarrationCockpit } from "./NarrationCockpit";
import { AudioCacheProgress } from "../audio-progress/AudioCacheProgress";
import { AudioExportDialog } from "../export-dialog/AudioExportDialog";
import "./AiPlaybackBar.css";

export function consumeNaturalCompletion(
  observed: number,
  consumed: number,
  playbackRequested: boolean,
  usesWordHighlighting: boolean,
): { consumed: number; advance: boolean } {
  if (observed <= consumed) return { consumed, advance: false };
  return {
    consumed: observed,
    // Marks mode already consumes the same sink-finished event through
    // useTtsWordHighlight.onComplete. Only no-mark/plain playback consumes the
    // store token, or the page would advance twice.
    advance: playbackRequested && !usesWordHighlighting,
  };
}

const PAGE_READY_TIMEOUT_MS = 8_000;

type NarrationSource = string | BuiltPdfText;

function sourceText(source: NarrationSource): string {
  return typeof source === "string" ? source : source.text;
}

function prosodySource(
  source: NarrationSource,
  language: ProsodyLanguage,
  normalizeNumbers: boolean,
): ProsodySource {
  return typeof source === "string"
    ? { text: source, language, normalizeNumbers }
    : {
        text: source.text,
        boundaries: source.boundaries,
        segments: source.segments,
        language,
        normalizeNumbers,
      };
}

interface SentencePlaybackQueue {
  pageNumber: number;
  sentences: SpokenRun[];
  index: number;
  generation: number;
  baseOffset: number;
  lookaheadUnits: number;
  prefetches: Map<number, Promise<void>>;
  prefetchTail: Promise<void>;
}

interface SelectionPlayRequest {
  token: number;
  text: string;
  baseOffset: number;
}

interface AiPlaybackBarProps {
  getText: () => Promise<NarrationSource | null>;
  enableHighlighting?: boolean;
  /**
   * Incremented by the catch-up shelf's opt-in "Resume & play" action. Any
   * new value (not the value itself) requests one play attempt — a counter
   * rather than a boolean so a second request is distinguishable from the
   * first even if the first never actually started (e.g. no API key yet).
   */
  autoPlayToken?: number;
  /**
   * Immutable “Read from here” intent. Unlike generic Play, it replaces any
   * paused/active narration and binds text + offset to this exact request.
   */
  selectionPlayRequest?: SelectionPlayRequest | null;
  onAutoPlayConsumed?: (token: number) => void;
  onSelectionPlayConsumed?: (token: number) => void;
}

export function AiPlaybackBar({
  getText,
  enableHighlighting = true,
  autoPlayToken = 0,
  selectionPlayRequest = null,
  onAutoPlayConsumed,
  onSelectionPlayConsumed,
}: AiPlaybackBarProps) {
  const {
    initialized,
    playbackState,
    needsApiKey,
    error,
    speak,
    stop,
    pause,
    resume,
    clearError,
    supportsWordTimings = useAiTtsStore.getState().supportsWordTimings,
    maxTextUtf8Bytes = useAiTtsStore.getState().maxTextUtf8Bytes,
    connectedProviders = [],
    switchingProvider = null,
    switchProvider = async () => false,
  } = useAiTts();

  const {
    pdfDocument,
    currentPage,
    totalPages,
    setCurrentPage,
    currentDocument,
  } = useDocumentStore();
  const [showSettings, setShowSettings] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const suppressEscapeStopRef = useRef(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const closeNarrationCockpit = useCallback((preservePlayback = false) => {
    if (preservePlayback) {
      suppressEscapeStopRef.current = true;
      window.setTimeout(() => {
        suppressEscapeStopRef.current = false;
      }, 0);
    }
    setShowSettings(false);
    window.requestAnimationFrame(() => settingsButtonRef.current?.focus());
  }, []);
  // T033: Use store for autoPageEnabled (persisted setting)
  const autoPageEnabled = useAiTtsStore((s) => s.autoPageEnabled);
  const naturalCompletionCount = useAiTtsStore((s) => s.naturalCompletionCount);
  const provider = useAiTtsStore((s) => s.provider);
  const selectedVoiceId = useAiTtsStore((s) => s.selectedVoiceId);
  const selectedVoice = useAiTtsStore(
    (s) => s.voices.find((voice) => voice.id === s.selectedVoiceId) ?? null,
  );
  const performanceProfile = useAiTtsStore((s) => s.performanceProfile);
  const numberNormalizationEnabled = useAiTtsStore(
    (s) => s.numberNormalizationEnabled,
  );
  const narrationLanguage = useAiTtsStore((s) => s.narrationLanguage);
  const resolvedNarrationLanguage = resolveProsodyLanguage(
    narrationLanguage,
    selectedVoiceId,
    selectedVoice?.labels ?? null,
  );
  const playingRef = useRef(false);
  // Providers without marks use measured-duration word estimates. The UI must
  // remain on the same real audio clock instead of hiding karaoke and leaving
  // progress stuck at zero.
  const usesWordHighlighting = enableHighlighting;
  const speakWithHighlightRef = useRef<
    | ((
        text: string,
        pageNumber: number,
        voiceId?: string,
        baseOffset?: number,
        alignment?: readonly AlignmentSegment[],
        boundaryAfter?: ProsodyBoundary,
      ) => Promise<boolean>)
    | null
  >(null);
  const playbackGenerationRef = useRef(0);
  const selectionRestartEpochRef = useRef(0);
  const sentenceQueueRef = useRef<SentencePlaybackQueue | null>(null);
  const pageContinuationAbortRef = useRef<AbortController | null>(null);
  const pendingContinuationPageRef = useRef<number | null>(null);
  const [continuationPending, setContinuationPending] = useState(false);
  const readerPageRef = useRef(currentPage);
  const cancelPageContinuation = useCallback(() => {
    pageContinuationAbortRef.current?.abort();
    pageContinuationAbortRef.current = null;
    pendingContinuationPageRef.current = null;
    setContinuationPending(false);
  }, []);
  useEffect(
    () => () => {
      selectionRestartEpochRef.current += 1;
      cancelPageContinuation();
    },
    [cancelPageContinuation],
  );
  const [sentenceProgress, setSentenceProgress] = useState<{
    completedWords: number;
    totalWords: number;
  } | null>(null);

  // A provider switch starts in the shared store before the backend stop/swap.
  // Invalidate this component's private queue immediately so an old sink event
  // cannot advance a sentence or page while the switch is settling.
  useEffect(() => {
    if (!switchingProvider) return;
    selectionRestartEpochRef.current += 1;
    playingRef.current = false;
    playbackGenerationRef.current += 1;
    sentenceQueueRef.current = null;
    cancelPageContinuation();
    setSentenceProgress(null);
  }, [switchingProvider, cancelPageContinuation]);

  // A reader-driven page turn can arrive through several public surfaces, not
  // all of which call this component's handleStop. Invalidate the private
  // no-mark queue at the shared page authority. Natural auto-page clears the
  // completed queue before changing currentPage, so it is not cancelled here.
  useEffect(() => {
    if (readerPageRef.current !== currentPage) {
      readerPageRef.current = currentPage;
      selectionRestartEpochRef.current += 1;
    }
    const pendingPage = pendingContinuationPageRef.current;
    if (pendingPage !== null && pendingPage !== currentPage) {
      cancelPageContinuation();
    }

    const queue = sentenceQueueRef.current;
    if (!queue || queue.pageNumber === currentPage) return;
    playingRef.current = false;
    playbackGenerationRef.current += 1;
    sentenceQueueRef.current = null;
    setSentenceProgress(null);
    if (playbackState !== "idle") void stop();
  }, [currentPage, playbackState, stop, cancelPageContinuation]);

  // T050: Audio cache coverage for current document
  const documentId = currentDocument?.id ?? null;
  useAudioCache(documentId);
  // Refs to avoid stale closure in handlePlaybackComplete (T029, T035)
  const currentPageRef = useRef(currentPage);
  const totalPagesRef = useRef(totalPages);

  // Keep refs in sync with current values
  useEffect(() => {
    currentPageRef.current = currentPage;
    totalPagesRef.current = totalPages;
  }, [currentPage, totalPages]);

  // Get text for a specific page
  const getPageText = useCallback(
    async (pageNum: number): Promise<BuiltPdfText | null> => {
      if (!pdfDocument) return null;
      try {
        const page = await pdfService.getPage(pdfDocument, pageNum);
        const textContent = await page.getTextContent();
        const built = buildPdfText(textContent.items);
        return built.text ? built : null;
      } catch (err) {
        console.error("Error extracting text for page", pageNum, err);
        return null;
      }
    },
    [pdfDocument],
  );

  const prefetchSentences = useCallback(
    (queue: SentencePlaybackQueue, startIndex: number) => {
      if (supportsWordTimings) return;
      const endIndex = Math.min(
        queue.sentences.length,
        startIndex + queue.lookaheadUnits,
      );
      for (let index = startIndex; index < endIndex; index += 1) {
        if (queue.prefetches.has(index)) continue;
        const sentence = queue.sentences[index];
        const task = queue.prefetchTail
          .then(async () => {
            if (
              queue.generation !== playbackGenerationRef.current ||
              sentenceQueueRef.current !== queue
            ) {
              return;
            }
            await aiTtsPrebuffer(
              sentence.spokenText,
              selectedVoiceId ?? undefined,
              sentence.boundaryAfter,
            );
          })
          .catch((error) => {
            console.warn("[AiPlaybackBar] Sentence prebuffer failed:", error);
          });
        queue.prefetchTail = task;
        queue.prefetches.set(index, task);
      }
    },
    [supportsWordTimings, selectedVoiceId],
  );

  const startSentenceSequence = useCallback(
    async (
      source: NarrationSource,
      pageNumber: number,
      baseOffset = 0,
    ): Promise<boolean> => {
      const text = sourceText(source);
      const policy = narrationPerformancePolicy(
        performanceProfile,
        maxTextUtf8Bytes,
      );
      const sentences = planProsodyRuns(
        prosodySource(
          source,
          resolvedNarrationLanguage,
          numberNormalizationEnabled,
        ),
        maxTextUtf8Bytes,
        policy.contextMaxUtf8Bytes,
      );
      if (sentences.length === 0) {
        if (text.trim()) {
          useAiTtsStore
            .getState()
            .setError(
              `TTS_TEXT_BOUND: ${provider} cannot safely split this text within ${maxTextUtf8Bytes} UTF-8 bytes`,
            );
        }
        return false;
      }

      const generation = ++playbackGenerationRef.current;
      const queue: SentencePlaybackQueue = {
        pageNumber,
        sentences,
        index: 0,
        generation,
        baseOffset,
        lookaheadUnits: policy.lookaheadUnits,
        prefetches: new Map(),
        prefetchTail: Promise.resolve(),
      };
      sentenceQueueRef.current = queue;
      setSentenceProgress({
        completedWords: 0,
        totalWords: sentences.reduce(
          (total, sentence) =>
            total + sentence.spokenText.split(/\s+/u).filter(Boolean).length,
          0,
        ),
      });

      const first = sentences[0];
      const started =
        (await speakWithHighlightRef.current?.(
          first.spokenText,
          pageNumber,
          selectedVoiceId ?? undefined,
          baseOffset + first.sourceStart,
          first.alignment,
          first.boundaryAfter,
        )) ?? false;
      if (generation !== playbackGenerationRef.current) return false;
      if (started) prefetchSentences(queue, 1);
      return started;
    },
    [
      maxTextUtf8Bytes,
      performanceProfile,
      prefetchSentences,
      provider,
      selectedVoiceId,
      resolvedNarrationLanguage,
      numberNormalizationEnabled,
    ],
  );

  // Handle multi-page continuation
  // Uses refs to avoid stale closure (T029)
  const handlePlaybackComplete = useCallback(async () => {
    const queue = sentenceQueueRef.current;
    if (queue && queue.generation !== playbackGenerationRef.current) return;
    if (
      queue &&
      queue.generation === playbackGenerationRef.current &&
      queue.index + 1 < queue.sentences.length &&
      playingRef.current
    ) {
      const completed = queue.sentences[queue.index];
      const nextIndex = queue.index + 1;
      const prefetched = queue.prefetches.get(nextIndex);
      if (prefetched) {
        await Promise.race([
          prefetched,
          new Promise<void>((resolve) => setTimeout(resolve, 2_500)),
        ]);
        queue.prefetches.delete(nextIndex);
      }
      if (queue.generation !== playbackGenerationRef.current) return;

      queue.index = nextIndex;
      setSentenceProgress((progress) =>
        progress
          ? {
              ...progress,
              completedWords:
                progress.completedWords +
                completed.spokenText.split(/\s+/u).filter(Boolean).length,
            }
          : null,
      );
      const next = queue.sentences[nextIndex];
      const started =
        (await speakWithHighlightRef.current?.(
          next.spokenText,
          queue.pageNumber,
          selectedVoiceId ?? undefined,
          queue.baseOffset + next.sourceStart,
          next.alignment,
          next.boundaryAfter,
        )) ?? false;
      if (
        queue.generation !== playbackGenerationRef.current ||
        sentenceQueueRef.current !== queue
      ) {
        return;
      }
      if (!started) {
        playingRef.current = false;
        sentenceQueueRef.current = null;
        setSentenceProgress(null);
        return;
      }
      prefetchSentences(queue, nextIndex + 1);
      return;
    }

    if (queue && sentenceQueueRef.current !== queue) return;
    sentenceQueueRef.current = null;
    setSentenceProgress(null);
    console.debug("[AiPlaybackBar] Playback complete, checking for next page");

    if (!autoPageEnabled || !playingRef.current) {
      playingRef.current = false;
      return;
    }

    // Use refs for current state to avoid stale closures (T029, T035)
    const page = currentPageRef.current;
    const total = totalPagesRef.current;

    // Check if there's a next page
    if (page < total) {
      const nextPage = page + 1;
      console.debug("[AiPlaybackBar] Moving to next page:", nextPage);

      const previousReadyEpoch = getPdfPageReadyEpoch(nextPage);
      const generation = playbackGenerationRef.current;
      cancelPageContinuation();
      const controller = new AbortController();
      pageContinuationAbortRef.current = controller;
      pendingContinuationPageRef.current = nextPage;
      setContinuationPending(true);

      // Navigate, then wait for this exact render's canvas, text layer, and
      // source annotations. An older ready marker for the same page is stale.
      setCurrentPage(nextPage);
      const ready = await waitForPdfPageReady(nextPage, previousReadyEpoch, {
        signal: controller.signal,
        timeoutMs: PAGE_READY_TIMEOUT_MS,
      });
      if (pageContinuationAbortRef.current === controller) {
        pageContinuationAbortRef.current = null;
        pendingContinuationPageRef.current = null;
        setContinuationPending(false);
      }
      if (
        ready.status === "aborted" ||
        !playingRef.current ||
        generation !== playbackGenerationRef.current
      ) {
        return;
      }
      if (ready.status === "timeout") {
        playingRef.current = false;
        playbackGenerationRef.current += 1;
        useAiTtsStore
          .getState()
          .setError(
            `TTS_PAGE_NOT_READY: Page ${nextPage} did not finish rendering`,
          );
        return;
      }

      const nextText = await getPageText(nextPage);
      if (
        !nextText ||
        !playingRef.current ||
        generation !== playbackGenerationRef.current
      ) {
        if (!nextText) {
          playingRef.current = false;
          useAiTtsStore
            .getState()
            .setError(
              `TTS_PAGE_TEXT_UNAVAILABLE: Page ${nextPage} has no readable text`,
            );
        }
        return;
      }
      if (usesWordHighlighting) {
        await startSentenceSequence(nextText, nextPage, 0);
      } else {
        await speak(sourceText(nextText));
      }
    } else {
      console.debug("[AiPlaybackBar] Reached last page, stopping");
      playingRef.current = false;
    }
  }, [
    autoPageEnabled,
    setCurrentPage,
    getPageText,
    usesWordHighlighting,
    startSentenceSequence,
    selectedVoiceId,
    prefetchSentences,
    speak,
    cancelPageContinuation,
  ]);

  // Plain/no-mark providers complete from the real sink-drained event recorded
  // by the store. Explicit Stop never increments this token.
  const consumedNaturalCompletion = useRef(naturalCompletionCount);
  useEffect(() => {
    const outcome = consumeNaturalCompletion(
      naturalCompletionCount,
      consumedNaturalCompletion.current,
      playingRef.current,
      usesWordHighlighting,
    );
    consumedNaturalCompletion.current = outcome.consumed;
    if (outcome.advance) void handlePlaybackComplete();
  }, [naturalCompletionCount, handlePlaybackComplete, usesWordHighlighting]);

  // Word highlighting hook
  const {
    isActive: isHighlightActive,
    isPaused: isHighlightPaused,
    speakWithHighlight,
    stop: stopHighlight,
    pause: pauseHighlight,
    resume: resumeHighlight,
    currentWordIndex,
    wordTimings,
  } = useTtsWordHighlight({
    onComplete: () => {
      void handlePlaybackComplete();
    },
    onWordChange: useCallback((wordIndex: number, word: string) => {
      console.debug("[AiPlaybackBar] Word changed:", wordIndex, word);
    }, []),
  });

  useEffect(() => {
    speakWithHighlightRef.current = speakWithHighlight;
  }, [speakWithHighlight]);

  const hasActiveSentenceQueue =
    sentenceProgress !== null && playingRef.current;
  const isPlaying = usesWordHighlighting
    ? hasActiveSentenceQueue
      ? !isHighlightPaused
      : isHighlightActive && !isHighlightPaused
    : playbackState === "playing";
  const isPaused = usesWordHighlighting
    ? isHighlightPaused && (hasActiveSentenceQueue || isHighlightActive)
    : playbackState === "paused";
  const isLoading = playbackState === "loading";
  const canPlay = initialized && !error && !switchingProvider;
  const progressTotal = sentenceProgress?.totalWords ?? wordTimings.length;
  const progressCurrent = Math.min(
    progressTotal,
    (sentenceProgress?.completedWords ?? 0) +
      (currentWordIndex >= 0 ? currentWordIndex + 1 : 0),
  );

  // Screen reader announcements for TTS state changes (T039)
  const { announce } = useAnnounce();
  const prevPlayingRef = useRef(isPlaying);
  const prevPausedRef = useRef(isPaused);

  useEffect(() => {
    // Announce state changes for screen readers
    if (isPlaying && !prevPlayingRef.current) {
      announce(ANNOUNCEMENTS.ttsPlaying());
    } else if (isPaused && !prevPausedRef.current) {
      announce(ANNOUNCEMENTS.ttsPaused());
    } else if (
      !isPlaying &&
      !isPaused &&
      (prevPlayingRef.current || prevPausedRef.current)
    ) {
      announce(ANNOUNCEMENTS.ttsStopped());
    }
    prevPlayingRef.current = isPlaying;
    prevPausedRef.current = isPaused;
  }, [isPlaying, isPaused, announce]);

  const startFreshPlayback = useCallback(
    async (requestedSource?: NarrationSource, requestedBaseOffset = 0) => {
      if (!canPlay) return;
      cancelPageContinuation();
      if (supportsWordTimings) playbackGenerationRef.current += 1;
      playingRef.current = true;
      const source = requestedSource ?? (await getText());
      const baseOffset =
        requestedSource === undefined ? 0 : requestedBaseOffset;
      if (source) {
        const text = sourceText(source);
        const started = usesWordHighlighting
          ? await startSentenceSequence(source, currentPage, baseOffset)
          : await speak(text);
        if (started === false) playingRef.current = false;
      } else {
        playingRef.current = false;
      }
    },
    [
      canPlay,
      getText,
      speak,
      usesWordHighlighting,
      supportsWordTimings,
      startSentenceSequence,
      currentPage,
      cancelPageContinuation,
    ],
  );

  const handlePlay = useCallback(async () => {
    if (!canPlay || isLoading) return;
    if (isPaused) {
      cancelPageContinuation();
      if (usesWordHighlighting) {
        await resumeHighlight();
      } else {
        await resume();
      }
      return;
    }
    await startFreshPlayback();
  }, [
    canPlay,
    isLoading,
    isPaused,
    resume,
    resumeHighlight,
    usesWordHighlighting,
    cancelPageContinuation,
    startFreshPlayback,
  ]);

  const handlePause = useCallback(async () => {
    if (usesWordHighlighting) {
      await pauseHighlight();
    } else {
      await pause();
    }
  }, [pause, pauseHighlight, usesWordHighlighting]);

  // Resume-and-play: consume each new `autoPlayToken` at most once, tracked
  // by a ref rather than by comparing against the playback state, so a value
  // that arrives before `canPlay` goes true (TTS still initializing) is not
  // lost — the effect re-runs as `canPlay` changes and fires the first time
  // both are true. Degrades honestly: no key means `canPlay` never goes true,
  // so this never fires — the reader already landed on the page via the
  // normal resume path, and the existing setup prompt (below, `needsApiKey`)
  // is what they see instead of a silent no-op.
  const consumedAutoPlayToken = useRef(0);
  useEffect(() => {
    if (
      autoPlayToken > consumedAutoPlayToken.current &&
      canPlay &&
      !isLoading
    ) {
      consumedAutoPlayToken.current = autoPlayToken;
      onAutoPlayConsumed?.(autoPlayToken);
      void handlePlay();
    }
  }, [autoPlayToken, canPlay, isLoading, handlePlay, onAutoPlayConsumed]);

  const handleStop = useCallback(async () => {
    selectionRestartEpochRef.current += 1;
    playingRef.current = false;
    playbackGenerationRef.current += 1;
    sentenceQueueRef.current = null;
    cancelPageContinuation();
    setSentenceProgress(null);
    if (usesWordHighlighting) {
      await stopHighlight();
    } else {
      await stop();
    }
  }, [stop, stopHighlight, usesWordHighlighting, cancelPageContinuation]);

  // A selection is a replace request, never a synonym for generic Play. Its
  // immutable text/offset travels with the token, and an epoch makes any Stop,
  // page/provider change, unmount, or newer selection cancel the async handoff.
  const consumedSelectionPlayToken = useRef(0);
  useEffect(() => {
    if (!canPlay) selectionRestartEpochRef.current += 1;
  }, [canPlay]);
  useEffect(() => {
    const request = selectionPlayRequest;
    if (
      !request ||
      request.token <= consumedSelectionPlayToken.current ||
      !canPlay
    ) {
      return;
    }
    consumedSelectionPlayToken.current = request.token;
    onSelectionPlayConsumed?.(request.token);
    const requestedPage = currentPage;
    const requestedProvider = provider;
    void (async () => {
      const stopPromise = handleStop();
      const restartEpoch = selectionRestartEpochRef.current;
      await stopPromise;
      const liveDocument = useDocumentStore.getState();
      const liveTts = useAiTtsStore.getState();
      if (
        restartEpoch !== selectionRestartEpochRef.current ||
        liveDocument.currentPage !== requestedPage ||
        liveTts.provider !== requestedProvider ||
        !liveTts.initialized ||
        liveTts.error !== null ||
        liveTts.switchingProvider !== null
      ) {
        return;
      }
      await startFreshPlayback(request.text, request.baseOffset);
    })();
  }, [
    selectionPlayRequest,
    canPlay,
    handleStop,
    startFreshPlayback,
    onSelectionPlayConsumed,
    currentPage,
    provider,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === " " && e.ctrlKey) {
        e.preventDefault();
        if (isPlaying) {
          handlePause();
        } else {
          handlePlay();
        }
      } else if (
        e.key === "Escape" &&
        (showSettings || suppressEscapeStopRef.current)
      ) {
        e.preventDefault();
        if (showSettings) closeNarrationCockpit(true);
      } else if (
        e.key === "Escape" &&
        (isPlaying || isPaused || continuationPending)
      ) {
        e.preventDefault();
        handleStop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isPlaying,
    isPaused,
    continuationPending,
    showSettings,
    closeNarrationCockpit,
    handlePlay,
    handlePause,
    handleStop,
  ]);

  // Show settings if API key is needed
  if (needsApiKey) {
    return (
      <div className="ai-playback-bar ai-playback-bar-setup">
        {showSettings && (
          <NarrationCockpit onClose={closeNarrationCockpit} controlsDisabled />
        )}
        <div className="ai-playback-setup-message">
          <svg
            viewBox="0 0 24 24"
            className="ai-playback-icon"
            width="20"
            height="20"
          >
            <path
              d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"
              fill="currentColor"
            />
            <path
              d="M19 10v2a7 7 0 0 1-14 0v-2"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="12"
              y1="19"
              x2="12"
              y2="22"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <span>{AI_TTS_SETUP_MESSAGE}</span>
          <button
            ref={settingsButtonRef}
            className="ai-playback-setup-btn"
            onClick={() => setShowSettings(true)}
            aria-expanded={showSettings}
            aria-controls="narration-cockpit"
          >
            Configure
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-playback-bar">
      {showSettings && (
        <NarrationCockpit
          onClose={closeNarrationCockpit}
          controlsDisabled={
            isPlaying || isPaused || isLoading || Boolean(switchingProvider)
          }
        />
      )}

      <div className="ai-playback-controls">
        {isPlaying ? (
          <button
            className="ai-playback-button"
            onClick={handlePause}
            title="Pause (Ctrl+Space)"
          >
            <svg viewBox="0 0 24 24" className="ai-playback-icon">
              <rect x="6" y="4" width="4" height="16" fill="currentColor" />
              <rect x="14" y="4" width="4" height="16" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button
            className="ai-playback-button"
            onClick={handlePlay}
            disabled={!canPlay || isLoading}
            title={isPaused ? "Resume (Ctrl+Space)" : "Play (Ctrl+Space)"}
          >
            {isLoading ? (
              <svg
                viewBox="0 0 24 24"
                className="ai-playback-icon ai-playback-loading"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="31.4"
                  strokeDashoffset="10"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ai-playback-icon">
                <polygon points="5,3 19,12 5,21" fill="currentColor" />
              </svg>
            )}
          </button>
        )}

        <button
          className="ai-playback-button"
          onClick={handleStop}
          disabled={
            !isHighlightActive &&
            playbackState === "idle" &&
            !continuationPending
          }
          title="Stop (Esc)"
        >
          <svg viewBox="0 0 24 24" className="ai-playback-icon">
            <rect x="4" y="4" width="16" height="16" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Word progress indicator */}
      {(isHighlightActive || wordTimings.length > 0) && (
        <div className="ai-playback-progress">
          <div
            className="ai-playback-progress-bar"
            style={{
              width:
                progressTotal > 0
                  ? (progressCurrent / progressTotal) * 100 + "%"
                  : "0%",
            }}
          />
          <span className="ai-playback-progress-text">
            {progressCurrent} / {progressTotal} (Page {currentPage}/{totalPages}
            )
          </span>
        </div>
      )}

      {/* Audio cache coverage indicator (T050) */}
      {documentId && !isHighlightActive && wordTimings.length === 0 && (
        <AudioCacheProgress documentId={documentId} variant="compact" />
      )}

      <div className="ai-playback-settings-section">
        {connectedProviders.length > 1 && (
          <select
            className="ai-playback-provider-select"
            aria-label="Narration connection"
            value={provider}
            disabled={Boolean(switchingProvider)}
            onChange={(event) => {
              void switchProvider(event.target.value as typeof provider);
            }}
          >
            {connectedProviders.map((connectedProvider) => (
              <option key={connectedProvider} value={connectedProvider}>
                {connectedProvider === "local"
                  ? "Local TTS"
                  : connectedProvider === "groq"
                    ? "Groq"
                    : "ElevenLabs"}
              </option>
            ))}
          </select>
        )}
        <AiVoiceSelector disabled={isPlaying || Boolean(switchingProvider)} />
        <AiSpeedSlider disabled={isPlaying || isPaused || isLoading} />

        {/* Export audiobook button (T090) */}
        <button
          className="ai-playback-button ai-playback-button-export"
          onClick={() => setShowExportDialog(true)}
          disabled={!documentId}
          title="Export Audiobook"
        >
          <svg viewBox="0 0 24 24" className="ai-playback-icon">
            <path
              d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <polyline
              points="7 10 12 15 17 10"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="12"
              y1="15"
              x2="12"
              y2="3"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </button>

        <button
          ref={settingsButtonRef}
          className="ai-playback-button ai-playback-button-settings"
          onClick={() =>
            showSettings ? closeNarrationCockpit() : setShowSettings(true)
          }
          title="Narration settings"
          aria-label="Narration settings"
          aria-expanded={showSettings}
          aria-controls="narration-cockpit"
        >
          <svg viewBox="0 0 24 24" className="ai-playback-icon">
            <path
              d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <circle cx="16" cy="6" r="2" fill="currentColor" />
            <circle cx="8" cy="12" r="2" fill="currentColor" />
            <circle cx="13" cy="18" r="2" fill="currentColor" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="ai-playback-error">
          <span>{error}</span>
          <button onClick={clearError} title="Dismiss error and try again">
            Dismiss
          </button>
          <button
            onClick={() => setShowSettings(true)}
            title="Open settings to fix configuration"
          >
            Settings
          </button>
        </div>
      )}

      {/* Audio export dialog (T090) */}
      {showExportDialog && documentId && currentDocument && (
        <AudioExportDialog
          documentId={documentId}
          documentTitle={currentDocument.title || "Untitled"}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}
