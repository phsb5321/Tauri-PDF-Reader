/**
 * Render Settings Store
 *
 * Zustand store for managing render settings state.
 * Settings are persisted via Tauri IPC to SQLite.
 */

import { create } from 'zustand';
import type { RenderSettings, RenderPlan, DisplayInfo } from '../domain/rendering';
import { DEFAULT_RENDER_SETTINGS, PLATFORM_DEFAULTS } from '../domain/rendering';

/**
 * Detect current platform for default settings
 */
function detectPlatform(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('win')) return 'windows';
  if (userAgent.includes('mac')) return 'macos';
  if (userAgent.includes('linux')) return 'linux';
  return 'unknown';
}

/**
 * Get platform-aware default settings
 */
function getPlatformDefaultSettings(): RenderSettings {
  const platform = detectPlatform();
  const platformDefaults = PLATFORM_DEFAULTS[platform] ?? {};
  return {
    ...DEFAULT_RENDER_SETTINGS,
    ...platformDefaults,
  };
}

interface RenderStore {
  // Settings state
  settings: RenderSettings;
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  pendingRestart: boolean;

  // Current display info (updated from window)
  displayInfo: DisplayInfo;

  // Current render plan (calculated from settings + display + page)
  currentRenderPlan: RenderPlan | null;

  // Actions - Settings
  setSettings: (settings: RenderSettings) => void;
  updateSettings: (updates: Partial<RenderSettings>) => void;
  resetSettings: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  setPendingRestart: (pending: boolean) => void;

  // Actions - Display Info
  setDisplayInfo: (info: DisplayInfo) => void;
  updateDisplayInfo: (updates: Partial<DisplayInfo>) => void;

  // Actions - Render Plan
  setCurrentRenderPlan: (plan: RenderPlan | null) => void;
}

const initialDisplayInfo: DisplayInfo = {
  devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1200,
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
};

export const useRenderStore = create<RenderStore>((set, get) => ({
  // Initial state
  settings: getPlatformDefaultSettings(),
  isLoading: false,
  error: null,
  hasUnsavedChanges: false,
  pendingRestart: false,
  displayInfo: initialDisplayInfo,
  currentRenderPlan: null,

  // Settings actions
  setSettings: (settings) => {
    set({
      settings,
      hasUnsavedChanges: false,
      error: null,
    });
  },

  updateSettings: (updates) => {
    const { settings } = get();
    const newSettings = { ...settings, ...updates };

    // Check if HW acceleration changed (requires restart)
    const hwAccelChanged =
      updates.hwAccelerationEnabled !== undefined &&
      updates.hwAccelerationEnabled !== settings.hwAccelerationEnabled;

    set({
      settings: newSettings,
      hasUnsavedChanges: true,
      pendingRestart: hwAccelChanged ? true : get().pendingRestart,
    });
  },

  resetSettings: () => {
    set({
      settings: getPlatformDefaultSettings(),
      hasUnsavedChanges: true,
      pendingRestart: false,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setHasUnsavedChanges: (hasUnsavedChanges) => set({ hasUnsavedChanges }),

  setPendingRestart: (pendingRestart) => set({ pendingRestart }),

  // Display info actions
  setDisplayInfo: (displayInfo) => set({ displayInfo }),

  updateDisplayInfo: (updates) => {
    const { displayInfo } = get();
    set({ displayInfo: { ...displayInfo, ...updates } });
  },

  // Render plan actions
  setCurrentRenderPlan: (currentRenderPlan) => set({ currentRenderPlan }),
}));

/**
 * Selector for just the settings
 */
export const selectRenderSettings = (state: RenderStore) => state.settings;

/**
 * Selector for display info
 */
export const selectDisplayInfo = (state: RenderStore) => state.displayInfo;

/**
 * Selector for current render plan
 */
export const selectCurrentRenderPlan = (state: RenderStore) => state.currentRenderPlan;

/**
 * Selector for loading/error state
 */
export const selectRenderStoreStatus = (state: RenderStore) => ({
  isLoading: state.isLoading,
  error: state.error,
  hasUnsavedChanges: state.hasUnsavedChanges,
  pendingRestart: state.pendingRestart,
});
