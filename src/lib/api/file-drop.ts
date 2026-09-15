import { getCurrentWebview, type DragDropEvent } from "@tauri-apps/api/webview";
import type { UnlistenFn } from "@tauri-apps/api/event";

export type NativeFileDropEvent = DragDropEvent;

/**
 * Subscribe to Tauri's native file drag/drop stream.
 *
 * Kept at the API boundary so the UI never reaches into a Tauri object. The
 * returned unlistener is mandatory: React StrictMode mounts effects twice in
 * development, and a leaked first listener would create two sessions for one
 * physical drop.
 */
export function onNativeFileDrop(
  handler: (event: NativeFileDropEvent) => void,
): Promise<UnlistenFn> {
  const metadata = (
    window as typeof window & {
      __TAURI_INTERNALS__?: {
        metadata?: {
          currentWindow?: { label?: string };
          currentWebview?: { label?: string };
        };
      };
    }
  ).__TAURI_INTERNALS__?.metadata;
  if (!metadata?.currentWindow?.label || !metadata.currentWebview?.label) {
    return Promise.resolve(() => {});
  }
  return getCurrentWebview().onDragDropEvent(({ payload }) => handler(payload));
}
