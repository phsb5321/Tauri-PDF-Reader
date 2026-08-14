import { COMMAND_CHORDS, COMPONENT_CHORDS } from "../../hooks/useCommandKeys";

/**
 * Keyboard shortcuts reference — DERIVED from the real chord sources
 * (slice 111): COMMAND_CHORDS is the same table `useCommandKeys` matches
 * against, and COMPONENT_CHORDS lists the component-owned bindings with
 * their code locations in `useCommandKeys.ts`. A hand-maintained second
 * list is how chords that never existed (Ctrl+F, Ctrl+,, Ctrl+H, Ctrl+B,
 * F11, zoom, chunks) and the Space-as-play/pause lie (Space is next-page)
 * got advertised. Nothing is shown here unless the binding exists.
 */
// COMMAND_CHORDS carries {key, label}; the panel renders the human label as
// the key chip. COMPONENT_CHORDS already carries a keys array.
const FILE_CHORDS = COMMAND_CHORDS.filter((c) =>
  ["open", "toggle-library"].includes(c.action),
).map((c) => ({ action: c.action, keys: [c.label] }));
const NAV_CHORDS = COMMAND_CHORDS.filter((c) =>
  ["prev-page", "next-page"].includes(c.action),
).map((c) => ({ action: c.action, keys: [c.label] }));

/**
 * Keyboard shortcuts reference — DERIVED from the real chord sources
 * (slice 111): COMMAND_CHORDS is the same table `useCommandKeys` matches
 * against, and COMPONENT_CHORDS lists the component-owned bindings with
 * their code locations. A hand-maintained second list is how Ctrl+F, F11,
 * zoom and chunk chords (which never existed) and the Space-as-play/pause
 * lie (Space is next-page) got advertised. Nothing here exists unless the
 * binding does.
 */
export function KeyboardShortcuts() {
  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Keyboard Shortcuts</h3>
      <p className="settings-section-description">
        Quick reference for keyboard shortcuts in the reader.
      </p>

      <div className="shortcut-list">
        <ShortcutGroup title="File" chords={FILE_CHORDS} />
        <ShortcutGroup title="Document" chords={NAV_CHORDS} />
        <ShortcutGroup
          title="Reader (component-owned)"
          chords={COMPONENT_CHORDS}
        />
      </div>
    </div>
  );
}

function ShortcutGroup({
  title,
  chords,
}: Readonly<{
  title: string;
  chords: readonly { action: string; keys: string[] }[];
}>) {
  return (
    <>
      <div className="shortcut-group-title">{title}</div>
      {chords.map((chord) => (
        <div key={chord.action} className="shortcut-row">
          <span className="shortcut-action">{chord.action}</span>
          <div className="shortcut-keys">
            {chord.keys.map((key, index) => (
              <span key={index}>
                <span className="shortcut-key">{key}</span>
                {index < chord.keys.length - 1 && (
                  <span className="shortcut-separator">+</span>
                )}
              </span>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
