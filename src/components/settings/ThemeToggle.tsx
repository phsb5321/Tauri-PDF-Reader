import { useSettingsStore, Theme } from '../../stores/settings-store';

export function ThemeToggle() {
  const { theme, setTheme } = useSettingsStore();

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
              className={`button-group-option ${theme === 'light' ? 'active' : ''}`}
              onClick={() => handleThemeChange('light')}
            >
              Light
            </button>
            <button
              className={`button-group-option ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => handleThemeChange('dark')}
            >
              Dark
            </button>
            <button
              className={`button-group-option ${theme === 'system' ? 'active' : ''}`}
              onClick={() => handleThemeChange('system')}
            >
              System
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to apply theme to document
function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}
