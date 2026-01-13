import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  target: string;
  message: string;
  context?: unknown;
}

export function DebugLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<string>('debug');

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await invoke<LogEntry[]>('get_debug_logs', { minLevel: filter });
      setLogs(result);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  const copyLogs = useCallback(async () => {
    try {
      const logsText = await invoke<string>('export_debug_logs', { format: 'text' });
      await navigator.clipboard.writeText(logsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
      // Fallback: try copying from state
      const fallbackText = logs
        .map(l => `[${l.timestamp}] ${l.level.toUpperCase()} ${l.target} - ${l.message}`)
        .join('\n');
      try {
        await navigator.clipboard.writeText(fallbackText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        console.error('Clipboard fallback also failed');
      }
    }
  }, [logs]);

  const clearLogs = useCallback(async () => {
    try {
      await invoke('clear_debug_logs');
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'var(--error-color, #d32f2f)';
      case 'warn': return 'var(--warning-color, #f57c00)';
      case 'info': return 'var(--info-color, #1976d2)';
      default: return 'var(--text-secondary, #666)';
    }
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Debug Logs</h3>
      <p className="settings-section-description">
        View and export application logs for troubleshooting.
      </p>

      <div className="debug-logs-controls">
        <select
          className="setting-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="debug">All Logs</option>
          <option value="info">Info & Above</option>
          <option value="warn">Warnings & Errors</option>
          <option value="error">Errors Only</option>
        </select>

        <button
          className="debug-logs-button"
          onClick={loadLogs}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Load Logs'}
        </button>

        <button
          className="debug-logs-button primary"
          onClick={copyLogs}
          disabled={logs.length === 0}
        >
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>

        <button
          className="debug-logs-button"
          onClick={clearLogs}
          disabled={logs.length === 0}
        >
          Clear
        </button>
      </div>

      {logs.length > 0 && (
        <div className="debug-logs-container">
          <div className="debug-logs-list">
            {logs.map((log, index) => (
              <div key={index} className="debug-log-entry">
                <span className="debug-log-time">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className="debug-log-level"
                  style={{ color: getLevelColor(log.level) }}
                >
                  {log.level.toUpperCase()}
                </span>
                <span className="debug-log-target">{log.target}</span>
                <span className="debug-log-message">{log.message}</span>
              </div>
            ))}
          </div>
          <div className="debug-logs-count">
            {logs.length} log entries
          </div>
        </div>
      )}

      {logs.length === 0 && !isLoading && (
        <div className="debug-logs-empty">
          <p>No logs available. Click "Load Logs" to fetch recent activity.</p>
        </div>
      )}

      <style>{`
        .debug-logs-controls {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .debug-logs-button {
          padding: 8px 16px;
          border: 1px solid var(--border-color, #e0e0e0);
          background: var(--bg-primary, #fff);
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .debug-logs-button:hover:not(:disabled) {
          border-color: var(--primary-color, #2196f3);
        }

        .debug-logs-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .debug-logs-button.primary {
          background: var(--primary-color, #2196f3);
          color: white;
          border-color: var(--primary-color, #2196f3);
        }

        .debug-logs-button.primary:hover:not(:disabled) {
          background: var(--primary-dark, #1976d2);
        }

        .debug-logs-container {
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          overflow: hidden;
        }

        .debug-logs-list {
          max-height: 300px;
          overflow-y: auto;
          font-family: monospace;
          font-size: 12px;
          background: var(--bg-secondary, #f8f8f8);
        }

        .debug-log-entry {
          display: flex;
          gap: 8px;
          padding: 6px 12px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .debug-log-entry:last-child {
          border-bottom: none;
        }

        .debug-log-time {
          color: var(--text-tertiary, #999);
          flex-shrink: 0;
        }

        .debug-log-level {
          font-weight: 600;
          flex-shrink: 0;
          width: 50px;
        }

        .debug-log-target {
          color: var(--text-secondary, #666);
          flex-shrink: 0;
        }

        .debug-log-message {
          color: var(--text-primary, #1a1a1a);
          word-break: break-word;
        }

        .debug-logs-count {
          padding: 8px 12px;
          font-size: 12px;
          color: var(--text-secondary, #666);
          border-top: 1px solid var(--border-color, #e0e0e0);
        }

        .debug-logs-empty {
          padding: 20px;
          text-align: center;
          color: var(--text-secondary, #666);
        }

        .debug-logs-empty p {
          margin: 0;
        }
      `}</style>
    </div>
  );
}
