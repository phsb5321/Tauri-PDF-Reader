import { useCallback, useId, useMemo, useState } from 'react';
import { useAiTts } from '../../hooks/useAiTts';
import type { AiVoiceInfo } from '../../lib/api/ai-tts';
import './AiVoiceSelector.css';

interface AiVoiceSelectorProps {
  disabled?: boolean;
}

const PROVIDER_GROUP_LABELS: Record<AiVoiceInfo['provider'], string> = {
  elevenlabs: 'ElevenLabs',
  local: 'Local',
  groq: 'Groq',
};

/** Deterministic provider grouping in first-seen API order. */
function groupVoicesByProvider(voices: AiVoiceInfo[]): Array<[string, AiVoiceInfo[]]> {
  const groups = new Map<string, AiVoiceInfo[]>();
  for (const voice of voices) {
    const key = voice.provider;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(voice);
    } else {
      groups.set(key, [voice]);
    }
  }
  return Array.from(groups.entries());
}

function optionLabel(voice: AiVoiceInfo): string {
  const labels = voice.labels
    ? Object.values(voice.labels)
        .filter((value): value is string => Boolean(value))
        .join(', ')
    : '';
  return labels ? `${voice.name} (${labels})` : voice.name;
}

export function AiVoiceSelector({ disabled = false }: AiVoiceSelectorProps) {
  // useId: the selector mounts in BOTH AiPlaybackBar and NarrationCockpit —
  // a shared literal id produced duplicate DOM ids and broken label
  // association. Scoped test locators must query within each instance.
  const reactId = useId();
  const selectId = `ai-voice-select${reactId}`;
  const {
    voices,
    selectedVoiceId,
    setVoice,
    initialized,
    initError,
    error,
    connections,
  } = useAiTts();
  const [pendingVoiceId, setPendingVoiceId] = useState<string | null>(null);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const voiceId = e.target.value;
      // setVoice catches/logs internally and resolves void — its fulfillment
      // is NOT a success signal. The control keeps rendering store state, so
      // a failed switch simply leaves the previous (or empty) selection
      // visible; nothing here announces success or clears store errors.
      if (!voiceId) return;
      setPendingVoiceId(voiceId);
      try {
        await setVoice(voiceId);
      } finally {
        setPendingVoiceId(null);
      }
    },
    [setVoice]
  );

  const groups = useMemo(() => groupVoicesByProvider(voices), [voices]);

  // Actual-state precedence (p16): a real 'connecting' connection wins over
  // quiet/error so an uninitialized-but-connecting selector is visible; then
  // the store's own error text; only then the quiet/empty fallbacks. Loading
  // is tied to an actual connecting connection — never invented, never
  // perpetual.
  const connecting = Object.values(connections).some(
    (connection) => connection.status === 'connecting',
  );
  const errorMessage = initError ?? error;

  if (!initialized || voices.length === 0) {
    if (connecting) {
      return (
        <p role="status" className="ai-voice-selector-note is-loading">
          Loading voices…
        </p>
      );
    }
    if (errorMessage) {
      return (
        <p role="status" className="ai-voice-selector-note is-error">
          {errorMessage}
        </p>
      );
    }
    if (!initialized) return null;
    return (
      <p role="status" className="ai-voice-selector-note is-muted">
        No voices available
      </p>
    );
  }

  // Strict value binding: an unknown/null selectedVoiceId must show the
  // explicit placeholder, never the browser's first-option fallback (which
  // would fake a selection). A failed setVoice keeps the store value, so the
  // control truthfully keeps showing the previous selection.
  const hasKnownSelection = voices.some((voice) => voice.id === selectedVoiceId);
  const selectValue = hasKnownSelection ? (selectedVoiceId as string) : '';
  const busy = pendingVoiceId !== null;

  return (
    <div className="ai-voice-selector">
      <label className="ai-voice-selector-label" htmlFor={selectId}>
        Voice
      </label>
      <select
        id={selectId}
        className={`ai-voice-selector-select${busy ? ' is-pending' : ''}`}
        value={selectValue}
        onChange={handleChange}
        disabled={disabled || !initialized}
        aria-busy={busy}
        aria-invalid={Boolean(initError || error) || undefined}
        data-empty={!hasKnownSelection}
      >
        <option disabled value="">
          Select a voice…
        </option>
        {groups.length > 1
          ? groups.map(([providerKey, providerVoices]) => (
              <optgroup
                key={providerKey}
                label={PROVIDER_GROUP_LABELS[providerKey as AiVoiceInfo['provider']] ?? providerKey}
              >
                {providerVoices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {optionLabel(voice)}
                  </option>
                ))}
              </optgroup>
            ))
          : voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {optionLabel(voice)}
              </option>
            ))}
      </select>
      {/* Visible error text backs aria-invalid when voices are populated. */}
      {errorMessage ? (
        <p role="status" className="ai-voice-selector-note is-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
