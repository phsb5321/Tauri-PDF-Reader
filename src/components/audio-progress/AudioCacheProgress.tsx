/**
 * AudioCacheProgress Component (T048)
 *
 * Displays audio cache coverage for a document with real-time updates.
 * Integrates with useAudioCache hook for data fetching and event subscription.
 */

import { useAudioCache } from "../../hooks/useAudioCache";
import { CacheProgressBar } from "./CacheProgressBar";
import "./AudioCacheProgress.css";

export interface AudioCacheProgressProps {
  /** Document ID to show coverage for */
  documentId: string;
  /** Show detailed chunk counts */
  showDetails?: boolean;
  /** Visual variant */
  variant?: "default" | "compact";
  /** Additional CSS class */
  className?: string;
}

export function AudioCacheProgress({
  documentId,
  showDetails = false,
  variant = "default",
  className = "",
}: AudioCacheProgressProps) {
  const { coverage, coveragePercent, isLoading } = useAudioCache(documentId);

  const classNames = [
    "audio-cache-progress",
    variant === "compact" && "audio-cache-progress--compact",
    isLoading && "audio-cache-progress--loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Loading state
  if (isLoading && !coverage) {
    return (
      <div className={classNames} data-testid="audio-cache-progress">
        <span className="audio-cache-progress__loading">Loading cache...</span>
      </div>
    );
  }

  return (
    <div className={classNames} data-testid="audio-cache-progress">
      <CacheProgressBar
        coveragePercent={coveragePercent}
        showLabel
        variant={variant}
      />
      {showDetails && coverage && (
        <span className="audio-cache-progress__details">
          {coverage.cachedChunks} / {coverage.totalChunks} chunks
        </span>
      )}
    </div>
  );
}
