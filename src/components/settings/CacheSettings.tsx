/**
 * CacheSettings Component (T091)
 *
 * Settings panel for managing TTS audio cache.
 * Allows viewing cache statistics, setting size limits, and clearing cache.
 */

import { useState, useEffect, useCallback } from "react";
import {
  audioCacheGetStats,
  audioCacheGetLimit,
  audioCacheSetLimit,
  audioCacheEvict,
  onCacheEvicted,
  type CacheStatsResponse,
} from "../../lib/api/audio-cache";
import "./CacheSettings.css";

export function CacheSettings() {
  const [stats, setStats] = useState<CacheStatsResponse | null>(null);
  const [limit, setLimit] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load cache stats and limit on mount
  const loadCacheInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsResult, limitResult] = await Promise.all([
        audioCacheGetStats(),
        audioCacheGetLimit(),
      ]);
      setStats(statsResult);
      setLimit(limitResult);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load cache info",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCacheInfo();
  }, [loadCacheInfo]);

  // Listen for eviction events (T092)
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    onCacheEvicted((event) => {
      setSuccessMessage(
        `Cache cleaned: ${event.evictedCount} entries removed (${formatBytes(event.bytesFreed)} freed)`,
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      // Refresh stats after eviction
      loadCacheInfo();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [loadCacheInfo]);

  // Format bytes to human-readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Convert bytes to MB for slider
  const bytesToMb = (bytes: number): number =>
    Math.round(bytes / (1024 * 1024));
  const mbToBytes = (mb: number): number => mb * 1024 * 1024;

  // Handle limit change
  const handleLimitChange = async (newLimitMb: number) => {
    const newLimitBytes = mbToBytes(newLimitMb);
    setLimit(newLimitBytes);

    try {
      await audioCacheSetLimit(newLimitBytes);
      setSuccessMessage("Cache limit updated");
      setTimeout(() => setSuccessMessage(null), 3000);
      // Reload stats in case eviction was triggered
      await loadCacheInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update limit");
    }
  };

  // Clear all cache
  const handleClearCache = async () => {
    if (!stats || stats.entryCount === 0) return;

    setIsClearing(true);
    setError(null);
    try {
      const result = await audioCacheEvict(0);
      setSuccessMessage(
        `Cleared ${result.evictedCount} entries (${formatBytes(result.bytesFreed)})`,
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadCacheInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear cache");
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="cache-settings">
        <h3 className="cache-settings__title">Audio Cache</h3>
        <div className="cache-settings__loading">Loading cache info...</div>
      </div>
    );
  }

  return (
    <div className="cache-settings">
      <h3 className="cache-settings__title">Audio Cache</h3>
      <p className="cache-settings__description">
        Manage cached TTS audio. Cached audio reduces API calls and enables
        offline playback.
      </p>

      {error && (
        <div className="cache-settings__error" role="alert">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="cache-settings__success" role="status">
          {successMessage}
        </div>
      )}

      {stats && (
        <div className="cache-settings__stats">
          <div className="cache-settings__stat">
            <span className="cache-settings__stat-label">Cache Size</span>
            <span className="cache-settings__stat-value">
              {formatBytes(stats.totalSizeBytes)} / {formatBytes(limit)}
            </span>
          </div>
          <div className="cache-settings__stat">
            <span className="cache-settings__stat-label">Cached Chunks</span>
            <span className="cache-settings__stat-value">
              {stats.entryCount}
            </span>
          </div>
          <div className="cache-settings__stat">
            <span className="cache-settings__stat-label">Documents</span>
            <span className="cache-settings__stat-value">
              {stats.documentCount}
            </span>
          </div>
        </div>
      )}

      {/* Progress bar showing cache usage */}
      {stats && limit > 0 && (
        <div className="cache-settings__usage">
          <div className="cache-settings__usage-bar">
            <div
              className="cache-settings__usage-fill"
              style={{
                width: `${Math.min(100, (stats.totalSizeBytes / limit) * 100)}%`,
              }}
            />
          </div>
          <span className="cache-settings__usage-text">
            {((stats.totalSizeBytes / limit) * 100).toFixed(0)}% used
          </span>
        </div>
      )}

      {/* Cache limit slider */}
      <div className="cache-settings__limit">
        <label htmlFor="cache-limit" className="cache-settings__label">
          Maximum Cache Size: {bytesToMb(limit)} MB
        </label>
        <input
          id="cache-limit"
          type="range"
          min={100}
          max={10000}
          step={100}
          value={bytesToMb(limit)}
          onChange={(e) => handleLimitChange(Number(e.target.value))}
          className="cache-settings__slider"
          aria-describedby="cache-limit-description"
        />
        <span id="cache-limit-description" className="cache-settings__hint">
          Older cached audio is automatically removed when limit is reached
        </span>
      </div>

      {/* Clear cache button */}
      <button
        className="cache-settings__clear-btn"
        onClick={handleClearCache}
        disabled={isClearing || !stats || stats.entryCount === 0}
        aria-describedby="clear-cache-warning"
      >
        {isClearing ? "Clearing..." : "Clear All Cache"}
      </button>
      <span id="clear-cache-warning" className="cache-settings__warning">
        This will remove all cached audio. You will need to regenerate TTS for
        documents.
      </span>
    </div>
  );
}
