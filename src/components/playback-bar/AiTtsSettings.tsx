import { useState, useCallback, useEffect, useRef } from "react";
import { useAiTts } from "../../hooks/useAiTts";
import {
  AI_TTS_PROVIDERS,
  useAiTtsStore,
  type AiTtsProvider,
} from "../../stores/ai-tts-store";
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
            This voice service publishes no native word marks. Lectrice shows an
            estimated read-along derived from the measured audio duration.
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

interface CloudProviderFormProps {
  providerId: "elevenlabs" | "groq";
  providerName: "ElevenLabs" | "Groq";
  providerUrl: string;
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

function CloudProviderForm({
  providerId,
  providerName,
  providerUrl,
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
}: Readonly<CloudProviderFormProps>) {
  const keyId = `${providerId}-api-key`;
  const disclosureId = `${providerId}-egress-disclosure`;
  return (
    <form
      onSubmit={onSubmit}
      className="ai-tts-settings-form"
      aria-label={`Connect ${providerName}`}
    >
      <div className="ai-tts-settings-field">
        <label htmlFor={keyId}>{providerName} API Key</label>
        <div className="ai-tts-settings-input-wrapper">
          <input
            id={keyId}
            type={showKey ? "text" : "password"}
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder={`Enter your ${providerName} API key`}
            disabled={isSubmitting}
            autoComplete="off"
            aria-describedby={disclosureId}
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
          <a href={providerUrl} target="_blank" rel="noopener noreferrer">
            {new URL(providerUrl).hostname}
          </a>
        </p>
        <p id={disclosureId} className="ai-tts-settings-hint">
          Requested PDF-derived text leaves this device and is sent to{" "}
          {providerName} for speech generation.
        </p>
        <p className="ai-tts-settings-hint">
          The key stays in memory for this app session and is never written to
          disk.
        </p>
        {providerId === "groq" && (
          <p className="ai-tts-settings-hint">
            Groq Orpheus accepts short WAV chunks and publishes no native word
            marks. Read-along timing is estimated from measured audio duration.
          </p>
        )}
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

const PROVIDER_NAMES: Record<AiTtsProvider, string> = {
  local: "Local TTS",
  elevenlabs: "ElevenLabs",
  groq: "Groq",
};

function connectionLabel(
  provider: AiTtsProvider,
  status: "setup" | "connecting" | "connected" | "error",
): string {
  if (status === "connecting") return "Connecting…";
  if (status === "connected") return "Connected";
  if (status === "error") return "Connection failed";
  return provider === "local" ? "Not connected" : "Key required";
}

export function AiTtsSettings({ onClose }: Readonly<AiTtsSettingsProps>) {
  const {
    initialized = false,
    initialize,
    initializeGroq = async () => undefined,
    initializeLocal = async () => undefined,
    switchProvider = async () => false,
    provider = useAiTtsStore.getState().provider,
    localUrl = useAiTtsStore.getState().localUrl,
    supportsWordTimings = provider !== "local",
    initError = null,
    error = null,
    connections: providedConnections,
    switchingProvider = null,
  } = useAiTts();
  const [selectedProvider, setSelectedProvider] =
    useState<AiTtsProvider>(provider);
  const [inputKey, setInputKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<AiTtsCacheInfo | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const submittingRef = useRef(false);
  const connections = providedConnections ?? {
    ...useAiTtsStore.getState().connections,
    [provider]: {
      ...useAiTtsStore.getState().connections[provider],
      status: initialized ? "connected" : initError ? "error" : "setup",
      error: error ?? initError,
      destination: provider === "local" ? localUrl : null,
      supportsWordTimings,
    },
  };
  const selectedConnection = connections[selectedProvider];
  const selectedConnected = selectedConnection.status === "connected";
  const submitLabel = getSubmitLabel(isSubmitting, selectedConnected);

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

  useEffect(() => {
    setInputKey("");
    setShowKey(false);
  }, [selectedProvider]);

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
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (
        submittingRef.current ||
        selectedProvider === "local" ||
        !inputKey.trim()
      ) {
        return;
      }

      submittingRef.current = true;
      setIsSubmitting(true);
      try {
        if (selectedProvider === "groq") {
          await initializeGroq(inputKey.trim());
        } else {
          await initialize(inputKey.trim());
        }
        if (
          useAiTtsStore.getState().connections[selectedProvider].status ===
          "connected"
        ) {
          setInputKey("");
          setShowKey(false);
        }
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [inputKey, initialize, initializeGroq, selectedProvider],
  );

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

      <section aria-labelledby="tts-connections-heading">
        <h3 id="tts-connections-heading">Connections</h3>
        <p className="ai-tts-settings-hint">
          Keep several services ready and choose which one narrates next.
        </p>
        <ul
          className="ai-tts-connections"
          aria-label="Text-to-speech connections"
        >
          {AI_TTS_PROVIDERS.map((connectionProvider) => {
            const connection = connections[connectionProvider];
            const active = provider === connectionProvider && initialized;
            return (
              <li
                key={connectionProvider}
                className="ai-tts-connection"
                data-status={connection.status}
                data-active={active || undefined}
              >
                <button
                  type="button"
                  className="ai-tts-connection-select"
                  aria-pressed={selectedProvider === connectionProvider}
                  onClick={() => setSelectedProvider(connectionProvider)}
                >
                  <span>{PROVIDER_NAMES[connectionProvider]}</span>
                  <span
                    className={
                      connection.status === "connected"
                        ? "ai-tts-status-ok"
                        : connection.status === "error"
                          ? "ai-tts-status-warning"
                          : "ai-tts-status-pending"
                    }
                  >
                    {connection.status === "connected" && connection.error
                      ? "Connected · last attempt failed"
                      : connectionLabel(connectionProvider, connection.status)}
                  </span>
                </button>
                {active ? (
                  <span className="ai-tts-connection-active">Active</span>
                ) : (
                  connection.status === "connected" && (
                    <button
                      type="button"
                      className="ai-tts-settings-btn secondary"
                      disabled={Boolean(switchingProvider)}
                      onClick={() => void switchProvider(connectionProvider)}
                    >
                      Use {PROVIDER_NAMES[connectionProvider]}
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="ai-tts-connection-detail">
        {selectedProvider === "local" ? (
          <LocalTtsPanel
            initialized={selectedConnected}
            localUrl={selectedConnection.destination ?? localUrl}
            supportsWordTimings={selectedConnection.supportsWordTimings}
            error={selectedConnection.error}
            initError={selectedConnection.error}
            onRetry={handleRetryLocal}
          />
        ) : (
          <CloudProviderForm
            providerId={selectedProvider}
            providerName={selectedProvider === "groq" ? "Groq" : "ElevenLabs"}
            providerUrl={
              selectedProvider === "groq"
                ? "https://console.groq.com/keys"
                : "https://elevenlabs.io/app/settings/api-keys"
            }
            inputKey={inputKey}
            setInputKey={setInputKey}
            showKey={showKey}
            setShowKey={setShowKey}
            isSubmitting={isSubmitting}
            initialized={selectedConnected}
            needsApiKey={!selectedConnected}
            error={selectedConnection.error}
            initError={selectedConnection.error}
            submitLabel={submitLabel}
            onSubmit={handleSubmit}
            onClear={() => setInputKey("")}
          />
        )}
      </div>

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
