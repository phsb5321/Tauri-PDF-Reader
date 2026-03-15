/**
 * FileDialogPort
 *
 * Interface for file dialog operations (open/save).
 * This port abstracts the @tauri-apps/plugin-dialog functionality
 * to maintain hexagonal architecture compliance.
 *
 * Implemented by: TauriFileDialogAdapter, MockFileDialogAdapter
 *
 * @module ports/file-dialog.port
 * @feature 007-ui-ux-overhaul (P0-2)
 */

/**
 * File type filter for dialog
 */
export interface FileFilter {
  /** Display name (e.g., "PDF Documents") */
  name: string;

  /** File extensions without dot (e.g., ["pdf", "PDF"]) */
  extensions: readonly string[] | string[];
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
 */
export interface FileDialogPort {
  /**
   * Open a file selection dialog
   *
   * @param options - Dialog configuration
   * @returns Selected path(s) or null if cancelled
   */
  open(options?: OpenDialogOptions): Promise<string | string[] | null>;

  /**
   * Open a save file dialog
   *
   * @param options - Dialog configuration
   * @returns Selected save path or null if cancelled
   */
  save(options?: SaveDialogOptions): Promise<string | null>;
}

/**
 * Common file filters for reuse across the application
 */
export const FILE_FILTERS = {
  PDF: { name: "PDF Documents", extensions: ["pdf"] },
  JSON: { name: "JSON Files", extensions: ["json"] },
  TEXT: { name: "Text Files", extensions: ["txt"] },
  MARKDOWN: { name: "Markdown Files", extensions: ["md"] },
  MP3: { name: "MP3 Audio", extensions: ["mp3"] },
  M4B: { name: "M4B Audiobook", extensions: ["m4b"] },
  AUDIO: { name: "Audio Files", extensions: ["mp3", "wav", "ogg"] },
  ALL: { name: "All Files", extensions: ["*"] },
} as const;
