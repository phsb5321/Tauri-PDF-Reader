/**
 * Quality Mode Configuration
 *
 * Defines the three quality modes (Performance, Balanced, Ultra) with their
 * associated rendering parameters.
 */

import type { QualityMode, QualityModeConfig } from './types';

/**
 * Quality mode configurations with rendering parameters
 */
export const QUALITY_MODE_CONFIGS: Record<QualityMode, QualityModeConfig> = {
  performance: {
    minOutputScale: 1.5,
    displayName: 'Performance',
    description:
      'Faster rendering with reduced memory usage. Best for older hardware or large documents.',
  },
  balanced: {
    minOutputScale: 2.0,
    displayName: 'Balanced',
    description: 'Good quality on modern hardware. Recommended for most users.',
  },
  ultra: {
    minOutputScale: 4.0,
    displayName: 'Ultra',
    description: 'Maximum crispness (4x supersampling) with higher memory usage. Best for detailed documents.',
  },
};

/**
 * Get the minimum output scale for a quality mode
 * @param mode - The quality mode
 * @param devicePixelRatio - Current device pixel ratio
 * @returns The minimum output scale (never below DPR)
 */
export function getMinOutputScale(mode: QualityMode, devicePixelRatio: number): number {
  const config = QUALITY_MODE_CONFIGS[mode];
  // Output scale should never be below DPR to prevent CSS upscaling blur
  return Math.max(config.minOutputScale, devicePixelRatio);
}

/**
 * Get all quality mode options for UI display
 * @returns Array of quality mode options with display info
 */
export function getQualityModeOptions(): Array<{
  value: QualityMode;
  label: string;
  description: string;
}> {
  return (Object.entries(QUALITY_MODE_CONFIGS) as Array<[QualityMode, QualityModeConfig]>).map(
    ([value, config]) => ({
      value,
      label: config.displayName,
      description: config.description,
    })
  );
}

/**
 * Validate that a string is a valid quality mode
 * @param value - Value to check
 * @returns True if valid quality mode
 */
export function isValidQualityMode(value: string): value is QualityMode {
  return value === 'performance' || value === 'balanced' || value === 'ultra';
}
