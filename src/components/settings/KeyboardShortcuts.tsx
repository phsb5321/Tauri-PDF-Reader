/**
 * Keyboard shortcuts reference
 * Grouped by category for better organization
 */
const shortcuts = [
  // File operations
  { action: 'Open File', keys: ['Ctrl', 'O'], category: 'File' },

  // Navigation - Panels
  { action: 'Open Settings', keys: ['Ctrl', ','], category: 'Navigation' },
  { action: 'Toggle Highlights Panel', keys: ['Ctrl', 'H'], category: 'Navigation' },
  { action: 'Toggle Library Sidebar', keys: ['Ctrl', 'B'], category: 'Navigation' },
  { action: 'Close Modal / Panel', keys: ['Escape'], category: 'Navigation' },

  // Navigation - Document
  { action: 'Previous Page', keys: ['←'], category: 'Document' },
  { action: 'Next Page', keys: ['→'], category: 'Document' },
  { action: 'Go to First Page', keys: ['Home'], category: 'Document' },
  { action: 'Go to Last Page', keys: ['End'], category: 'Document' },
  { action: 'Page Up', keys: ['Page Up'], category: 'Document' },
  { action: 'Page Down', keys: ['Page Down'], category: 'Document' },

  // View
  { action: 'Zoom In', keys: ['Ctrl', '+'], category: 'View' },
  { action: 'Zoom Out', keys: ['Ctrl', '-'], category: 'View' },
  { action: 'Reset Zoom', keys: ['Ctrl', '0'], category: 'View' },
  { action: 'Toggle Fullscreen', keys: ['F11'], category: 'View' },

  // TTS Playback
  { action: 'Play / Pause TTS', keys: ['Space'], category: 'Playback' },
  { action: 'Stop TTS', keys: ['Escape'], category: 'Playback' },
  { action: 'Previous Chunk', keys: ['Ctrl', '['], category: 'Playback' },
  { action: 'Next Chunk', keys: ['Ctrl', ']'], category: 'Playback' },
  { action: 'Toggle Follow-Along', keys: ['Ctrl', 'F'], category: 'Playback' },
];

export function KeyboardShortcuts() {
  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Keyboard Shortcuts</h3>
      <p className="settings-section-description">
        Quick reference for keyboard shortcuts in the reader.
      </p>

      <div className="shortcut-list">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.action} className="shortcut-row">
            <span className="shortcut-action">{shortcut.action}</span>
            <div className="shortcut-keys">
              {shortcut.keys.map((key, index) => (
                <span key={index}>
                  <span className="shortcut-key">{key}</span>
                  {index < shortcut.keys.length - 1 && <span className="shortcut-separator">+</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
