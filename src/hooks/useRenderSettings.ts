/**
 * useRenderSettings Hook
 *
 * Provides access to render settings with persistence via Tauri IPC.
 * Handles loading settings on mount and saving changes to the backend.
 */

import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  useRenderStore,
  selectRenderSettings,
  selectRenderStoreStatus,
} from '../stores/render-store';
import type { RenderSettings } from '../domain/rendering';
import { RenderSettingsSchema } from '../domain/rendering';

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
  const { isLoading, error, hasUnsavedChanges, pendingRestart } =
    useRenderStore(selectRenderStoreStatus);

  const setSettings = useRenderStore((state) => state.setSettings);
  const updateSettings = useRenderStore((state) => state.updateSettings);
  const resetSettings = useRenderStore((state) => state.resetSettings);
  const setLoading = useRenderStore((state) => state.setLoading);
  const setError = useRenderStore((state) => state.setError);
  const setHasUnsavedChanges = useRenderStore((state) => state.setHasUnsavedChanges);
  const setPendingRestart = useRenderStore((state) => state.setPendingRestart);

  // Track if initial load has been done
  const initialLoadDone = useRef(false);

  /**
   * Load settings from backend on mount
   */
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadSettings = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await invoke<RenderSettings>('get_render_settings');

        // Validate response with Zod
        const validated = RenderSettingsSchema.parse(response);
        setSettings(validated);
      } catch (err) {
        console.error('Failed to load render settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
        // Keep default settings on error
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [setSettings, setLoading, setError]);

  /**
   * Save current settings to backend
   */
  const saveSettings = useCallback(async (): Promise<boolean> => {
    if (!hasUnsavedChanges) return true;

    setLoading(true);
    setError(null);

    try {
      const response = await invoke<UpdateRenderSettingsResponse>('update_render_settings', {
        qualityMode: settings.qualityMode,
        maxMegapixels: settings.maxMegapixels,
        hwAccelerationEnabled: settings.hwAccelerationEnabled,
        debugOverlayEnabled: settings.debugOverlayEnabled,
      });

      if (response.success) {
        setSettings(response.settings);
        setHasUnsavedChanges(false);

        if (response.restartRequired) {
          setPendingRestart(true);
        }

        return true;
      } else {
        setError('Failed to save settings');
        return false;
      }
    } catch (err) {
      console.error('Failed to save render settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
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
    [updateSettings]
  );

  /**
   * Update and immediately save a setting
   */
  const updateAndSave = useCallback(
    async <K extends keyof RenderSettings>(
      key: K,
      value: RenderSettings[K]
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await invoke<UpdateRenderSettingsResponse>('update_render_settings', {
          [key]: value,
        });

        if (response.success) {
          setSettings(response.settings);

          if (response.restartRequired) {
            setPendingRestart(true);
          }

          return true;
        } else {
          setError('Failed to save setting');
          return false;
        }
      } catch (err) {
        console.error('Failed to update render setting:', err);
        setError(err instanceof Error ? err.message : 'Failed to update setting');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setSettings, setLoading, setError, setPendingRestart]
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
