const shortcuts = [
  { action: 'Play / Pause TTS', keys: ['Ctrl', 'Space'] },
  { action: 'Stop TTS', keys: ['Esc'] },
  { action: 'Previous Chunk', keys: ['Ctrl', '['] },
  { action: 'Next Chunk', keys: ['Ctrl', ']'] },
  { action: 'Previous Page', keys: ['←'] },
  { action: 'Next Page', keys: ['→'] },
  { action: 'Go to First Page', keys: ['Home'] },
  { action: 'Go to Last Page', keys: ['End'] },
  { action: 'Page Up', keys: ['Page Up'] },
  { action: 'Page Down', keys: ['Page Down'] },
  { action: 'Zoom In', keys: ['Ctrl', '+'] },
  { action: 'Zoom Out', keys: ['Ctrl', '-'] },
  { action: 'Reset Zoom', keys: ['Ctrl', '0'] },
  { action: 'Toggle Fullscreen', keys: ['F11'] },
  { action: 'Open File', keys: ['Ctrl', 'O'] },
  { action: 'Toggle Follow-Along', keys: ['Ctrl', 'F'] },
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
