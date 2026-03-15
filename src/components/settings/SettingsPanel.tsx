import { useState, useEffect, useRef } from "react";
import { useSettingsStore } from "../../stores/settings-store";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { TtsSettings } from "./TtsSettings";
import { HighlightSettings } from "./HighlightSettings";
import { ThemeToggle } from "./ThemeToggle";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { TelemetrySettings } from "./TelemetrySettings";
import { RenderSettings } from "./RenderSettings";
import { CacheSettings } from "./CacheSettings";
import "./SettingsPanel.css";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection =
  | "appearance"
  | "rendering"
  | "tts"
  | "cache"
  | "highlights"
  | "telemetry"
  | "shortcuts";

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("appearance");
  const { loadFromDatabase, dbInitialized } = useSettingsStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap for accessibility
  useFocusTrap({
    containerRef: panelRef,
    active: isOpen,
    onEscape: onClose,
    preventScroll: true,
  });

  useEffect(() => {
    if (isOpen && !dbInitialized) {
      loadFromDatabase();
    }
  }, [isOpen, dbInitialized, loadFromDatabase]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="settings-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="settings-panel" ref={panelRef}>
        <div className="settings-header">
          <h2 id="settings-title">Settings</h2>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="settings-body">
          <nav className="settings-nav">
            <button
              type="button"
              className={`settings-nav-item ${activeSection === "appearance" ? "active" : ""}`}
              onClick={() => setActiveSection("appearance")}
            >
              <PaletteIcon />
              <span>Appearance</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === "rendering" ? "active" : ""}`}
              onClick={() => setActiveSection("rendering")}
            >
              <RenderingIcon />
              <span>Rendering</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === "tts" ? "active" : ""}`}
              onClick={() => setActiveSection("tts")}
            >
              <SpeakerIcon />
              <span>Text-to-Speech</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === "cache" ? "active" : ""}`}
              onClick={() => setActiveSection("cache")}
            >
              <CacheIcon />
              <span>Audio Cache</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === "highlights" ? "active" : ""}`}
              onClick={() => setActiveSection("highlights")}
            >
              <HighlightIcon />
              <span>Highlights</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === "shortcuts" ? "active" : ""}`}
              onClick={() => setActiveSection("shortcuts")}
            >
              <KeyboardIcon />
              <span>Keyboard Shortcuts</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === "telemetry" ? "active" : ""}`}
              onClick={() => setActiveSection("telemetry")}
            >
              <ChartIcon />
              <span>Privacy & Data</span>
            </button>
          </nav>

          <div className="settings-content">
            {activeSection === "appearance" && <ThemeToggle />}
            {activeSection === "rendering" && <RenderSettings />}
            {activeSection === "tts" && <TtsSettings />}
            {activeSection === "cache" && <CacheSettings />}
            {activeSection === "highlights" && <HighlightSettings />}
            {activeSection === "shortcuts" && <KeyboardShortcuts />}
            {activeSection === "telemetry" && <TelemetrySettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="icon" aria-hidden="true">
      <path
        d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"
        fill="currentColor"
      />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden="true">
      <path
        d="M12 22C6.49 22 2 17.51 2 12S6.49 2 12 2s10 4.04 10 9c0 3.31-2.69 6-6 6h-1.77c-.28 0-.5.22-.5.5 0 .12.05.23.13.33.41.47.64 1.06.64 1.67A2.5 2.5 0 0112 22zm0-18c-4.41 0-8 3.59-8 8s3.59 8 8 8c.28 0 .5-.22.5-.5a.54.54 0 00-.14-.35c-.41-.46-.63-1.05-.63-1.65a2.5 2.5 0 012.5-2.5H16c2.21 0 4-1.79 4-4 0-3.86-3.59-7-8-7z"
        fill="currentColor"
      />
      <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" />
      <circle cx="9.5" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="14.5" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="11.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden="true">
      <path
        d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
        fill="currentColor"
      />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden="true">
      <path
        d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
        fill="currentColor"
      />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden="true">
      <path
        d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden="true">
      <path
        d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"
        fill="currentColor"
      />
    </svg>
  );
}

function RenderingIcon() {
  return (
    <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden="true">
      <path
        d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM5 15h14v2H5zm0-4h14v2H5zm0-4h14v2H5z"
        fill="currentColor"
      />
    </svg>
  );
}

function CacheIcon() {
  return (
    <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden="true">
      <path
        d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"
        fill="currentColor"
      />
    </svg>
  );
}
