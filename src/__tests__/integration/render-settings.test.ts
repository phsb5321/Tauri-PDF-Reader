/**
 * Render Settings Integration Tests
 *
 * Tests for the render settings persistence round-trip.
 * These tests verify the store, hook, and Tauri IPC integration.
 *
 * Note: These tests mock Tauri IPC since they run in Vitest.
 * Full E2E tests with real backend are in the e2e/ directory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRenderStore } from '../../stores/render-store';
import { DEFAULT_RENDER_SETTINGS } from '../../domain/rendering';

describe('Render Settings Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useRenderStore.setState({
      settings: DEFAULT_RENDER_SETTINGS,
      isLoading: false,
      error: null,
      hasUnsavedChanges: false,
      pendingRestart: false,
      displayInfo: {
        devicePixelRatio: 2,
        viewportWidth: 1200,
        viewportHeight: 800,
      },
      currentRenderPlan: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useRenderStore', () => {
    it('initializes with default settings', () => {
      const { settings } = useRenderStore.getState();
      expect(settings.qualityMode).toBe('ultra');
      expect(settings.maxMegapixels).toBe(0); // 0 = no cap
    });

    it('updates settings locally', () => {
      const store = useRenderStore.getState();
      store.updateSettings({ qualityMode: 'ultra' });

      const updated = useRenderStore.getState();
      expect(updated.settings.qualityMode).toBe('ultra');
      expect(updated.hasUnsavedChanges).toBe(true);
    });

    it('tracks pending restart when HW acceleration changes', () => {
      const store = useRenderStore.getState();
      store.updateSettings({ hwAccelerationEnabled: false });

      const updated = useRenderStore.getState();
      expect(updated.settings.hwAccelerationEnabled).toBe(false);
      expect(updated.pendingRestart).toBe(true);
    });

    it('does not mark pending restart for other setting changes', () => {
      const store = useRenderStore.getState();
      store.updateSettings({ qualityMode: 'performance' });

      const updated = useRenderStore.getState();
      expect(updated.pendingRestart).toBe(false);
    });

    it('resets settings to defaults', () => {
      const store = useRenderStore.getState();
      store.updateSettings({
        qualityMode: 'ultra',
        maxMegapixels: 48,
        debugOverlayEnabled: true,
      });
      store.resetSettings();

      const reset = useRenderStore.getState();
      expect(reset.settings.qualityMode).toBe('ultra');
      expect(reset.settings.maxMegapixels).toBe(0); // 0 = no cap
      expect(reset.settings.debugOverlayEnabled).toBe(false);
      expect(reset.hasUnsavedChanges).toBe(true);
    });
  });

  describe('Display Info', () => {
    it('stores display info', () => {
      const store = useRenderStore.getState();
      store.setDisplayInfo({
        devicePixelRatio: 3,
        viewportWidth: 1920,
        viewportHeight: 1080,
      });

      const updated = useRenderStore.getState();
      expect(updated.displayInfo.devicePixelRatio).toBe(3);
      expect(updated.displayInfo.viewportWidth).toBe(1920);
    });

    it('updates display info partially', () => {
      const store = useRenderStore.getState();
      store.updateDisplayInfo({ devicePixelRatio: 2.5 });

      const updated = useRenderStore.getState();
      expect(updated.displayInfo.devicePixelRatio).toBe(2.5);
      expect(updated.displayInfo.viewportWidth).toBe(1200); // Unchanged
    });
  });

  describe('Render Plan', () => {
    it('stores current render plan', () => {
      const plan = {
        zoomLevel: 1.5,
        outputScale: 2,
        viewportWidth: 892.5,
        viewportHeight: 1263,
        canvasWidth: 1785,
        canvasHeight: 2526,
        megapixels: 4.51,
        memoryMB: 18.03,
        wasCapped: false,
      };

      const store = useRenderStore.getState();
      store.setCurrentRenderPlan(plan);

      const updated = useRenderStore.getState();
      expect(updated.currentRenderPlan).toEqual(plan);
    });

    it('clears current render plan', () => {
      const store = useRenderStore.getState();
      store.setCurrentRenderPlan({
        zoomLevel: 1,
        outputScale: 2,
        viewportWidth: 595,
        viewportHeight: 842,
        canvasWidth: 1190,
        canvasHeight: 1684,
        megapixels: 2,
        memoryMB: 8,
        wasCapped: false,
      });
      store.setCurrentRenderPlan(null);

      const updated = useRenderStore.getState();
      expect(updated.currentRenderPlan).toBeNull();
    });
  });

  describe('Loading and Error States', () => {
    it('tracks loading state', () => {
      const store = useRenderStore.getState();

      expect(store.isLoading).toBe(false);
      store.setLoading(true);
      expect(useRenderStore.getState().isLoading).toBe(true);
      store.setLoading(false);
      expect(useRenderStore.getState().isLoading).toBe(false);
    });

    it('tracks error state', () => {
      const store = useRenderStore.getState();

      expect(store.error).toBeNull();
      store.setError('Test error');
      expect(useRenderStore.getState().error).toBe('Test error');
      store.setError(null);
      expect(useRenderStore.getState().error).toBeNull();
    });
  });

  describe('Settings Selectors', () => {
    it('provides typed selectors for state slices', async () => {
      const { selectRenderSettings, selectDisplayInfo, selectCurrentRenderPlan } =
        await import('../../stores/render-store');

      const state = useRenderStore.getState();

      expect(selectRenderSettings(state)).toEqual(state.settings);
      expect(selectDisplayInfo(state)).toEqual(state.displayInfo);
      expect(selectCurrentRenderPlan(state)).toEqual(state.currentRenderPlan);
    });
  });
});

describe('Settings Validation', () => {
  it('validates quality mode values', async () => {
    const { isValidQualityMode } = await import('../../domain/rendering/QualityMode');

    expect(isValidQualityMode('performance')).toBe(true);
    expect(isValidQualityMode('balanced')).toBe(true);
    expect(isValidQualityMode('ultra')).toBe(true);
    expect(isValidQualityMode('invalid')).toBe(false);
    expect(isValidQualityMode('')).toBe(false);
  });

  it('validates RenderSettings with Zod schema', async () => {
    const { RenderSettingsSchema } = await import('../../domain/rendering/types');

    // Valid settings
    const valid = RenderSettingsSchema.safeParse({
      qualityMode: 'balanced',
      maxMegapixels: 24,
      hwAccelerationEnabled: true,
      debugOverlayEnabled: false,
    });
    expect(valid.success).toBe(true);

    // Invalid quality mode
    const invalidMode = RenderSettingsSchema.safeParse({
      qualityMode: 'invalid',
      maxMegapixels: 24,
      hwAccelerationEnabled: true,
      debugOverlayEnabled: false,
    });
    expect(invalidMode.success).toBe(false);

    // Invalid megapixels (negative)
    const negative = RenderSettingsSchema.safeParse({
      qualityMode: 'balanced',
      maxMegapixels: -1,
      hwAccelerationEnabled: true,
      debugOverlayEnabled: false,
    });
    expect(negative.success).toBe(false);

    // Invalid megapixels (too high - over 500)
    const tooHigh = RenderSettingsSchema.safeParse({
      qualityMode: 'balanced',
      maxMegapixels: 501,
      hwAccelerationEnabled: true,
      debugOverlayEnabled: false,
    });
    expect(tooHigh.success).toBe(false);
  });
});
