/**
 * App-close flush protocol (slice 112 DL-1/DL-2).
 *
 * The backend's CloseRequested handler prevents the close, emits
 * `app-close-requested`, waits (with a 3s timeout) for `app-close-ack`, then
 * destroys the window. The frontend listens here, flushes every debounced
 * writer (highlights, reading position), and acks. Without the ack the
 * backend closes anyway — a hung renderer never strands the user.
 */

import { listen, emit, type UnlistenFn } from "@tauri-apps/api/event";

/** Subscribe to the backend's close-requested broadcast. */
export function onAppCloseRequested(
  callback: () => void,
): Promise<UnlistenFn> {
  return listen("app-close-requested", () => callback());
}

/** Tell the backend the flush is complete; it may destroy the window. */
export function emitAppCloseAck(): Promise<void> {
  return emit("app-close-ack");
}
