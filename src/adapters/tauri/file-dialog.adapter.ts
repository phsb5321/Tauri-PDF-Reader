/**
 * TauriFileDialogAdapter
 *
 * Implements FileDialogPort using @tauri-apps/plugin-dialog.
 * This adapter wraps the Tauri dialog plugin to maintain hexagonal architecture.
 *
 * @module adapters/tauri/file-dialog.adapter
 * @feature 007-ui-ux-overhaul (P0-2)
 */

import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  FileDialogPort,
  OpenDialogOptions,
  SaveDialogOptions,
  FileFilter,
} from "../../ports/file-dialog.port";

/**
 * Convert FileFilter to Tauri's DialogFilter format.
 * Ensures extensions array is mutable (not readonly).
 */
function toDialogFilters(
  filters?: FileFilter[],
): { name: string; extensions: string[] }[] | undefined {
  if (!filters) return undefined;
  return filters.map((f) => ({
    name: f.name,
    extensions: [...f.extensions], // Convert readonly array to mutable
  }));
}

/**
 * Tauri implementation of FileDialogPort using the dialog plugin.
 */
export class TauriFileDialogAdapter implements FileDialogPort {
  /**
   * Open a file selection dialog
   */
  async open(options?: OpenDialogOptions): Promise<string | string[] | null> {
    const result = await open({
      title: options?.title,
      filters: toDialogFilters(options?.filters),
      defaultPath: options?.defaultPath,
      multiple: options?.multiple,
      directory: options?.directory,
    });
    return result;
  }

  /**
   * Open a save file dialog
   */
  async save(options?: SaveDialogOptions): Promise<string | null> {
    const result = await save({
      title: options?.title,
      filters: toDialogFilters(options?.filters),
      defaultPath: options?.defaultPath,
    });
    return result;
  }
}

/**
 * Singleton instance for use across the application.
 * Import this instance rather than creating new adapter instances.
 *
 * @example
 * ```typescript
 * import { fileDialog } from '@/adapters/tauri/file-dialog.adapter';
 *
 * const path = await fileDialog.open({
 *   title: 'Select PDF',
 *   filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
 * });
 * ```
 */
export const fileDialog = new TauriFileDialogAdapter();
