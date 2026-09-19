import type { MenuAction } from "../../lib/api/menu";
import { COMMAND_CHORDS, COMPONENT_CHORDS } from "../../hooks/useCommandKeys";
import "./KeyboardShortcuts.css";

/**
 * Keyboard shortcuts reference — the discoverability layer over the real
 * chord sources. Everything shown is DERIVED from `COMMAND_CHORDS` (the same
 * table `resolveChord` matches against) and `COMPONENT_CHORDS` (the
 * component-owned bindings kept beside it): the panel cannot advertise a
 * chord it cannot point at, and a chord that exists cannot disappear behind a
 * hand-restated second list (the slice-111 drift mechanism — see the pinned
 * consistency test).
 *
 * Platform accuracy (p16 correction): `resolveChord` matches
 * `event.ctrlKey || event.metaKey`, so the GLOBAL table genuinely accepts Cmd
 * on macOS and its keycaps are relabelled there. Component-owned handlers
 * check `ctrlKey` literally (`AiPlaybackBar` play/pause is `" " + ctrlKey`),
 * so COMPONENT keys are never relabelled — advertising Cmd+Space would be a
 * lie. Bare Space stays next-page; no Find or zoom chord exists and none is
 * shown.
 */

/** Which platform convention the keycaps follow. */
export type Platform = "mac" | "other";

/**
 * Platform signal for the reference. `navigator.platform` is deprecated and
 * is NOT read here (typescript:S1874); the user agent is the supported one. A
 * false negative only prints Ctrl where ⌘ is idiomatic — the chord still
 * works, because `resolveChord` matches `ctrlKey || metaKey`.
 */
export function detectPlatform(userAgent: string | undefined): Platform {
  return /mac/i.test(userAgent ?? "") ? "mac" : "other";
}

/**
 * Display label for a GLOBAL chord under a platform. Honest only for
 * `COMMAND_CHORDS` — see the module note on why component-owned keys are
 * exempt.
 */
export function displayChordLabel(label: string, platform: Platform): string {
  return platform === "mac" ? label.replace(/^Ctrl\+/, "⌘") : label;
}

/** Human names for the commands the global table actually binds. */
const COMMAND_ACTION_LABELS: Partial<Record<MenuAction, string>> = {
  open: "Open a document",
  "toggle-library": "Show or hide the library",
  "prev-page": "Previous page",
  "next-page": "Next page",
};

/**
 * Display-only taxonomy: which section each entry renders under. Binding
 * data (keys, modifiers) always comes from the chord sources — this map only
 * decides grouping, so an unknown future entry lands in "Other" instead of
 * silently disappearing.
 */
const COMMAND_GROUP_BY_ACTION: Partial<Record<MenuAction, string>> = {
  open: "Files & library",
  "toggle-library": "Files & library",
  "prev-page": "Navigation",
  "next-page": "Navigation",
};

const COMPONENT_GROUP_BY_ACTION: Record<string, string> = {
  "Play / Pause TTS": "Playback",
  "Close / stop the innermost open thing": "Reading actions",
  "Highlight the pending selection": "Reading actions",
  "Go to the first page": "Navigation",
  "Go to the last page": "Navigation",
};

const GROUP_ORDER = [
  "Files & library",
  "Navigation",
  "Playback",
  "Reading actions",
  "Other",
] as const;

export interface ShortcutRow {
  label: string;
  keys: string[];
}

export interface ShortcutGroup {
  title: string;
  rows: ShortcutRow[];
}

/**
 * Derive the full displayed chord set for a platform context from the two
 * sources. Same-action global chords merge into one row (Page Up | ←), so a
 * navigation action reads as one line, not three.
 */
export function buildShortcutGroups(platform: Platform): ShortcutGroup[] {
  const rowsByGroup = new Map<string, ShortcutRow[]>();
  const push = (title: string, row: ShortcutRow) => {
    const rows = rowsByGroup.get(title);
    if (!rows) {
      rowsByGroup.set(title, [row]);
      return;
    }
    // Same action in the same group = ONE row carrying its alternative
    // keycaps (Previous page: Page Up | ←; Next page: Page Down | → | Space).
    // Row labels stay unique per group, so `key={row.label}` is a unique,
    // stable React key.
    const existing = rows.find((candidate) => candidate.label === row.label);
    if (existing) existing.keys.push(...row.keys);
    else rows.push(row);
  };
  for (const chord of COMMAND_CHORDS) {
    push(COMMAND_GROUP_BY_ACTION[chord.action] ?? "Other", {
      label: COMMAND_ACTION_LABELS[chord.action] ?? chord.action,
      keys: [displayChordLabel(chord.label, platform)],
    });
  }
  // Component-owned keys stay LITERAL in every platform context: their
  // handlers bind `ctrlKey`, not metaKey (p16 correction).
  for (const chord of COMPONENT_CHORDS) {
    push(COMPONENT_GROUP_BY_ACTION[chord.action] ?? "Other", {
      label: chord.action,
      keys: [...chord.keys],
    });
  }
  return GROUP_ORDER.filter((title) => rowsByGroup.has(title)).map((title) => ({
    title,
    rows: rowsByGroup.get(title) as ShortcutRow[],
  }));
}

export function KeyboardShortcuts() {
  const platform = detectPlatform(
    typeof navigator === "undefined" ? undefined : navigator.userAgent,
  );
  const groups = buildShortcutGroups(platform);
  return (
    <div className="settings-section keyboard-shortcuts">
      <h3 className="settings-section-title">Keyboard Shortcuts</h3>
      <p className="settings-section-description">
        Every binding the reader actually has, grouped by what it does.
        {platform === "mac"
          ? " Global shortcuts accept ⌘ on this Mac; component bindings stay as implemented."
          : " On macOS, global shortcuts also accept ⌘."}
      </p>
      <div className="shortcut-list">
        {groups.map((group) => (
          <section key={group.title} className="shortcut-group">
            <h4 className="shortcut-group-title">{group.title}</h4>
            {group.rows.map((row) => (
              <div
                key={row.label}
                className="shortcut-row"
                data-shortcut-row=""
              >
                <span className="shortcut-action">{row.label}</span>
                <div className="shortcut-keys">
                  {row.keys.map((key) => (
                    <span key={key} className="shortcut-key">
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
