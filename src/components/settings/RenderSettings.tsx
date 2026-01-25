/**
 * RenderSettings Component
 *
 * UI for configuring PDF rendering quality settings:
 * - Quality mode selector (Performance/Balanced/Ultra)
 * - Max megapixels slider (8-48 MP)
 * - Hardware acceleration toggle (requires restart)
 * - Debug overlay toggle
 */

import { useRenderSettings } from '../../hooks/useRenderSettings';
import { useHwAccelStatus } from '../../hooks/useHwAccelStatus';
import type { QualityMode } from '../../domain/rendering';

const QUALITY_MODE_OPTIONS: { value: QualityMode; label: string; description: string }[] = [
  {
    value: 'performance',
    label: 'Performance',
    description: 'Lower quality, faster rendering. Good for older hardware.',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Good quality and performance. Recommended for most users.',
  },
  {
    value: 'ultra',
    label: 'Ultra',
    description: 'Maximum quality. May be slower on large documents.',
  },
];

export function RenderSettings() {
  const {
    settings,
    isLoading,
    pendingRestart,
    updateAndSave,
  } = useRenderSettings();

  const {
    status: hwAccelStatus,
    clearSafeMode,
  } = useHwAccelStatus();

  const handleQualityModeChange = async (mode: QualityMode) => {
    await updateAndSave('qualityMode', mode);
  };

  const handleMaxMegapixelsChange = async (value: number) => {
    await updateAndSave('maxMegapixels', value);
  };

  const handleHwAccelerationChange = async (enabled: boolean) => {
    await updateAndSave('hwAccelerationEnabled', enabled);
  };

  const handleDebugOverlayChange = async (enabled: boolean) => {
    await updateAndSave('debugOverlayEnabled', enabled);
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Rendering Quality</h3>
      <p className="settings-section-description">
        Configure how PDFs are rendered. Higher quality uses more memory.
      </p>

      {/* Quality Mode Selector */}
      <div className="setting-group">
        <label className="setting-label">Quality Mode</label>
        <div className="quality-mode-options">
          {QUALITY_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`quality-mode-option ${settings.qualityMode === option.value ? 'active' : ''}`}
              onClick={() => handleQualityModeChange(option.value)}
              disabled={isLoading}
              title={option.description}
            >
              <span className="quality-mode-label">{option.label}</span>
              <span className="quality-mode-description">{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Max Megapixels Slider */}
      <div className="setting-group">
        <label className="setting-label" htmlFor="max-megapixels">
          Maximum Canvas Size
        </label>
        <div className="slider-container">
          <input
            type="range"
            id="max-megapixels"
            min={0}
            max={200}
            step={8}
            value={settings.maxMegapixels}
            onChange={(e) => handleMaxMegapixelsChange(Number(e.target.value))}
            disabled={isLoading}
            className="settings-slider"
          />
          <span className="slider-value">{settings.maxMegapixels === 0 ? "Unlimited" : `${settings.maxMegapixels} MP`}</span>
        </div>
        <p className="setting-hint">
          Set to 0 for unlimited quality. Higher values use more memory.
        </p>
      </div>

      {/* Hardware Acceleration Toggle */}
      <div className="setting-group">
        {/* Safe Mode Warning Banner */}
        {hwAccelStatus.safeModeActive && (
          <div className="safe-mode-banner">
            <div className="safe-mode-icon">⚠️</div>
            <div className="safe-mode-content">
              <strong>Safe Mode Active</strong>
              <p>
                Hardware acceleration was disabled because the app crashed on previous startup.
                Click below to try enabling it again.
              </p>
              <button
                className="safe-mode-reset-btn"
                onClick={async () => {
                  await clearSafeMode();
                  await handleHwAccelerationChange(true);
                }}
                disabled={isLoading}
              >
                Re-enable Hardware Acceleration
              </button>
            </div>
          </div>
        )}

        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label" htmlFor="hw-acceleration">
              Hardware Acceleration
            </label>
            <p className="setting-hint">
              Uses GPU for faster rendering. Disable if you experience visual glitches.
              {hwAccelStatus.platformDefaultDisabled && (
                <span className="platform-note">
                  {' '}(Disabled by default on Linux due to WebKitGTK compatibility)
                </span>
              )}
            </p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="hw-acceleration"
              checked={settings.hwAccelerationEnabled}
              onChange={(e) => handleHwAccelerationChange(e.target.checked)}
              disabled={isLoading}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        {pendingRestart && (
          <div className="restart-notice">
            Restart required to apply hardware acceleration changes.
          </div>
        )}
      </div>

      {/* Debug Overlay Toggle */}
      <div className="setting-group">
        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label" htmlFor="debug-overlay">
              Debug Overlay
            </label>
            <p className="setting-hint">
              Shows rendering statistics like canvas size and memory usage.
            </p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="debug-overlay"
              checked={settings.debugOverlayEnabled}
              onChange={(e) => handleDebugOverlayChange(e.target.checked)}
              disabled={isLoading}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default RenderSettings;
