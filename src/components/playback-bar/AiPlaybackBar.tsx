import { useCallback, useEffect, useState, useRef } from 'react';
import { useAiTts } from '../../hooks/useAiTts';
import { useTtsWordHighlight } from '../../hooks/useTtsWordHighlight';
import { useDocumentStore } from '../../stores/document-store';
import { useAiTtsStore } from '../../stores/ai-tts-store';
import { pdfService } from '../../services/pdf-service';
import { AiVoiceSelector } from './AiVoiceSelector';
import { AiSpeedSlider } from './AiSpeedSlider';
import { AiTtsSettings } from './AiTtsSettings';
import './AiPlaybackBar.css';

interface AiPlaybackBarProps {
  getText: () => Promise<string | null>;
  enableHighlighting?: boolean;
}

export function AiPlaybackBar({ getText, enableHighlighting = true }: AiPlaybackBarProps) {
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
  } = useAiTts();

  const { pdfDocument, currentPage, totalPages, setCurrentPage } = useDocumentStore();
  const [showSettings, setShowSettings] = useState(false);
  // T033: Use store for autoPageEnabled (persisted setting)
  const autoPageEnabled = useAiTtsStore((s) => s.autoPageEnabled);
  const setAutoPageEnabled = useAiTtsStore((s) => s.setAutoPageEnabled);
  const playingRef = useRef(false);
  // Refs to avoid stale closure in handlePlaybackComplete (T029, T035)
  const currentPageRef = useRef(currentPage);
  const totalPagesRef = useRef(totalPages);

  // Keep refs in sync with current values
  useEffect(() => {
    currentPageRef.current = currentPage;
    totalPagesRef.current = totalPages;
  }, [currentPage, totalPages]);

  // Get text for a specific page
  const getPageText = useCallback(async (pageNum: number): Promise<string | null> => {
    if (!pdfDocument) return null;
    try {
      const page = await pdfService.getPage(pdfDocument, pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text || null;
    } catch (err) {
      console.error('Error extracting text for page', pageNum, err);
      return null;
    }
  }, [pdfDocument]);

  /**
   * Scroll to make the current TTS word visible (T036)
   *
   * Finds the word highlight element and scrolls the PDF viewer to show it
   * when it's near the edge of the viewport.
   */
  const scrollToWord = useCallback((_wordIndex: number, _word: string) => {
    // Find the word highlight element
    const highlight = document.querySelector('.tts-word-highlight');
    if (!highlight) return;

    const rect = highlight.getBoundingClientRect();
    const container = document.querySelector('.pdf-viewer');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const margin = 100; // Pixels from edge to trigger scroll

    // Check if word is near bottom edge
    if (rect.bottom > containerRect.bottom - margin) {
      highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Check if word is near top edge
    else if (rect.top < containerRect.top + margin) {
      highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Handle multi-page continuation
  // Uses refs to avoid stale closure (T029)
  const handlePlaybackComplete = useCallback(async () => {
    console.debug('[AiPlaybackBar] Playback complete, checking for next page');

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
      console.debug('[AiPlaybackBar] Moving to next page:', nextPage);

      // Navigate to next page
      setCurrentPage(nextPage);

      // Small delay to let page render, then continue TTS
      setTimeout(async () => {
        if (playingRef.current) {
          const nextText = await getPageText(nextPage);
          if (nextText && playingRef.current) {
            await speakWithHighlight(nextText, nextPage);
          } else {
            playingRef.current = false;
          }
        }
      }, 500);
    } else {
      console.debug('[AiPlaybackBar] Reached last page, stopping');
      playingRef.current = false;
    }
  }, [autoPageEnabled, setCurrentPage, getPageText]);

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
    onComplete: handlePlaybackComplete,
    onWordChange: useCallback((wordIndex: number, word: string) => {
      console.debug('[AiPlaybackBar] Word changed:', wordIndex, word);
    }, []),
    // Wire up scroll callback to keep current word visible (T037)
    onScrollNeeded: scrollToWord,
  });

  // Derived state - use highlight state as primary when highlighting is enabled
  const isPlaying = enableHighlighting ? (isHighlightActive && !isHighlightPaused) : playbackState === 'playing';
  const isPaused = enableHighlighting ? isHighlightPaused : playbackState === 'paused';
  const isLoading = playbackState === 'loading';
  const canPlay = initialized && !error;

  const handlePlay = useCallback(async () => {
    if (!canPlay) return;

    if (isPaused) {
      if (enableHighlighting) {
        await resumeHighlight();
      } else {
        await resume();
      }
    } else {
      playingRef.current = true;
      const text = await getText();
      if (text) {
        if (enableHighlighting) {
          await speakWithHighlight(text, currentPage);
        } else {
          await speak(text);
        }
      } else {
        playingRef.current = false;
      }
    }
  }, [canPlay, isPaused, getText, speak, resume, speakWithHighlight, resumeHighlight, enableHighlighting, currentPage]);

  const handlePause = useCallback(async () => {
    if (enableHighlighting) {
      await pauseHighlight();
    } else {
      await pause();
    }
  }, [pause, pauseHighlight, enableHighlighting]);

  const handleStop = useCallback(async () => {
    playingRef.current = false;
    if (enableHighlighting) {
      await stopHighlight();
    } else {
      await stop();
    }
  }, [stop, stopHighlight, enableHighlighting]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === ' ' && e.ctrlKey) {
        e.preventDefault();
        if (isPlaying) {
          handlePause();
        } else {
          handlePlay();
        }
      } else if (e.key === 'Escape' && (isPlaying || isPaused)) {
        e.preventDefault();
        handleStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isPaused, handlePlay, handlePause, handleStop]);

  // Show settings if API key is needed
  if (needsApiKey) {
    return (
      <div className="ai-playback-bar ai-playback-bar-setup">
        <div className="ai-playback-setup-message">
          <svg viewBox="0 0 24 24" className="ai-playback-icon" width="20" height="20">
            <path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" fill="currentColor" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span>AI TTS requires an ElevenLabs API key</span>
          <button
            className="ai-playback-setup-btn"
            onClick={() => setShowSettings(true)}
          >
            Configure
          </button>
        </div>
        {showSettings && (
          <div className="ai-playback-settings-overlay">
            <div className="ai-playback-settings-container">
              <AiTtsSettings onClose={() => setShowSettings(false)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ai-playback-bar">
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
            title={isPaused ? 'Resume (Ctrl+Space)' : 'Play (Ctrl+Space)'}
          >
            {isLoading ? (
              <svg viewBox="0 0 24 24" className="ai-playback-icon ai-playback-loading">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="31.4" strokeDashoffset="10" />
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
          disabled={!isHighlightActive && playbackState === 'idle'}
          title="Stop (Esc)"
        >
          <svg viewBox="0 0 24 24" className="ai-playback-icon">
            <rect x="4" y="4" width="16" height="16" fill="currentColor" />
          </svg>
        </button>

        {/* Auto-page toggle */}
        <button
          className={'ai-playback-button ai-playback-button-toggle ' + (autoPageEnabled ? 'active' : '')}
          onClick={() => setAutoPageEnabled(!autoPageEnabled)}
          title={autoPageEnabled ? 'Auto-page: ON' : 'Auto-page: OFF'}
        >
          <svg viewBox="0 0 24 24" className="ai-playback-icon">
            <path d="M13 5l7 7-7 7M5 5l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </button>
      </div>

      {/* Word progress indicator */}
      {(isHighlightActive || wordTimings.length > 0) && (
        <div className="ai-playback-progress">
          <div
            className="ai-playback-progress-bar"
            style={{
              width: wordTimings.length > 0 ? ((currentWordIndex + 1) / wordTimings.length) * 100 + '%' : '0%',
            }}
          />
          <span className="ai-playback-progress-text">
            {currentWordIndex + 1} / {wordTimings.length} (Page {currentPage}/{totalPages})
          </span>
        </div>
      )}

      <div className="ai-playback-settings-section">
        <AiVoiceSelector disabled={isPlaying} />
        <AiSpeedSlider disabled={false} />

        <button
          className="ai-playback-button ai-playback-button-settings"
          onClick={() => setShowSettings(!showSettings)}
          title="TTS Settings"
        >
          <svg viewBox="0 0 24 24" className="ai-playback-icon">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </button>
      </div>

      {showSettings && (
        <div className="ai-playback-settings-overlay">
          <div className="ai-playback-settings-container">
            <AiTtsSettings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {error && (
        <div className="ai-playback-error">
          <span>{error}</span>
          <button onClick={clearError} title="Dismiss error and try again">
            Dismiss
          </button>
          <button onClick={() => setShowSettings(true)} title="Open settings to fix configuration">
            Settings
          </button>
        </div>
      )}
    </div>
  );
}
