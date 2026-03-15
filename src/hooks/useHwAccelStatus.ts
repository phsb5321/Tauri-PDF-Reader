/**
 * useHwAccelStatus Hook
 *
 * Provides access to hardware acceleration status from the native backend.
 * This includes file-based flags that persist across app restarts.
 */

import { useCallback, useEffect, useState } from "react";
// TODO: Migrate to type-safe bindings when hw_accel commands are added to tauri-specta
// eslint-disable-next-line no-restricted-imports
import { invoke } from "@tauri-apps/api/core";

/**
 * Hardware acceleration status from backend
 */
export interface HwAccelStatus {
  hwAccelEnabled: boolean;
  safeModeActive: boolean;
  platformDefaultDisabled: boolean;
}

/**
 * Default status (assume enabled, no safe mode)
 */
const DEFAULT_STATUS: HwAccelStatus = {
  hwAccelEnabled: true,
  safeModeActive: false,
  platformDefaultDisabled: false,
};

/**
 * Hook for checking hardware acceleration status
 */
export function useHwAccelStatus() {
  const [status, setStatus] = useState<HwAccelStatus>(DEFAULT_STATUS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch status from backend
   */
  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await invoke<HwAccelStatus>("get_hw_accel_status");
      setStatus(response);
    } catch (err) {
      console.error("Failed to get HW accel status:", err);
      setError(err instanceof Error ? err.message : "Failed to get status");
      // Keep default on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear safe mode flag
   */
  const clearSafeMode = useCallback(async (): Promise<boolean> => {
    try {
      await invoke("clear_safe_mode");
      // Refresh status
      await fetchStatus();
      return true;
    } catch (err) {
      console.error("Failed to clear safe mode:", err);
      setError(
        err instanceof Error ? err.message : "Failed to clear safe mode",
      );
      return false;
    }
  }, [fetchStatus]);

  // Fetch on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    error,
    clearSafeMode,
    refetch: fetchStatus,
  };
}

export default useHwAccelStatus;
