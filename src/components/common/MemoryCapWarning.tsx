/**
 * Memory Cap Warning Component
 *
 * Shows a warning when rendering quality has been reduced due to megapixel capping.
 * This helps users understand why their PDF might look less crisp at high zoom levels.
 */

interface MemoryCapWarningProps {
  originalMegapixels?: number;
  cappedMegapixels?: number;
  maxMegapixels: number;
  onDismiss?: () => void;
}

export function MemoryCapWarning({
  originalMegapixels,
  cappedMegapixels,
  maxMegapixels,
  onDismiss,
}: MemoryCapWarningProps) {
  return (
    <div className="memory-cap-warning">
      <div className="warning-content">
        <svg className="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <div className="warning-text">
          <strong>Rendering Quality Reduced</strong>
          <p>
            Memory usage capped to {maxMegapixels} MP.
            {originalMegapixels && cappedMegapixels && (
              <> Requested {originalMegapixels.toFixed(1)} MP, rendering at {cappedMegapixels.toFixed(1)} MP.</>
            )}
            {' '}Zoom out or increase limit in Settings to improve quality.
          </p>
        </div>
        {onDismiss && (
          <button className="dismiss-button" onClick={onDismiss} aria-label="Dismiss warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <style>{`
        .memory-cap-warning {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          max-width: 500px;
          width: calc(100% - 32px);
        }

        .memory-cap-warning .warning-content {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          background: var(--info-bg, #e3f2fd);
          border: 1px solid var(--info-border, #2196f3);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .memory-cap-warning .warning-icon {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
          color: var(--info-color, #1565c0);
        }

        .memory-cap-warning .warning-text {
          flex: 1;
        }

        .memory-cap-warning .warning-text strong {
          display: block;
          color: var(--info-color, #1565c0);
          font-size: 14px;
          margin-bottom: 4px;
        }

        .memory-cap-warning .warning-text p {
          margin: 0;
          color: var(--info-text, #0d47a1);
          font-size: 13px;
          line-height: 1.4;
        }

        .memory-cap-warning .dismiss-button {
          padding: 4px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--info-color, #1565c0);
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .memory-cap-warning .dismiss-button:hover {
          opacity: 1;
        }

        .memory-cap-warning .dismiss-button svg {
          width: 18px;
          height: 18px;
        }

        /* Dark theme support */
        [data-theme="dark"] .memory-cap-warning .warning-content {
          background: #1a237e;
          border-color: #3f51b5;
        }

        [data-theme="dark"] .memory-cap-warning .warning-icon,
        [data-theme="dark"] .memory-cap-warning .warning-text strong,
        [data-theme="dark"] .memory-cap-warning .dismiss-button {
          color: #64b5f6;
        }

        [data-theme="dark"] .memory-cap-warning .warning-text p {
          color: #90caf9;
        }
      `}</style>
    </div>
  );
}
