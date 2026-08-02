interface ScannedPdfWarningProps {
  onDismiss?: () => void;
}

export function ScannedPdfWarning({ onDismiss }: ScannedPdfWarningProps) {
  return (
    <div className="scanned-pdf-warning">
      <div className="warning-content">
        <svg
          className="warning-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="warning-text">
          <strong>Scanned PDF Detected</strong>
          <p>
            This PDF appears to be a scanned document without a text layer. Text
            selection, highlighting, and text-to-speech may not work.
          </p>
        </div>
        {onDismiss && (
          <button
            className="dismiss-button"
            onClick={onDismiss}
            aria-label="Dismiss warning"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <style>{`
        .scanned-pdf-warning {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          max-width: 500px;
          width: calc(100% - 32px);
        }

        .warning-content {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          background: var(--color-warning-bg);
          border: 1px solid var(--color-warning-border);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .warning-icon {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
          color: var(--color-warning-text);
        }

        .warning-text {
          flex: 1;
        }

        .warning-text strong {
          display: block;
          color: var(--color-warning-text);
          font-size: 14px;
          margin-bottom: 4px;
        }

        .warning-text p {
          margin: 0;
          color: var(--color-warning-text);
          font-size: 13px;
          line-height: 1.4;
        }

        .dismiss-button {
          padding: 4px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-warning-text);
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .dismiss-button:hover {
          opacity: 1;
        }

        .dismiss-button svg {
          width: 18px;
          height: 18px;
        }

      `}</style>
    </div>
  );
}
