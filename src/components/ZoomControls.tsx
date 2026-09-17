import { useDocumentStore } from "../stores/document-store";
import { useAnnounce, ANNOUNCEMENTS } from "../hooks/useAnnounce";
import { ZOOM_LEVELS, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../lib/constants";
import "./ZoomControls.css";

/** Keys the zoom select owns while focused — contained so they never reach
 * the document-level PdfViewer Home/End and AiPlaybackBar Escape handlers
 * (spec 256 / p16 corrective acceptance). */
const SELECT_OWNED_KEYS = new Set([
  "Home",
  "End",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
]);

export function ZoomControls() {
  const { zoomLevel, fitMode, setZoomLevel, setFitMode } = useDocumentStore();
  const { announce } = useAnnounce();

  // While the zoom select owns focus, its navigation/escape keys belong to
  // the native popup/selection. Document-level handlers (PdfViewer Home/End
  // page navigation, AiPlaybackBar Escape-to-stop) ignore defaultPrevented,
  // so containment here is stopPropagation — native option movement stays
  // untouched (no preventDefault). Spec 256 / p16 corrective acceptance.
  const handleSelectKeyDown = (
    event: React.KeyboardEvent<HTMLSelectElement>,
  ) => {
    if (SELECT_OWNED_KEYS.has(event.key)) event.stopPropagation();
  };

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
  const exactZoomValue = String(Number(zoomLevel.toFixed(4)));
  const isPresetZoom = ZOOM_LEVELS.some(
    (level) => String(Number(level.value.toFixed(4))) === exactZoomValue,
  );
  const selectedValue = fitMode === "none" ? exactZoomValue : fitMode;

  return (
    <div className="zoom-controls">
      <button
        type="button"
        className="zoom-button"
        onClick={handleZoomOut}
        disabled={zoomLevel <= ZOOM_MIN}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <svg viewBox="0 0 24 24" className="zoom-icon" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35M8 11h6" />
        </svg>
      </button>

      <select
        className="zoom-select"
        value={selectedValue}
        onChange={handleZoomSelect}
        onKeyDown={handleSelectKeyDown}
        aria-label="Zoom level"
      >
        <option value="fit-width">
          {fitMode === "fit-width"
            ? `Fit Width · ${zoomPercentage}%`
            : "Fit Width"}
        </option>
        <option value="fit-page">
          {fitMode === "fit-page"
            ? `Fit Page · ${zoomPercentage}%`
            : "Fit Page"}
        </option>
        <optgroup label="Zoom">
          {!isPresetZoom && fitMode === "none" && (
            <option value={exactZoomValue}>{zoomPercentage}%</option>
          )}
          {ZOOM_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </optgroup>
      </select>

      <button
        type="button"
        className="zoom-button"
        onClick={handleZoomIn}
        disabled={zoomLevel >= ZOOM_MAX}
        title="Zoom in"
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
