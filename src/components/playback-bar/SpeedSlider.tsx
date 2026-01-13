import { useCallback } from 'react';
import { ttsSetRate } from '../../lib/tauri-invoke';
import { useTtsStore } from '../../stores/tts-store';
import './SpeedSlider.css';

interface SpeedSliderProps {
  rate: number;
  disabled?: boolean;
}

const MIN_RATE = 0.5;
const MAX_RATE = 3.0;
const STEP = 0.25;

const RATE_LABELS: Record<number, string> = {
  0.5: '0.5x',
  0.75: '0.75x',
  1.0: '1x',
  1.25: '1.25x',
  1.5: '1.5x',
  1.75: '1.75x',
  2.0: '2x',
  2.5: '2.5x',
  3.0: '3x',
};

export function SpeedSlider({ rate, disabled = false }: SpeedSliderProps) {
  const { setRate } = useTtsStore();

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newRate = parseFloat(e.target.value);
      try {
        await ttsSetRate(newRate);
        setRate(newRate);
      } catch (error) {
        console.error('Failed to set rate:', error);
      }
    },
    [setRate]
  );

  const displayRate = RATE_LABELS[rate] || `${rate.toFixed(2)}x`;

  return (
    <div className="speed-slider">
      <label className="speed-slider-label" htmlFor="speed-range">
        Speed
      </label>
      <input
        type="range"
        id="speed-range"
        className="speed-slider-input"
        min={MIN_RATE}
        max={MAX_RATE}
        step={STEP}
        value={rate}
        onChange={handleChange}
        disabled={disabled}
      />
      <span className="speed-slider-value">{displayRate}</span>
    </div>
  );
}
