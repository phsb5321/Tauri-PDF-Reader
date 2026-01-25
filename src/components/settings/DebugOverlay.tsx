/**
 * DebugOverlay Component
 *
 * Displays real-time rendering diagnostics:
 * - Viewport size and DPR
 * - Output scale and canvas dimensions
 * - Megapixels and memory usage
 * - Quality mode and cap status
 */

import { useRenderStore, selectRenderSettings, selectDisplayInfo, selectCurrentRenderPlan } from '../../stores/render-store';
import { formatDebugOverlayData } from '../../domain/rendering';
import './DebugOverlay.css';

export function DebugOverlay() {
  const settings = useRenderStore(selectRenderSettings);
  const displayInfo = useRenderStore(selectDisplayInfo);
  const currentRenderPlan = useRenderStore(selectCurrentRenderPlan);

  // Don't render if no plan available
  if (!currentRenderPlan) {
    return (
      <div className="debug-overlay">
        <div className="debug-overlay-header">Render Debug</div>
        <div className="debug-overlay-item">
          <span className="debug-label">Status</span>
          <span className="debug-value">No render data</span>
        </div>
      </div>
    );
  }

  const data = formatDebugOverlayData(currentRenderPlan, settings, displayInfo);

  return (
    <div className="debug-overlay">
      <div className="debug-overlay-header">Render Debug</div>

      <div className="debug-section">
        <div className="debug-section-title">Display</div>
        <div className="debug-overlay-item">
          <span className="debug-label">Device Pixel Ratio</span>
          <span className="debug-value">{data.dpr}</span>
        </div>
        <div className="debug-overlay-item">
          <span className="debug-label">Viewport</span>
          <span className="debug-value">{data.viewport}</span>
        </div>
      </div>

      <div className="debug-section">
        <div className="debug-section-title">Rendering</div>
        <div className="debug-overlay-item">
          <span className="debug-label">Quality Mode</span>
          <span className="debug-value">{data.qualityMode}</span>
        </div>
        <div className="debug-overlay-item">
          <span className="debug-label">Output Scale</span>
          <span className="debug-value">{data.outputScale}</span>
        </div>
        <div className="debug-overlay-item">
          <span className="debug-label">Canvas Size</span>
          <span className="debug-value">{data.canvas}</span>
        </div>
      </div>

      <div className="debug-section">
        <div className="debug-section-title">Resources</div>
        <div className="debug-overlay-item">
          <span className="debug-label">Megapixels</span>
          <span className="debug-value">{data.megapixels}</span>
        </div>
        <div className="debug-overlay-item">
          <span className="debug-label">Memory Est.</span>
          <span className="debug-value">{data.memory}</span>
        </div>
        <div className="debug-overlay-item">
          <span className="debug-label">Capped</span>
          <span className={`debug-value ${currentRenderPlan.wasCapped ? 'debug-warning' : ''}`}>
            {data.capped}
          </span>
        </div>
      </div>
    </div>
  );
}

export default DebugOverlay;
