import { useCallback } from 'react';
import { useAiTts } from '../../hooks/useAiTts';
import './AiVoiceSelector.css';

interface AiVoiceSelectorProps {
  disabled?: boolean;
}

export function AiVoiceSelector({ disabled = false }: AiVoiceSelectorProps) {
  const { voices, selectedVoiceId, setVoice, initialized } = useAiTts();

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const voiceId = e.target.value;
      if (voiceId) {
        await setVoice(voiceId);
      }
    },
    [setVoice]
  );

  if (!initialized || voices.length === 0) {
    return null;
  }

  // Group voices by category/label if available
  const selectedVoice = voices.find((v) => v.id === selectedVoiceId);

  return (
    <div className="ai-voice-selector">
      <label className="ai-voice-selector-label" htmlFor="ai-voice-select">
        Voice
      </label>
      <select
        id="ai-voice-select"
        className="ai-voice-selector-select"
        value={selectedVoiceId || ''}
        onChange={handleChange}
        disabled={disabled || !initialized}
        title={selectedVoice ? `${selectedVoice.name}` : 'Select a voice'}
      >
        {voices.map((voice) => {
          const labels = voice.labels
            ? Object.values(voice.labels).filter(Boolean).join(', ')
            : '';
          return (
            <option key={voice.id} value={voice.id}>
              {voice.name}
              {labels ? ` (${labels})` : ''}
            </option>
          );
        })}
      </select>
    </div>
  );
}
