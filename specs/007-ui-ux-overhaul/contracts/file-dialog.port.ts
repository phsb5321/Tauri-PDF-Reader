/**
 * FileDialogPort - Interface for file dialog operations
 *
 * @module ports/file-dialog.port
 * @feature 007-ui-ux-overhaul (P0-2)
 *
 * This port abstracts the @tauri-apps/plugin-dialog functionality
 * to maintain hexagonal architecture. Components should use the
 * adapter implementation, not the plugin directly.
 *
 * @example
 * ```typescript
 * // In component or hook
 * import { useFileDialog } from '@/adapters/tauri/file-dialog.adapter';
 *
 * const { openFile, saveFile } = useFileDialog();
 * const path = await openFile({ filters: [{ name: 'PDF', extensions: ['pdf'] }] });
 * ```
 */

/**
 * File type filter for dialog
 */
export interface FileFilter {
  /** Display name (e.g., "PDF Documents") */
  name: string;

  /** File extensions without dot (e.g., ["pdf", "PDF"]) */
  extensions: string[];
}

/**
 * Options for opening files
 */
export interface OpenDialogOptions {
  /** Dialog window title */
  title?: string;

  /** File type filters */
  filters?: FileFilter[];

  /** Starting directory path */
  defaultPath?: string;

  /** Allow selecting multiple files */
  multiple?: boolean;

  /** Allow selecting directories instead of files */
  directory?: boolean;
}

/**
 * Options for saving files
 */
export interface SaveDialogOptions {
  /** Dialog window title */
  title?: string;

  /** File type filters */
  filters?: FileFilter[];

  /** Default file name or full path */
  defaultPath?: string;
}

/**
 * File dialog port interface
 *
 * Implementations:
 * - TauriFileDialogAdapter (production): src/adapters/tauri/file-dialog.adapter.ts
 * - MockFileDialogAdapter (testing): src/adapters/mock/file-dialog.adapter.ts
 */
export interface FileDialogPort {
  /**
   * Open a file selection dialog
   *
   * @param options - Dialog configuration
   * @returns Selected path(s) or null if cancelled
   *
   * @example
   * ```typescript
   * // Single file
   * const path = await fileDialog.open({ title: 'Select PDF' });
   * if (path) loadDocument(path as string);
   *
   * // Multiple files
   * const paths = await fileDialog.open({ multiple: true });
   * if (paths) paths.forEach(p => addToQueue(p));
   * ```
   */
  open(options?: OpenDialogOptions): Promise<string | string[] | null>;

  /**
   * Open a save file dialog
   *
   * @param options - Dialog configuration
   * @returns Selected save path or null if cancelled
   *
   * @example
   * ```typescript
   * const savePath = await fileDialog.save({
   *   title: 'Export Highlights',
   *   defaultPath: 'highlights.json',
   *   filters: [{ name: 'JSON', extensions: ['json'] }]
   * });
   * if (savePath) await exportHighlights(savePath);
   * ```
   */
  save(options?: SaveDialogOptions): Promise<string | null>;
}

/**
 * Common file filters for reuse
 */
export const FILE_FILTERS = {
  PDF: { name: "PDF Documents", extensions: ["pdf"] },
  JSON: { name: "JSON Files", extensions: ["json"] },
  TEXT: { name: "Text Files", extensions: ["txt"] },
  AUDIO: { name: "Audio Files", extensions: ["mp3", "wav", "ogg"] },
  ALL: { name: "All Files", extensions: ["*"] },
} as const;
