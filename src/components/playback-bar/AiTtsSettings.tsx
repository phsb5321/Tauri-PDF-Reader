import { useState, useCallback, useEffect } from 'react';
import { useAiTts } from '../../hooks/useAiTts';
import { aiTtsCacheInfo, aiTtsCacheClear, type AiTtsCacheInfo } from '../../lib/api/ai-tts';
import './AiTtsSettings.css';

interface AiTtsSettingsProps {
  onClose?: () => void;
}

/** Format bytes to human-readable string */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function AiTtsSettings({ onClose }: AiTtsSettingsProps) {
  const { initialized, apiKey, needsApiKey, initialize, error } = useAiTts();
  const [inputKey, setInputKey] = useState(apiKey || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<AiTtsCacheInfo | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Load cache info on mount and after clearing
  const loadCacheInfo = useCallback(async () => {
    try {
      const info = await aiTtsCacheInfo();
      setCacheInfo(info);
    } catch (err) {
      console.error('Failed to load cache info:', err);
    }
  }, []);

  useEffect(() => {
    loadCacheInfo();
  }, [loadCacheInfo]);

  const handleClearCache = useCallback(async () => {
    setIsClearingCache(true);
    try {
      await aiTtsCacheClear();
      await loadCacheInfo();
    } catch (err) {
      console.error('Failed to clear cache:', err);
    } finally {
      setIsClearingCache(false);
    }
  }, [loadCacheInfo]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputKey.trim()) return;

      setIsSubmitting(true);
      try {
        await initialize(inputKey.trim());
        onClose?.();
      } finally {
        setIsSubmitting(false);
      }
    },
    [inputKey, initialize, onClose]
  );

  const handleClear = useCallback(() => {
    setInputKey('');
  }, []);

  return (
    <div className="ai-tts-settings">
      <div className="ai-tts-settings-header">
        <h3>AI TTS Settings</h3>
        {onClose && (
          <button className="ai-tts-settings-close" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="ai-tts-settings-form">
        <div className="ai-tts-settings-field">
          <label htmlFor="api-key">ElevenLabs API Key</label>
          <div className="ai-tts-settings-input-wrapper">
            <input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Enter your ElevenLabs API key"
              disabled={isSubmitting}
              autoComplete="off"
            />
            <button
              type="button"
              className="ai-tts-settings-toggle-visibility"
              onClick={() => setShowKey(!showKey)}
              title={showKey ? 'Hide' : 'Show'}
            >
              {showKey ? (
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" fill="none" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              )}
            </button>
          </div>
          <p className="ai-tts-settings-hint">
            Get your API key from{' '}
            <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer">
              elevenlabs.io
            </a>
          </p>
        </div>

        {error && <div className="ai-tts-settings-error">{error}</div>}

        <div className="ai-tts-settings-status">
          {initialized ? (
            <span className="ai-tts-status-ok">Connected</span>
          ) : needsApiKey ? (
            <span className="ai-tts-status-warning">API key required</span>
          ) : (
            <span className="ai-tts-status-pending">Not initialized</span>
          )}
        </div>

        <div className="ai-tts-settings-actions">
          <button
            type="button"
            className="ai-tts-settings-btn secondary"
            onClick={handleClear}
            disabled={isSubmitting || !inputKey}
          >
            Clear
          </button>
          <button
            type="submit"
            className="ai-tts-settings-btn primary"
            disabled={isSubmitting || !inputKey.trim()}
          >
            {isSubmitting ? 'Connecting...' : initialized ? 'Update' : 'Connect'}
          </button>
        </div>
      </form>

      {/* Audio Cache Section */}
      <div className="ai-tts-settings-section">
        <h4>Audio Cache</h4>
        <p className="ai-tts-settings-hint">
          Generated audio is cached locally for instant playback.
        </p>
        {cacheInfo && (
          <div className="ai-tts-cache-info">
            <div className="ai-tts-cache-stat">
              <span>Cached files:</span>
              <strong>{cacheInfo.entryCount}</strong>
            </div>
            <div className="ai-tts-cache-stat">
              <span>Cache size:</span>
              <strong>{formatBytes(cacheInfo.totalSizeBytes)}</strong>
            </div>
          </div>
        )}
        <button
          type="button"
          className="ai-tts-settings-btn secondary"
          onClick={handleClearCache}
          disabled={isClearingCache || !cacheInfo?.entryCount}
          title="Delete all cached audio files"
        >
          {isClearingCache ? 'Clearing...' : 'Clear Cache'}
        </button>
      </div>
    </div>
  );
}
