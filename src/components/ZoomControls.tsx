import { useDocumentStore } from "../stores/document-store";
import { useAnnounce, ANNOUNCEMENTS } from "../hooks/useAnnounce";
import { ZOOM_LEVELS, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../lib/constants";
import "./ZoomControls.css";

export function ZoomControls() {
  const { zoomLevel, fitMode, setZoomLevel, setFitMode } = useDocumentStore();
  const { announce } = useAnnounce();

  const handleZoomIn = () => {
    // Use larger step for bigger zoom levels
    const step = zoomLevel >= 2.0 ? 0.5 : ZOOM_STEP;
    const newZoom = Math.min(zoomLevel + step, ZOOM_MAX);
    setZoomLevel(newZoom);
    // Announce zoom change for screen readers (T037)
    announce(ANNOUNCEMENTS.zoomChange(Math.round(newZoom * 100)));
  };

  const handleZoomOut = () => {
    // Use larger step for bigger zoom levels
    const step = zoomLevel > 2.0 ? 0.5 : ZOOM_STEP;
    const newZoom = Math.max(zoomLevel - step, ZOOM_MIN);
    setZoomLevel(newZoom);
    // Announce zoom change for screen readers (T037)
    announce(ANNOUNCEMENTS.zoomChange(Math.round(newZoom * 100)));
  };

  const handleZoomSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    // Handle fit mode options
    if (value === "fit-width" || value === "fit-page") {
      setFitMode(value);
      // Announce fit mode change for screen readers (T037)
      announce(value === "fit-width" ? "Fit to width" : "Fit to page");
      return;
    }

    const newZoom = parseFloat(value);
    setZoomLevel(newZoom);
    // Announce zoom change for screen readers (T037)
    announce(ANNOUNCEMENTS.zoomChange(Math.round(newZoom * 100)));
  };

  const zoomPercentage = Math.round(zoomLevel * 100);

  // Find closest zoom level for select dropdown
  const closestZoomValue = ZOOM_LEVELS.reduce((prev, curr) =>
    Math.abs(curr.value - zoomLevel) < Math.abs(prev.value - zoomLevel)
      ? curr
      : prev,
  ).value;

  return (
    <div className="zoom-controls">
      <button
        type="button"
        className="zoom-button"
        onClick={handleZoomOut}
        disabled={zoomLevel <= ZOOM_MIN}
        title="Zoom out (Ctrl+-)"
        aria-label="Zoom out"
      >
        <svg viewBox="0 0 24 24" className="zoom-icon" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35M8 11h6" />
        </svg>
      </button>

      <select
        className="zoom-select"
        value={fitMode !== "none" ? fitMode : closestZoomValue}
        onChange={handleZoomSelect}
        aria-label="Zoom level"
      >
        <option value="fit-width">Fit Width</option>
        <option value="fit-page">Fit Page</option>
        <optgroup label="Zoom">
          {ZOOM_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </optgroup>
      </select>

      <span className="zoom-percentage" title="Current zoom level">
        {zoomPercentage}%
      </span>

      <button
        type="button"
        className="zoom-button"
        onClick={handleZoomIn}
        disabled={zoomLevel >= ZOOM_MAX}
        title="Zoom in (Ctrl++)"
        aria-label="Zoom in"
      >
        <svg viewBox="0 0 24 24" className="zoom-icon" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
        </svg>
      </button>
    </div>
  );
}
