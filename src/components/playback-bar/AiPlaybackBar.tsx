import { useCallback, useEffect, useState } from 'react';
import { useAiTts } from '../../hooks/useAiTts';
import { AiVoiceSelector } from './AiVoiceSelector';
import { AiSpeedSlider } from './AiSpeedSlider';
import { AiTtsSettings } from './AiTtsSettings';
import './AiPlaybackBar.css';

interface AiPlaybackBarProps {
  getText: () => Promise<string | null>;
}

export function AiPlaybackBar({ getText }: AiPlaybackBarProps) {
  const {
    initialized,
    playbackState,
    needsApiKey,
    error,
    speak,
    stop,
    pause,
    resume,
  } = useAiTts();

  const [showSettings, setShowSettings] = useState(false);

  const isPlaying = playbackState === 'playing';
  const isPaused = playbackState === 'paused';
  const isLoading = playbackState === 'loading';
  const canPlay = initialized && !error;

  const handlePlay = useCallback(async () => {
    if (!canPlay) return;

    if (isPaused) {
      await resume();
    } else {
      const text = await getText();
      if (text) {
        await speak(text);
      }
    }
  }, [canPlay, isPaused, getText, speak, resume]);

  const handlePause = useCallback(async () => {
    await pause();
  }, [pause]);

  const handleStop = useCallback(async () => {
    await stop();
  }, [stop]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
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
          disabled={playbackState === 'idle'}
          title="Stop (Esc)"
        >
          <svg viewBox="0 0 24 24" className="ai-playback-icon">
            <rect x="4" y="4" width="16" height="16" fill="currentColor" />
          </svg>
        </button>
      </div>

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
          <button onClick={() => setShowSettings(true)}>Fix</button>
        </div>
      )}
    </div>
  );
}
