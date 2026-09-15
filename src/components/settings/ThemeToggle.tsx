import {
  useSettingsStore,
  type Theme,
  UI_SCALE_MIN,
  UI_SCALE_MAX,
} from "../../stores/settings-store";

export function ThemeToggle() {
  const { theme, setTheme, uiScale, setUiScale } = useSettingsStore();
  const uiScalePercent = Math.round(uiScale * 100);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Appearance</h3>
      <p className="settings-section-description">
        Choose your preferred theme for the application.
      </p>

      <div className="setting-row">
        <div className="setting-info">
          <div className="setting-label">Theme</div>
          <div className="setting-description">
            Select light, dark, or follow your system settings
          </div>
        </div>
        <div className="setting-control">
          <div className="button-group">
            <button
              className={`button-group-option ${theme === "light" ? "active" : ""}`}
              onClick={() => handleThemeChange("light")}
            >
              Light
            </button>
            <button
              className={`button-group-option ${theme === "dark" ? "active" : ""}`}
              onClick={() => handleThemeChange("dark")}
            >
              Dark
            </button>
            <button
              className={`button-group-option ${theme === "system" ? "active" : ""}`}
              onClick={() => handleThemeChange("system")}
            >
              System
            </button>
          </div>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <div className="setting-label">UI scale</div>
          <div className="setting-description">
            Enlarge menus and controls. PDF pages keep their own zoom.
          </div>
        </div>
        <div className="setting-control setting-slider">
          <input
            type="range"
            min={UI_SCALE_MIN * 100}
            max={UI_SCALE_MAX * 100}
            step={5}
            value={uiScalePercent}
            aria-label="UI scale"
            aria-valuetext={`${uiScalePercent}%`}
            onChange={(event) => setUiScale(Number(event.target.value) / 100)}
          />
          <output className="setting-slider-value" aria-live="polite">
            {uiScalePercent}%
          </output>
        </div>
      </div>
    </div>
  );
}

// Helper function to apply theme to document
function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", theme);
  }
}
