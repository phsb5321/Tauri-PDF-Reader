/**
 * useRenderSettings Hook
 *
 * Provides access to render settings with persistence via Tauri IPC.
 * Handles loading settings on mount and saving changes to the backend.
 */

import { useCallback, useEffect } from "react";
// TODO: Migrate to type-safe bindings when render_settings commands are added to tauri-specta
// eslint-disable-next-line no-restricted-imports
import { invoke } from "@tauri-apps/api/core";
import { useRenderStore, selectRenderSettings } from "../stores/render-store";
import type { RenderSettings } from "../domain/rendering";
import { RenderSettingsSchema } from "../domain/rendering";

/**
 * Backend response for update render settings
 */
interface UpdateRenderSettingsResponse {
  success: boolean;
  restartRequired: boolean;
  settings: RenderSettings;
}

/**
 * Hook for managing render settings with persistence
 */
export function useRenderSettings() {
  const settings = useRenderStore(selectRenderSettings);
  const isLoading = useRenderStore((state) => state.isLoading);
  const settingsInitialized = useRenderStore(
    (state) => state.settingsInitialized,
  );
  const error = useRenderStore((state) => state.error);
  const hasUnsavedChanges = useRenderStore((state) => state.hasUnsavedChanges);
  const pendingRestart = useRenderStore((state) => state.pendingRestart);

  const setSettings = useRenderStore((state) => state.setSettings);
  const updateSettings = useRenderStore((state) => state.updateSettings);
  const resetSettings = useRenderStore((state) => state.resetSettings);
  const setLoading = useRenderStore((state) => state.setLoading);
  const setSettingsInitialized = useRenderStore(
    (state) => state.setSettingsInitialized,
  );
  const setError = useRenderStore((state) => state.setError);
  const setHasUnsavedChanges = useRenderStore(
    (state) => state.setHasUnsavedChanges,
  );
  const setPendingRestart = useRenderStore((state) => state.setPendingRestart);

  /**
   * Load settings once for the whole app. The live store guard matters because
   * App and the Rendering panel can mount separate hook instances in one tick.
   */
  useEffect(() => {
    if (settingsInitialized || isLoading) return;
    const live = useRenderStore.getState();
    if (live.settingsInitialized || live.isLoading) return;

    const loadSettings = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await invoke<RenderSettings>("get_render_settings");
        setSettings(RenderSettingsSchema.parse(response));
      } catch (err) {
        console.error("Failed to load render settings:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load settings",
        );
        // Keep the synchronous safe defaults on error.
      } finally {
        setSettingsInitialized(true);
        setLoading(false);
      }
    };

    void loadSettings();
  }, [
    isLoading,
    settingsInitialized,
    setSettings,
    setLoading,
    setSettingsInitialized,
    setError,
  ]);

  /**
   * Save current settings to backend
   */
  const saveSettings = useCallback(async (): Promise<boolean> => {
    if (!hasUnsavedChanges) return true;

    setLoading(true);
    setError(null);

    try {
      const response = await invoke<UpdateRenderSettingsResponse>(
        "update_render_settings",
        {
          qualityMode: settings.qualityMode,
          maxMegapixels: settings.maxMegapixels,
          hwAccelerationEnabled: settings.hwAccelerationEnabled,
          debugOverlayEnabled: settings.debugOverlayEnabled,
        },
      );

      if (response.success) {
        setSettings(response.settings);
        setHasUnsavedChanges(false);

        if (response.restartRequired) {
          setPendingRestart(true);
        }

        return true;
      } else {
        setError("Failed to save settings");
        return false;
      }
    } catch (err) {
      console.error("Failed to save render settings:", err);
      setError(err instanceof Error ? err.message : "Failed to save settings");
      return false;
    } finally {
      setLoading(false);
    }
  }, [
    settings,
    hasUnsavedChanges,
    setSettings,
    setLoading,
    setError,
    setHasUnsavedChanges,
    setPendingRestart,
  ]);

  /**
   * Update a single setting (local only, call saveSettings to persist)
   */
  const updateSetting = useCallback(
    <K extends keyof RenderSettings>(key: K, value: RenderSettings[K]) => {
      updateSettings({ [key]: value });
    },
    [updateSettings],
  );

  /**
   * Update and immediately save a setting
   */
  const updateAndSave = useCallback(
    async <K extends keyof RenderSettings>(
      key: K,
      value: RenderSettings[K],
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await invoke<UpdateRenderSettingsResponse>(
          "update_render_settings",
          {
            [key]: value,
          },
        );

        if (response.success) {
          setSettings(response.settings);

          if (response.restartRequired) {
            setPendingRestart(true);
          }

          return true;
        } else {
          setError("Failed to save setting");
          return false;
        }
      } catch (err) {
        console.error("Failed to update render setting:", err);
        setError(
          err instanceof Error ? err.message : "Failed to update setting",
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setSettings, setLoading, setError, setPendingRestart],
  );

  /**
   * Reset to default settings and save
   */
  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    resetSettings();
    return saveSettings();
  }, [resetSettings, saveSettings]);

  return {
    // State
    settings,
    isLoading,
    error,
    hasUnsavedChanges,
    pendingRestart,

    // Actions
    updateSetting,
    updateAndSave,
    saveSettings,
    resetToDefaults,
  };
}

export default useRenderSettings;
