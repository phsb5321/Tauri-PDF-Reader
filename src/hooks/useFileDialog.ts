/**
 * useFileDialog Hook
 *
 * Provides file dialog functionality to UI components without directly
 * coupling them to the adapter layer. This follows hexagonal architecture
 * by acting as a bridge between UI and the FileDialogPort.
 *
 * @module hooks/useFileDialog
 * @feature 007-ui-ux-overhaul (P0-2)
 */

import { useCallback } from "react";
import { fileDialog } from "../adapters/tauri/file-dialog.adapter";
import type {
  OpenDialogOptions,
  SaveDialogOptions,
} from "../ports/file-dialog.port";
export { FILE_FILTERS } from "../ports/file-dialog.port";

/**
 * Hook for file dialog operations.
 *
 * Wraps the FileDialogAdapter to provide a React-friendly interface
 * while keeping UI components decoupled from the adapter layer.
 *
 * @example
 * ```typescript
 * import { useFileDialog, FILE_FILTERS } from '@/hooks/useFileDialog';
 *
 * function MyComponent() {
 *   const { openFile, saveFile } = useFileDialog();
 *
 *   const handleOpen = async () => {
 *     const path = await openFile({
 *       filters: [FILE_FILTERS.PDF],
 *     });
 *     if (path) {
 *       // Handle selected file
 *     }
 *   };
 * }
 * ```
 */
export function useFileDialog() {
  /**
   * Open a file selection dialog
   */
  const openFile = useCallback(
    async (options?: OpenDialogOptions): Promise<string | string[] | null> => {
      // E2E native builds only (VITE_E2E_NATIVE=true, tree-shaken otherwise):
      // the native GTK file dialog is not reachable by WebDriver — the same
      // WebDriver-impossible step the e2e-native bootstrap handles for TTS
      // init and the fixture load. The OBSERVER supplies the chosen path at
      // build time (VITE_E2E_OPEN_PATH); the ACTOR still clicks the real
      // Open control and the real open flow (loadDocument → library →
      // setDocument) runs below the dialog. This is a seam, not a bridge:
      // nothing in the flow is stubbed except the dialog itself.
      if (import.meta.env.VITE_E2E_NATIVE === "true") {
        // The reauthorization picker (issue #120) is distinguished by its
        // title: the observer chooses the OUTCOME (cancel / good / wrong)
        // at build time, the actor still drives the real flow below it.
        if (options?.title?.includes("Reauthorize")) {
          const reauthMode = import.meta.env.VITE_E2E_REAUTH_MODE;
          if (reauthMode === "cancel") return null;
          const reauthPath = import.meta.env.VITE_E2E_REAUTH_PATH;
          if (reauthPath) return reauthPath;
        }
        const e2eOpenPath = import.meta.env.VITE_E2E_OPEN_PATH;
        if (e2eOpenPath) return e2eOpenPath;
      }
      return fileDialog.open(options);
    },
    [],
  );

  /**
   * Open a save file dialog
   */
  const saveFile = useCallback(
    async (options?: SaveDialogOptions): Promise<string | null> => {
      return fileDialog.save(options);
    },
    [],
  );

  return {
    openFile,
    saveFile,
  };
}
