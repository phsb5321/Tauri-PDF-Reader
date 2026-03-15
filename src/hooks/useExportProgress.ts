/**
 * useExportProgress Hook (T089)
 *
 * Subscribes to audio export progress events and manages export state.
 */

import { useState, useEffect, useCallback } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type {
  ExportProgress,
  ExportResult,
} from "../domain/export/export-result";

interface UseExportProgressOptions {
  onComplete?: (result: ExportResult) => void;
  onError?: (error: string) => void;
}

interface UseExportProgressReturn {
  progress: ExportProgress | null;
  isExporting: boolean;
  lastResult: ExportResult | null;
  error: string | null;
  reset: () => void;
}

/**
 * Hook for subscribing to audio export progress events
 */
export function useExportProgress(
  options: UseExportProgressOptions = {},
): UseExportProgressReturn {
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastResult, setLastResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { onComplete, onError } = options;

  // Reset state for new export
  const reset = useCallback(() => {
    setProgress(null);
    setIsExporting(false);
    setLastResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    // Listen for progress updates
    listen<ExportProgress>("audio-export:progress", (event) => {
      const progressData = event.payload;
      setProgress(progressData);
      setIsExporting(true);

      // Check for error phase
      if (progressData.phase === "error" && progressData.error) {
        setError(progressData.error);
        onError?.(progressData.error);
      }
    }).then((unlisten) => {
      unlisteners.push(unlisten);
    });

    // Listen for completion
    listen<ExportResult>("audio-export:complete", (event) => {
      const result = event.payload;
      setLastResult(result);
      setIsExporting(false);

      if (result.success) {
        setProgress({
          phase: "complete",
          currentChunk: result.chapterCount,
          totalChunks: result.chapterCount,
          percent: 100,
          estimatedRemainingMs: 0,
        });
        onComplete?.(result);
      } else {
        setError("Export failed");
        onError?.("Export failed");
      }
    }).then((unlisten) => {
      unlisteners.push(unlisten);
    });

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [onComplete, onError]);

  return {
    progress,
    isExporting,
    lastResult,
    error,
    reset,
  };
}
