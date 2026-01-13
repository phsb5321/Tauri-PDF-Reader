import { useDocumentStore } from '../stores/document-store';
import { ZOOM_LEVELS, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '../lib/constants';
import './ZoomControls.css';

export function ZoomControls() {
  const { zoomLevel, setZoomLevel } = useDocumentStore();

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + ZOOM_STEP, ZOOM_MAX);
    setZoomLevel(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - ZOOM_STEP, ZOOM_MIN);
    setZoomLevel(newZoom);
  };

  const handleZoomSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'fit-width' || value === 'fit-page') {
      // These will be handled by the PdfViewer component
      // For now, just use 100% as a fallback
      setZoomLevel(1.0);
    } else {
      setZoomLevel(parseFloat(value));
    }
  };

  const zoomPercentage = Math.round(zoomLevel * 100);

  return (
    <div className="zoom-controls">
      <button
        className="zoom-button"
        onClick={handleZoomOut}
        disabled={zoomLevel <= ZOOM_MIN}
        title="Zoom out (Ctrl+-)"
        aria-label="Zoom out"
      >
        <svg viewBox="0 0 24 24" className="zoom-icon">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35M8 11h6" />
        </svg>
      </button>

      <select
        className="zoom-select"
        value={zoomLevel}
        onChange={handleZoomSelect}
        aria-label="Zoom level"
      >
        {ZOOM_LEVELS.map((level) => (
          <option key={level.value} value={level.value}>
            {level.label}
          </option>
        ))}
      </select>

      <span className="zoom-percentage">{zoomPercentage}%</span>

      <button
        className="zoom-button"
        onClick={handleZoomIn}
        disabled={zoomLevel >= ZOOM_MAX}
        title="Zoom in (Ctrl++)"
        aria-label="Zoom in"
      >
        <svg viewBox="0 0 24 24" className="zoom-icon">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
        </svg>
      </button>
    </div>
  );
}
