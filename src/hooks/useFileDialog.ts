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
