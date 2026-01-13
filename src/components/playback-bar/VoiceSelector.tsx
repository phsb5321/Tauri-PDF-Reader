import { useCallback } from 'react';
import { ttsSetVoice } from '../../lib/tauri-invoke';
import type { VoiceInfo } from '../../lib/schemas';
import './VoiceSelector.css';

interface VoiceSelectorProps {
  voices: VoiceInfo[];
  currentVoice: VoiceInfo | null;
  onVoiceChange: (voice: VoiceInfo) => void;
  disabled?: boolean;
}

export function VoiceSelector({
  voices,
  currentVoice,
  onVoiceChange,
  disabled = false,
}: VoiceSelectorProps) {
  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const voiceId = e.target.value;
      const voice = voices.find((v) => v.id === voiceId);
      if (voice) {
        try {
          await ttsSetVoice(voiceId);
          onVoiceChange(voice);
        } catch (error) {
          console.error('Failed to set voice:', error);
        }
      }
    },
    [voices, onVoiceChange]
  );

  if (voices.length === 0) {
    return null;
  }

  return (
    <div className="voice-selector">
      <label className="voice-selector-label" htmlFor="voice-select">
        Voice
      </label>
      <select
        id="voice-select"
        className="voice-selector-select"
        value={currentVoice?.id || ''}
        onChange={handleChange}
        disabled={disabled}
      >
        {voices.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.name}
            {voice.language ? ` (${voice.language})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
