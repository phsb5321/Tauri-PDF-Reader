/**
 * useCommandKeys Hook
 *
 * The keyboard as a second way into the command set the native menu already
 * uses. There is no separate keyboard command list: a chord resolves to a
 * {@link MenuAction} id and is handed to {@link dispatchMenuAction}, the same
 * pure lookup the `"menu-action"` event goes through. Mount it beside
 * `useMenuActions` with the *same* handlers object and the two surfaces cannot
 * drift, because they are calling the same function references.
 *
 * Two kinds of key deliberately stay out of this table:
 *
 * - Keys a focused component owns for a narrower job — `Escape` (dismiss the
 *   highlight toolbar / the context menu / active playback) and `Ctrl+Shift+H`
 *   (highlight the pending selection). A window-level listener cannot express
 *   "close the innermost open thing".
 * - `Ctrl+Space` for play/pause. `AiPlaybackBar` already binds it, and its
 *   handler can *start* playback from idle, which the menu's play/pause handler
 *   cannot. Adding a second binding would toggle twice per press and would
 *   downgrade the behaviour. It moves here when the richer handler does.
 *
 * @module hooks/useCommandKeys
 */

import { useEffect, useRef } from "react";
import type { MenuAction } from "../lib/api/menu";
import { dispatchMenuAction, type MenuActionHandlers } from "./useMenuActions";

/**
 * One key binding: a `KeyboardEvent.key` value plus whether the primary
 * modifier is required. Matching is exact — a chord declared without `ctrl`
 * does not fire when Ctrl is held, so a future `Ctrl+ArrowRight` cannot be
 * swallowed by the plain `ArrowRight` binding.
 */
export interface Chord {
  /** The command this chord runs. Same id space as the native menu. */
  readonly action: MenuAction;
  /** `KeyboardEvent.key`, compared case-insensitively. */
  readonly key: string;
  /** Requires Ctrl (or Cmd on macOS). */
  readonly ctrl: boolean;
  /** How the chord is written for a human. */
  readonly label: string;
}

/**
 * Every keyboard binding the application has, and therefore every one it may
 * advertise. A command with no destination gets no entry: an inert shortcut is
 * indistinguishable from a broken one, so the honest form of "not built yet" is
 * silence rather than a key that swallows itself.
 *
 * That is why `settings`, `toggle-library`, `toggle-highlights` and `find` are
 * absent — they have no panel to open. Their menu items remain, already
 * documented as inert in `useMenuActions`.
 */
export const COMMAND_CHORDS: readonly Chord[] = [
  { action: "open", key: "o", ctrl: true, label: "Ctrl+O" },
  { action: "prev-page", key: "PageUp", ctrl: false, label: "Page Up" },
  { action: "prev-page", key: "ArrowLeft", ctrl: false, label: "←" },
  { action: "next-page", key: "PageDown", ctrl: false, label: "Page Down" },
  { action: "next-page", key: "ArrowRight", ctrl: false, label: "→" },
] as const;

/** True when the event came from somewhere the user is typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Match a keyboard event against {@link COMMAND_CHORDS}.
 *
 * Pure and synchronous — the whole matching rule lives here so it can be tested
 * without a DOM listener.
 *
 * An unmodified chord is suppressed while the user is typing, because the text
 * field owns those keys: `PageDown` in a textarea scrolls the textarea. A
 * modified chord is not suppressed — no text field claims `Ctrl+O`, and a
 * reader who wants to open a document should not have to click away from the
 * search box first.
 *
 * @returns the command id, or `null` when nothing matches.
 */
export function resolveChord(event: KeyboardEvent): MenuAction | null {
  // Shift and Alt are not part of any chord here. Requiring them to be absent
  // keeps Ctrl+Shift+H (owned by the highlight handler) from matching a future
  // plain Ctrl+H, rather than relying on that binding never being added.
  if (event.shiftKey || event.altKey) return null;

  const ctrlHeld = event.ctrlKey || event.metaKey;
  const typing = isTypingTarget(event.target);
  const key = event.key.toLowerCase();

  for (const chord of COMMAND_CHORDS) {
    if (chord.ctrl !== ctrlHeld) continue;
    if (chord.key.toLowerCase() !== key) continue;
    if (typing && !chord.ctrl) return null;
    return chord.action;
  }
  return null;
}

/**
 * Bind {@link COMMAND_CHORDS} to `handlers` for the lifetime of the component.
 *
 * The listener is registered exactly once and reads `handlers` through a ref,
 * so a handler that changes between renders is still the one that runs — the
 * same stale-closure guard `useMenuActions` uses, for the same reason.
 *
 * A chord with no handler in `handlers` is a no-op: `dispatchMenuAction`
 * reports it and this hook has nothing to add. `preventDefault` is called only
 * once a chord has matched, so keys this app does not bind behave normally.
 */
export function useCommandKeys(handlers: MenuActionHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolveChord(event);
      if (!action) return;
      event.preventDefault();
      dispatchMenuAction(action, handlersRef.current);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
