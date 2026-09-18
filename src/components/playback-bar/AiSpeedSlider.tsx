import { useCallback } from "react";
import { useAiTts } from "../../hooks/useAiTts";
import "./AiSpeedSlider.css";

interface AiSpeedSliderProps {
  disabled?: boolean;
}

const MIN_SPEED = 0.5;
// Pitch-preserving range (spec 039): up to 4.5× without the chipmunk effect.
const MAX_SPEED = 4.5;
// Quarter-step lattice (spec 259 correction): every labeled preset —
// including 1.25 and 1.75 — is exactly reachable, so stored values are
// never sanitized away by thumb snapping.
const STEP = 0.05;

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

/** Exact multiplier for the live value: lattice values use their labels,
 * off-lattice values keep up to two decimals (no silent rounding). */
function formatSpeed(speed: number): string {
  const labeled = SPEED_LABELS[Number(speed.toFixed(2))];
  if (labeled) return labeled;
  const exact = Number(speed.toFixed(2));
  return `${exact}x`;
}

export function AiSpeedSlider({ disabled = false }: AiSpeedSliderProps) {
  const { speed, setSpeed, initialized } = useAiTts();

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newSpeed = parseFloat(e.target.value);
      // setSpeed catches/logs transport failures and resolves — the slider
      // reflects the store value it carries; no backend success is claimed.
      await setSpeed(newSpeed);
    },
    [setSpeed],
  );

  const unavailable = initialized ? disabled : true;
  // Honest reason precedence (spec 259): provider state first — a locked
  // parent must never be described as "narration playing" when the
  // provider is not even initialized.
  const disabledReason = !initialized
    ? "Connect an AI provider to adjust the narration speed."
    : "Speed can't change while a clip is active or loading. Stop narration, then adjust speed.";
  const hintId = "ai-speed-slider-hint";

  // Own keyboard handler: quarter-lattice steps are DETERMINISTIC and
  // testable — a stored 1.2 steps to exactly 1.25 (a labeled preset), and
  // off-lattice stored values step onto the lattice truthfully.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (unavailable) return;
      const clamp = (v: number) =>
        Math.min(MAX_SPEED, Math.max(MIN_SPEED, v));
      const apply = (v: number) => {
        if (v !== speed) void setSpeed(v);
      };
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          e.preventDefault();
          apply(clamp(Math.round((speed + STEP) * 100) / 100));
          break;
        case "ArrowLeft":
        case "ArrowDown":
          e.preventDefault();
          apply(clamp(Math.round((speed - STEP) * 100) / 100));
          break;
        case "Home":
          e.preventDefault();
          apply(MIN_SPEED);
          break;
        case "End":
          e.preventDefault();
          apply(MAX_SPEED);
          break;
        default:
          break;
      }
    },
    [unavailable, speed, setSpeed],
  );
  const valueText = `${speed}× playback speed`;

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
        onKeyDown={handleKeyDown}
        disabled={unavailable}
        aria-valuetext={valueText}
        aria-describedby={unavailable ? hintId : undefined}
      />
      <span
        className={
          unavailable
            ? "ai-speed-slider-value ai-speed-slider-value--disabled"
            : "ai-speed-slider-value"
        }
        aria-hidden="true"
      >
        {formatSpeed(speed)}
      </span>
      {unavailable && (
        <span id={hintId} className="ai-speed-slider-hint" role="note">
          {disabledReason}
        </span>
      )}
    </div>
  );
}
