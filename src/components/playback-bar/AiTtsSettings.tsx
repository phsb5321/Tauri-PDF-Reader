import { useState, useCallback, useEffect, useRef } from "react";
import { useAiTts } from "../../hooks/useAiTts";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import {
  aiTtsCacheInfo,
  aiTtsCacheClear,
  type AiTtsCacheInfo,
} from "../../lib/api/ai-tts";
import "./AiTtsSettings.css";

interface AiTtsSettingsProps {
  onClose?: () => void;
}

/** Format bytes to human-readable string */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getSubmitLabel(isSubmitting: boolean, initialized: boolean): string {
  if (isSubmitting) return "Connecting...";
  if (initialized) return "Update";
  return "Connect";
}

function ConnectionStatus({
  initialized,
  needsApiKey,
}: Readonly<{
  initialized: boolean;
  needsApiKey?: boolean;
}>) {
  if (initialized) return <span className="ai-tts-status-ok">Connected</span>;
  if (needsApiKey)
    return <span className="ai-tts-status-warning">API key required</span>;
  return <span className="ai-tts-status-pending">Not initialized</span>;
}

function SettingsError({
  error,
  initError,
}: Readonly<{ error?: string | null; initError?: string | null }>) {
  if (!(error || initError)) return null;
  return <div className="ai-tts-settings-error">{error ?? initError}</div>;
}

function LocalTtsPanel({
  initialized,
  localUrl,
  supportsWordTimings,
  error,
  initError,
  onRetry,
}: Readonly<{
  initialized: boolean;
  localUrl?: string | null;
  supportsWordTimings: boolean;
  error?: string | null;
  initError?: string | null;
  onRetry: () => void;
}>) {
  return (
    <div className="ai-tts-settings-form" aria-label="Local TTS status">
      <div className="ai-tts-settings-field">
        <h3>Local TTS</h3>
        <p className="ai-tts-settings-hint">
          PDF-derived text is sent to this configured destination and not to
          ElevenLabs.
        </p>
        <code>{localUrl}</code>
        {!supportsWordTimings && (
          <p className="ai-tts-settings-hint">
            Word highlighting is unavailable for this voice service; playback
            remains audio-only.
          </p>
        )}
        <SettingsError error={error} initError={initError} />
        <div className="ai-tts-settings-status">
          {initialized ? (
            <span className="ai-tts-status-ok">Connected</span>
          ) : (
            <span className="ai-tts-status-warning">Not connected</span>
          )}
        </div>
        {!initialized && (
          <button
            type="button"
            className="ai-tts-settings-btn primary"
            onClick={onRetry}
          >
            Retry local connection
          </button>
        )}
      </div>
    </div>
  );
}

function ApiKeyVisibilityIcon({ showKey }: Readonly<{ showKey: boolean }>) {
  if (showKey) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path
          d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <line
          x1="1"
          y1="1"
          x2="23"
          y2="23"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

interface ElevenLabsFormProps {
  inputKey: string;
  setInputKey: (value: string) => void;
  showKey: boolean;
  setShowKey: (value: boolean) => void;
  isSubmitting: boolean;
  initialized: boolean;
  needsApiKey?: boolean;
  error?: string | null;
  initError?: string | null;
  submitLabel: string;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
}

function ElevenLabsForm({
  inputKey,
  setInputKey,
  showKey,
  setShowKey,
  isSubmitting,
  initialized,
  needsApiKey,
  error,
  initError,
  submitLabel,
  onSubmit,
  onClear,
}: Readonly<ElevenLabsFormProps>) {
  return (
    <form
      onSubmit={onSubmit}
      className="ai-tts-settings-form"
      aria-label="Connect ElevenLabs"
    >
      <div className="ai-tts-settings-field">
        <label htmlFor="api-key">ElevenLabs API Key</label>
        <div className="ai-tts-settings-input-wrapper">
          <input
            id="api-key"
            type={showKey ? "text" : "password"}
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="Enter your ElevenLabs API key"
            disabled={isSubmitting}
            autoComplete="off"
            aria-describedby="ai-tts-egress-disclosure"
          />
          <button
            type="button"
            className="ai-tts-settings-toggle-visibility"
            onClick={() => setShowKey(!showKey)}
            title={showKey ? "Hide" : "Show"}
            aria-label="API key visibility"
            aria-pressed={showKey}
          >
            <ApiKeyVisibilityIcon showKey={showKey} />
          </button>
        </div>
        <p className="ai-tts-settings-hint">
          Get your API key from{" "}
          <a
            href="https://elevenlabs.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            elevenlabs.io
          </a>
        </p>
        <p id="ai-tts-egress-disclosure" className="ai-tts-settings-hint">
          Requested PDF-derived text leaves this device and is sent to
          ElevenLabs for speech generation.
        </p>
      </div>

      <SettingsError error={error} initError={initError} />

      <div className="ai-tts-settings-status">
        <ConnectionStatus initialized={initialized} needsApiKey={needsApiKey} />
      </div>

      <div className="ai-tts-settings-actions">
        <button
          type="button"
          className="ai-tts-settings-btn secondary"
          onClick={onClear}
          disabled={isSubmitting || !inputKey}
        >
          Clear API key field
        </button>
        <button
          type="submit"
          className="ai-tts-settings-btn primary"
          disabled={isSubmitting || !inputKey.trim()}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function CacheStats({
  cacheInfo,
}: Readonly<{ cacheInfo: AiTtsCacheInfo | null }>) {
  if (!cacheInfo) return null;
  return (
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
  );
}

export function AiTtsSettings({ onClose }: Readonly<AiTtsSettingsProps>) {
  const {
    initialized,
    apiKey,
    needsApiKey,
    initialize,
    initializeLocal,
    error,
    initError,
    provider,
    localUrl,
    supportsWordTimings,
  } = useAiTts();
  const [inputKey, setInputKey] = useState(apiKey || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<AiTtsCacheInfo | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const submittingRef = useRef(false);
  const submitLabel = getSubmitLabel(isSubmitting, initialized);

  // Load cache info on mount and after clearing
  const loadCacheInfo = useCallback(async () => {
    try {
      const info = await aiTtsCacheInfo();
      setCacheInfo(info);
    } catch (err) {
      console.error("Failed to load cache info:", err);
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
      console.error("Failed to clear cache:", err);
    } finally {
      setIsClearingCache(false);
    }
  }, [loadCacheInfo]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submittingRef.current || !inputKey.trim()) return;

      submittingRef.current = true;
      setIsSubmitting(true);
      try {
        await initialize(inputKey.trim());
        // Slice 109 B2: a wrong key must not close the dialog as if it
        // succeeded — the user is still looking at the form where the error
        // now shows. Close only on actual success.
        if (useAiTtsStore.getState().initialized) onClose?.();
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [inputKey, initialize, onClose],
  );

  const handleClear = useCallback(() => {
    setInputKey("");
  }, []);

  const handleRetryLocal = useCallback(() => {
    void initializeLocal();
  }, [initializeLocal]);

  return (
    <div className="ai-tts-settings">
      <div className="ai-tts-settings-header">
        <h2>AI TTS Settings</h2>
        {onClose && (
          <button
            className="ai-tts-settings-close"
            onClick={onClose}
            title="Close"
            aria-label="Close AI TTS settings"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {provider === "local" ? (
        <LocalTtsPanel
          initialized={initialized}
          localUrl={localUrl}
          supportsWordTimings={supportsWordTimings}
          error={error}
          initError={initError}
          onRetry={handleRetryLocal}
        />
      ) : (
        <ElevenLabsForm
          inputKey={inputKey}
          setInputKey={setInputKey}
          showKey={showKey}
          setShowKey={setShowKey}
          isSubmitting={isSubmitting}
          initialized={initialized}
          needsApiKey={needsApiKey}
          error={error}
          initError={initError}
          submitLabel={submitLabel}
          onSubmit={handleSubmit}
          onClear={handleClear}
        />
      )}

      {/* Audio Cache Section */}
      <div className="ai-tts-settings-section">
        <h3>Audio Cache</h3>
        <p className="ai-tts-settings-hint">
          Generated audio is cached locally for instant playback.
        </p>
        <CacheStats cacheInfo={cacheInfo} />
        <button
          type="button"
          className="ai-tts-settings-btn secondary"
          onClick={handleClearCache}
          disabled={isClearingCache || !cacheInfo?.entryCount}
          title="Delete all cached audio files"
        >
          {isClearingCache ? "Clearing..." : "Clear Cache"}
        </button>
      </div>
    </div>
  );
}
