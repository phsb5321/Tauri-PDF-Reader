/**
 * useMenuActions Hook
 *
 * Subscribes once to the native `"menu-action"` event and dispatches each
 * activation to a caller-supplied handler. Mount it at a single stable point
 * in the tree (e.g. `ReaderView`) so there is exactly one subscription for the
 * app's lifetime.
 *
 * Actions with no handler are inert (a no-op). Today `toggle-highlights` and
 * `find` have no UI to drive, so their menu items do nothing until those panels
 * exist.
 *
 * @module hooks/useMenuActions
 */

import { useEffect, useRef } from "react";
import { onMenuAction, type MenuAction } from "../lib/api/menu";

/**
 * Handlers for native menu activations. Each is optional; an action without a
 * handler is silently ignored.
 */
export interface MenuActionHandlers {
  onOpen?: () => void;
  onSettings?: () => void;
  onToggleLibrary?: () => void;
  onToggleHighlights?: () => void;
  onFind?: () => void;
  onPlayPause?: () => void;
  onPrevPage?: () => void;
  onNextPage?: () => void;
}

/**
 * Map a menu action id to its handler and invoke it. Pure and synchronous —
 * exported for unit testing.
 *
 * @returns `true` if a handler was found and invoked, `false` otherwise.
 */
export function dispatchMenuAction(
  action: MenuAction,
  handlers: MenuActionHandlers,
): boolean {
  const byAction: Record<MenuAction, (() => void) | undefined> = {
    open: handlers.onOpen,
    settings: handlers.onSettings,
    "toggle-library": handlers.onToggleLibrary,
    "toggle-highlights": handlers.onToggleHighlights,
    find: handlers.onFind,
    "play-pause": handlers.onPlayPause,
    "prev-page": handlers.onPrevPage,
    "next-page": handlers.onNextPage,
  };

  const handler = byAction[action];
  if (handler) {
    handler();
    return true;
  }
  return false;
}

/**
 * Subscribe once to `"menu-action"` events and dispatch to `handlers`.
 *
 * The latest `handlers` are read through a ref, so the subscription is created
 * exactly once (empty dependency list) yet always dispatches to current
 * callbacks — no stale closures, no churn from re-subscribing each render.
 */
export function useMenuActions(handlers: MenuActionHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let mounted = true;
    let unlisten: UnlistenFnLike | undefined;

    onMenuAction((action) => {
      if (mounted) {
        dispatchMenuAction(action, handlersRef.current);
      }
    })
      .then((fn) => {
        if (mounted) {
          unlisten = fn;
        } else {
          // Unmounted before the subscription resolved — drop it immediately.
          fn();
        }
      })
      .catch((error) => {
        console.error("Failed to subscribe to menu-action events:", error);
      });

    return () => {
      mounted = false;
      if (unlisten) {
        try {
          unlisten();
        } catch (error) {
          console.error("Error unsubscribing from menu-action:", error);
        }
      }
    };
  }, []);
}

/** Minimal shape of the Tauri unlisten function. */
type UnlistenFnLike = () => void;
