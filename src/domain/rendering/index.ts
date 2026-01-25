/**
 * Rendering Domain Module
 *
 * Central export point for all rendering-related domain logic.
 */

// Types
export type {
  QualityMode,
  QualityModeConfig,
  RenderSettings,
  RenderPlan,
  DisplayInfo,
  GetRenderSettingsResponse,
  UpdateRenderSettingsRequest,
  UpdateRenderSettingsResponse,
  DebugOverlayData,
} from './types';

export {
  QualityModeSchema,
  RenderSettingsSchema,
  RenderPlanSchema,
  DisplayInfoSchema,
  GetRenderSettingsResponseSchema,
  UpdateRenderSettingsRequestSchema,
  UpdateRenderSettingsResponseSchema,
  DebugOverlayDataSchema,
  DEFAULT_RENDER_SETTINGS,
  PLATFORM_DEFAULTS,
  RENDER_CONSTANTS,
} from './types';

// Quality Mode
export {
  QUALITY_MODE_CONFIGS,
  getMinOutputScale,
  getQualityModeOptions,
  isValidQualityMode,
} from './QualityMode';

// Render Policy
export type { RenderPlanInput, FitModeInput, FitModeMultiPageInput } from './RenderPolicy';
export {
  calculateRenderPlan,
  calculateOptimalOutputScale,
  calculateMemoryMB,
  calculateMegapixels,
  calculateFitWidthZoom,
  calculateFitPageZoom,
  calculateFitWidthZoomMultiPage,
  calculateFitPageZoomMultiPage,
  formatDebugOverlayData,
  getTransformMatrix,
} from './RenderPolicy';
