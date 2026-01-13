import { useCallback, useEffect } from 'react';
import { useTtsStore, selectCanPlay, selectIsPlaying, selectIsPaused } from '../../stores/tts-store';
import { ttsInit, ttsSpeak, ttsStop, ttsPause, ttsResume, ttsListVoices } from '../../lib/tauri-invoke';
import { VoiceSelector } from './VoiceSelector';
import { SpeedSlider } from './SpeedSlider';
import { ChunkNavigation } from './ChunkNavigation';
import './PlaybackBar.css';

interface PlaybackBarProps {
  getText: () => Promise<string | null>;
}

export function PlaybackBar({ getText }: PlaybackBarProps) {
  const {
    initialized,
    available,
    playbackState,
    voices,
    currentVoice,
    rate,
    followAlong,
    setInitialized,
    setVoices,
    setCurrentVoice,
    setPlaybackState,
    setFollowAlong,
    reset,
  } = useTtsStore();

  const canPlay = useTtsStore(selectCanPlay);
  const isPlaying = useTtsStore(selectIsPlaying);
  const isPaused = useTtsStore(selectIsPaused);

  // Initialize TTS on mount
  useEffect(() => {
    const initTts = async () => {
      try {
        const response = await ttsInit();
        setInitialized(response);

        if (response.available) {
          const voicesResponse = await ttsListVoices();
          setVoices(voicesResponse.voices);

          // Set default voice
          if (voicesResponse.voices.length > 0 && !currentVoice) {
            const defaultVoice = response.defaultVoice
              ? voicesResponse.voices.find(v => v.id === response.defaultVoice)
              : voicesResponse.voices[0];
            if (defaultVoice) {
              setCurrentVoice(defaultVoice);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize TTS:', error);
      }
    };

    if (!initialized) {
      initTts();
    }
  }, [initialized, setInitialized, setVoices, setCurrentVoice, currentVoice]);

  const handlePlay = useCallback(async () => {
    if (!canPlay) return;

    try {
      if (isPaused) {
        await ttsResume();
        setPlaybackState('playing');
      } else {
        const text = await getText();
        if (!text) return;

        setPlaybackState('loading');
        await ttsSpeak(text, true);
        setPlaybackState('playing');
      }
    } catch (error) {
      console.error('TTS playback error:', error);
      setPlaybackState('idle');
    }
  }, [canPlay, isPaused, getText, setPlaybackState]);

  const handlePause = useCallback(async () => {
    try {
      await ttsPause();
      setPlaybackState('paused');
    } catch (error) {
      console.error('TTS pause error:', error);
    }
  }, [setPlaybackState]);

  const handleStop = useCallback(async () => {
    try {
      await ttsStop();
      setPlaybackState('idle');
      reset();
    } catch (error) {
      console.error('TTS stop error:', error);
    }
  }, [setPlaybackState, reset]);

  const handleToggleFollowAlong = useCallback(() => {
    setFollowAlong(!followAlong);
  }, [followAlong, setFollowAlong]);

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

  if (!available && initialized) {
    return (
      <div className="playback-bar playback-bar-unavailable">
        <span className="playback-unavailable-text">TTS not available</span>
      </div>
    );
  }

  return (
    <div className="playback-bar">
      <div className="playback-controls">
        {isPlaying ? (
          <button
            className="playback-button"
            onClick={handlePause}
            title="Pause (Ctrl+Space)"
          >
            <svg viewBox="0 0 24 24" className="playback-icon">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          </button>
        ) : (
          <button
            className="playback-button"
            onClick={handlePlay}
            disabled={!canPlay || playbackState === 'loading'}
            title={isPaused ? 'Resume (Ctrl+Space)' : 'Play (Ctrl+Space)'}
          >
            <svg viewBox="0 0 24 24" className="playback-icon">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </button>
        )}

        <button
          className="playback-button"
          onClick={handleStop}
          disabled={playbackState === 'idle'}
          title="Stop (Esc)"
        >
          <svg viewBox="0 0 24 24" className="playback-icon">
            <rect x="4" y="4" width="16" height="16" />
          </svg>
        </button>

        <ChunkNavigation disabled={!isPlaying && !isPaused} />
      </div>

      <div className="playback-settings">
        <button
          className={`playback-toggle ${followAlong ? 'active' : ''}`}
          onClick={handleToggleFollowAlong}
          title="Follow along while reading"
        >
          <svg viewBox="0 0 24 24" className="playback-icon">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        <VoiceSelector
          voices={voices}
          currentVoice={currentVoice}
          onVoiceChange={setCurrentVoice}
          disabled={isPlaying}
        />

        <SpeedSlider
          rate={rate}
          disabled={false}
        />
      </div>
    </div>
  );
}
