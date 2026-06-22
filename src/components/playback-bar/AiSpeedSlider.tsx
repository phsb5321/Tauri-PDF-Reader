import { useCallback } from "react";
import { useAiTts } from "../../hooks/useAiTts";
import "./AiSpeedSlider.css";

interface AiSpeedSliderProps {
  disabled?: boolean;
}

const MIN_SPEED = 0.5;
// Pitch-preserving range (spec 039): up to 4.5× without the chipmunk effect.
const MAX_SPEED = 4.5;
const STEP = 0.1;

const SPEED_LABELS: Record<number, string> = {
  0.5: "0.5x",
  0.75: "0.75x",
  1.0: "1x",
  1.25: "1.25x",
  1.5: "1.5x",
  1.75: "1.75x",
  2.0: "2x",
  2.5: "2.5x",
  3.0: "3x",
  3.5: "3.5x",
  4.0: "4x",
  4.5: "4.5x",
};

export function AiSpeedSlider({ disabled = false }: AiSpeedSliderProps) {
  const { speed, setSpeed, initialized } = useAiTts();

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newSpeed = parseFloat(e.target.value);
      await setSpeed(newSpeed);
    },
    [setSpeed],
  );

  const displaySpeed = SPEED_LABELS[speed] || `${speed.toFixed(1)}x`;

  return (
    <div className="ai-speed-slider">
      <label className="ai-speed-slider-label" htmlFor="ai-speed-range">
        Speed
      </label>
      <input
        type="range"
        id="ai-speed-range"
        className="ai-speed-slider-input"
        min={MIN_SPEED}
        max={MAX_SPEED}
        step={STEP}
        value={speed}
        onChange={handleChange}
        disabled={disabled || !initialized}
      />
      <span className="ai-speed-slider-value">{displaySpeed}</span>
    </div>
  );
}
