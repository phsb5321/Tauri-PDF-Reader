import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settings-store';
import { ttsListVoices, ttsSetRate, ttsSetVoice } from '../../lib/tauri-invoke';
import type { VoiceInfo } from '../../lib/schemas';

export function TtsSettings() {
  const {
    ttsRate,
    ttsVoice,
    ttsFollowAlong,
    ttsAvailable,
    setTtsRate,
    setTtsVoice,
    setTtsFollowAlong
  } = useSettingsStore();

  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);

  useEffect(() => {
    async function loadVoices() {
      if (!ttsAvailable) return;
      setIsLoadingVoices(true);
      try {
        const result = await ttsListVoices();
        setVoices(result.voices);

        // Validate stored voice still exists
        if (ttsVoice && !result.voices.some((v) => v.id === ttsVoice)) {
          console.warn(`Stored voice "${ttsVoice}" no longer available, resetting to system default`);
          setTtsVoice(null);
        }
      } catch (err) {
        console.error('Failed to load voices:', err);
      } finally {
        setIsLoadingVoices(false);
      }
    }
    loadVoices();
  }, [ttsAvailable, ttsVoice, setTtsVoice]);

  const handleRateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value);
    setTtsRate(newRate);
    try {
      await ttsSetRate(newRate);
    } catch (err) {
      console.error('Failed to set TTS rate:', err);
    }
  };

  const handleVoiceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const voiceId = e.target.value || null;
    setTtsVoice(voiceId);
    if (voiceId) {
      try {
        await ttsSetVoice(voiceId);
      } catch (err) {
        console.error('Failed to set TTS voice:', err);
      }
    }
  };

  if (!ttsAvailable) {
    return (
      <div className="settings-section">
        <h3 className="settings-section-title">Text-to-Speech</h3>
        <p className="settings-section-description">
          Text-to-speech is not available on this system. Make sure you have a TTS engine installed.
        </p>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Text-to-Speech</h3>
      <p className="settings-section-description">
        Configure how the PDF content is read aloud.
      </p>

      <div className="setting-row">
        <div className="setting-info">
          <div className="setting-label">Voice</div>
          <div className="setting-description">
            Select the voice for text-to-speech playback
          </div>
        </div>
        <div className="setting-control">
          <select
            className="setting-select"
            value={ttsVoice || ''}
            onChange={handleVoiceChange}
            disabled={isLoadingVoices}
          >
            <option value="">System Default</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name} {voice.language && `(${voice.language})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <div className="setting-label">Speed</div>
          <div className="setting-description">
            Adjust the reading speed (0.5x - 3x)
          </div>
        </div>
        <div className="setting-control">
          <div className="setting-slider">
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={ttsRate}
              onChange={handleRateChange}
            />
            <span className="setting-slider-value">{ttsRate.toFixed(1)}x</span>
          </div>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <div className="setting-label">Follow Along</div>
          <div className="setting-description">
            Auto-scroll to follow the current reading position
          </div>
        </div>
        <div className="setting-control">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={ttsFollowAlong}
              onChange={(e) => setTtsFollowAlong(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>
    </div>
  );
}
