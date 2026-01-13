import { useState } from 'react';
import { useSettingsStore } from '../../stores/settings-store';

export function TelemetrySettings() {
  const {
    telemetryAnalytics,
    telemetryErrors,
    setTelemetryAnalytics,
    setTelemetryErrors
  } = useSettingsStore();

  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Privacy & Data</h3>
      <p className="settings-section-description">
        Control what data is collected to help improve the application.
      </p>

      <div className="setting-row">
        <div className="setting-info">
          <div className="setting-label">Usage Analytics</div>
          <div className="setting-description">
            Help improve the app by sharing anonymous usage data
          </div>
        </div>
        <div className="setting-control">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={telemetryAnalytics}
              onChange={(e) => setTelemetryAnalytics(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <div className="setting-label">Error Reports</div>
          <div className="setting-description">
            Send crash reports and error logs to help fix issues
          </div>
        </div>
        <div className="setting-control">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={telemetryErrors}
              onChange={(e) => setTelemetryErrors(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="telemetry-disclosure">
        <button
          className="telemetry-details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide details' : 'What data is collected?'}
        </button>

        {showDetails && (
          <div className="telemetry-details">
            <h4>Usage Analytics (if enabled)</h4>
            <ul>
              <li>Features used (e.g., TTS playback, highlighting)</li>
              <li>App version and platform</li>
              <li>Session duration</li>
              <li>Error rates</li>
            </ul>

            <h4>Error Reports (if enabled)</h4>
            <ul>
              <li>Error messages and stack traces</li>
              <li>App state at time of error</li>
              <li>System information (OS version, memory)</li>
            </ul>

            <h4>Never Collected</h4>
            <ul>
              <li>PDF content or file names</li>
              <li>Personal information</li>
              <li>Highlight text or notes</li>
              <li>File paths on your system</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
