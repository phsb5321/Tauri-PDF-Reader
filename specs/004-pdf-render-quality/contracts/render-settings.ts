/**
 * Render Settings Contract
 *
 * Type definitions and schemas for PDF rendering quality configuration.
 * These contracts define the interface between UI, domain, and persistence layers.
 */

import { z } from 'zod';

// =============================================================================
// Quality Mode
// =============================================================================

/**
 * Quality mode enum - predefined rendering quality profiles
 */
export const QualityModeSchema = z.enum(['performance', 'balanced', 'ultra']);
export type QualityMode = z.infer<typeof QualityModeSchema>;

/**
 * Quality mode configuration details
 */
export interface QualityModeConfig {
  /** Minimum output scale multiplier */
  minOutputScale: number;
  /** Display name for UI */
  displayName: string;
  /** Description for UI tooltip */
  description: string;
}

export const QUALITY_MODE_CONFIGS: Record<QualityMode, QualityModeConfig> = {
  performance: {
    minOutputScale: 1.5,
    displayName: 'Performance',
    description: 'Faster rendering with reduced memory usage. Best for older hardware or large documents.',
  },
  balanced: {
    minOutputScale: 2.0,
    displayName: 'Balanced',
    description: 'Good quality on modern hardware. Recommended for most users.',
  },
  ultra: {
    minOutputScale: 3.0,
    displayName: 'Ultra',
    description: 'Maximum crispness with higher memory usage. Best for detailed documents.',
  },
};

// =============================================================================
// Render Settings
// =============================================================================

/**
 * User-configurable rendering preferences
 */
export const RenderSettingsSchema = z.object({
  /** Selected quality profile */
  qualityMode: QualityModeSchema.default('balanced'),
  /** Canvas size cap in megapixels (8-48) */
  maxMegapixels: z.number().min(8).max(48).default(24),
  /** GPU acceleration toggle (requires restart) */
  hwAccelerationEnabled: z.boolean().default(true),
  /** Show render diagnostics overlay */
  debugOverlayEnabled: z.boolean().default(false),
});

export type RenderSettings = z.infer<typeof RenderSettingsSchema>;

/**
 * Default render settings
 */
export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  qualityMode: 'balanced',
  maxMegapixels: 24,
  hwAccelerationEnabled: true,
  debugOverlayEnabled: false,
};

/**
 * Platform-specific default overrides
 */
export const PLATFORM_DEFAULTS: Record<string, Partial<RenderSettings>> = {
  windows: { hwAccelerationEnabled: true },
  macos: { hwAccelerationEnabled: true },
  linux: { hwAccelerationEnabled: false },
};

// =============================================================================
// Render Plan (Calculated)
// =============================================================================

/**
 * Computed rendering parameters for a specific page render
 */
export const RenderPlanSchema = z.object({
  /** User zoom level (1.0 = 100%) */
  zoomLevel: z.number().min(0.25).max(4.0),
  /** HiDPI multiplier (1.0-4.0) */
  outputScale: z.number().min(1.0).max(4.0),
  /** Logical width (CSS pixels) */
  viewportWidth: z.number().positive(),
  /** Logical height (CSS pixels) */
  viewportHeight: z.number().positive(),
  /** Physical width (device pixels) */
  canvasWidth: z.number().positive().int(),
  /** Physical height (device pixels) */
  canvasHeight: z.number().positive().int(),
  /** Total megapixels */
  megapixels: z.number().nonnegative(),
  /** Estimated memory usage in MB */
  memoryMB: z.number().nonnegative(),
  /** Whether megapixel cap was applied */
  wasCapped: z.boolean(),
});

export type RenderPlan = z.infer<typeof RenderPlanSchema>;

// =============================================================================
// Display Info (Runtime)
// =============================================================================

/**
 * Current display characteristics
 */
export const DisplayInfoSchema = z.object({
  /** Display scaling factor */
  devicePixelRatio: z.number().positive(),
  /** Container width */
  viewportWidth: z.number().positive(),
  /** Container height */
  viewportHeight: z.number().positive(),
});

export type DisplayInfo = z.infer<typeof DisplayInfoSchema>;

// =============================================================================
// Tauri Command Contracts
// =============================================================================

/**
 * Get render settings request/response
 */
export const GetRenderSettingsResponseSchema = RenderSettingsSchema;
export type GetRenderSettingsResponse = RenderSettings;

/**
 * Update render settings request
 */
export const UpdateRenderSettingsRequestSchema = RenderSettingsSchema.partial();
export type UpdateRenderSettingsRequest = Partial<RenderSettings>;

/**
 * Update render settings response
 */
export const UpdateRenderSettingsResponseSchema = z.object({
  success: z.boolean(),
  restartRequired: z.boolean(),
  settings: RenderSettingsSchema,
});
export type UpdateRenderSettingsResponse = z.infer<typeof UpdateRenderSettingsResponseSchema>;

// =============================================================================
// Debug Overlay Data
// =============================================================================

/**
 * Data for render debug overlay
 */
export const DebugOverlayDataSchema = z.object({
  /** Current render plan */
  plan: RenderPlanSchema,
  /** Current settings */
  settings: RenderSettingsSchema,
  /** Display info */
  display: DisplayInfoSchema,
  /** Formatted display strings */
  formatted: z.object({
    viewport: z.string(),
    canvas: z.string(),
    megapixels: z.string(),
    memory: z.string(),
    qualityMode: z.string(),
    outputScale: z.string(),
    capped: z.string(),
  }),
});

export type DebugOverlayData = z.infer<typeof DebugOverlayDataSchema>;

// =============================================================================
// Constants
// =============================================================================

export const RENDER_CONSTANTS = {
  /** Output scale fallback cascade */
  FALLBACK_SCALES: [4, 3, 2, 1.5, 1] as const,
  /** Bytes per pixel (RGBA) */
  BYTES_PER_PIXEL: 4,
  /** Megapixel divisor */
  MEGAPIXEL_DIVISOR: 1_000_000,
  /** Megabyte divisor */
  MEGABYTE_DIVISOR: 1024 * 1024,
  /** Default debounce delay (ms) */
  RENDER_DEBOUNCE_MS: 150,
} as const;
