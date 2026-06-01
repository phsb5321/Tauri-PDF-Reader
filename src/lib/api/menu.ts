/**
 * Menu Action Event API
 *
 * Subscribes to the backend `"menu-action"` event emitted by the native
 * application menu (File / View / Playback / Help). On Linux the menu is
 * exported over AT-SPI to a global menu bar (e.g. noctalia-appmenu); on
 * macOS/Windows it is the native menu bar. Each menu item emits its id as the
 * event payload.
 *
 * Wrapping `listen()` here keeps hook/UI code off the raw Tauri event import,
 * consistent with the other `src/lib/api/*` event wrappers (e.g. ai-tts).
 *
 * Backend emitter: `src-tauri/src/lib.rs` — `app.on_menu_event` ->
 * `app.emit("menu-action", <id>)`.
 *
 * @module lib/api/menu
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Menu item ids emitted by the native menu. Must stay in sync with the
 * `on_menu_event` match arms in `src-tauri/src/lib.rs`.
 */
export type MenuAction =
  | "open"
  | "settings"
  | "toggle-library"
  | "toggle-highlights"
  | "find"
  | "play-pause"
  | "prev-page"
  | "next-page";

/**
 * Subscribe to native menu activations.
 *
 * @param callback Invoked with the activated menu action id.
 * @returns A promise resolving to an unlisten function; call it to unsubscribe.
 */
export function onMenuAction(
  callback: (action: MenuAction) => void,
): Promise<UnlistenFn> {
  return listen<string>("menu-action", (event) =>
    callback(event.payload as MenuAction),
  );
}
