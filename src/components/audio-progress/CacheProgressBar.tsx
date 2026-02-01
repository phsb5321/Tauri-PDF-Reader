/**
 * CacheProgressBar Component (T047)
 *
 * A visual progress bar showing audio cache coverage percentage.
 * Supports compact and default variants for different UI contexts.
 */

import "./CacheProgressBar.css";

export interface CacheProgressBarProps {
  /** Coverage percentage (0-100) */
  coveragePercent: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Visual variant */
  variant?: "default" | "compact";
  /** Additional CSS class */
  className?: string;
}

export function CacheProgressBar({
  coveragePercent,
  showLabel = false,
  variant = "default",
  className = "",
}: CacheProgressBarProps) {
  // Clamp percentage to valid range
  const clampedPercent = Math.max(0, Math.min(100, coveragePercent));
  const displayPercent = Math.round(clampedPercent);
  const isComplete = displayPercent === 100;

  const classNames = [
    "cache-progress-bar",
    variant === "compact" && "cache-progress-bar--compact",
    isComplete && "cache-progress-bar--complete",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classNames}
      role="progressbar"
      aria-valuenow={displayPercent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Audio cache coverage: ${displayPercent}%`}
    >
      <div className="cache-progress-bar__track">
        <div
          className="cache-progress-bar__fill"
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      {showLabel && (
        <span className="cache-progress-bar__label">{displayPercent}%</span>
      )}
    </div>
  );
}
