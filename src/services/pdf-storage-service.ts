/**
 * PDF Storage Service
 * Manages copying PDF files to the app's local data directory for persistence
 * and consistent access across sessions.
 */

import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { readFile, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';

const PDF_STORAGE_DIR = 'pdfs';

/**
 * Get the path to the PDF storage directory
 */
async function getStorageDir(): Promise<string> {
  const appDir = await appLocalDataDir();
  return join(appDir, PDF_STORAGE_DIR);
}

/**
 * Ensure the PDF storage directory exists
 */
async function ensureStorageDir(): Promise<string> {
  const storageDir = await getStorageDir();

  if (!(await exists(storageDir))) {
    await mkdir(storageDir, { recursive: true });
    console.log('[PDF Storage] Created storage directory:', storageDir);
  }

  return storageDir;
}

/**
 * Generate a unique filename for a PDF based on its original path
 */
function generateStoredFilename(originalPath: string): string {
  // Extract filename from path
  const parts = originalPath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1];

  // Add timestamp to ensure uniqueness
  const timestamp = Date.now();
  const baseName = filename.replace(/\.pdf$/i, '');

  return `${baseName}_${timestamp}.pdf`;
}

/**
 * Copy a PDF file to the app's storage directory
 * Returns the new path to the stored file
 */
export async function copyPdfToStorage(sourcePath: string): Promise<string> {
  console.log('[PDF Storage] Copying PDF to storage:', sourcePath);

  try {
    // Ensure storage directory exists
    const storageDir = await ensureStorageDir();

    // Read the source file
    const fileData = await readFile(sourcePath);
    console.log('[PDF Storage] Read source file, size:', fileData.byteLength, 'bytes');

    // Generate destination filename
    const storedFilename = generateStoredFilename(sourcePath);
    const destPath = await join(storageDir, storedFilename);

    // Write to storage
    await writeFile(destPath, fileData);
    console.log('[PDF Storage] Copied to:', destPath);

    return destPath;
  } catch (error) {
    console.error('[PDF Storage] Failed to copy PDF:', error);
    throw error;
  }
}

/**
 * Check if a PDF exists in storage by its stored path
 */
export async function pdfExistsInStorage(storedPath: string): Promise<boolean> {
  try {
    return await exists(storedPath);
  } catch {
    return false;
  }
}

/**
 * Get the storage directory path (for diagnostics)
 */
export async function getStoragePath(): Promise<string> {
  return getStorageDir();
}

/**
 * Read a PDF from storage
 */
export async function readPdfFromStorage(storedPath: string): Promise<Uint8Array> {
  return readFile(storedPath);
}
