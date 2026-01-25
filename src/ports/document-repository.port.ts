/**
 * DocumentRepositoryPort
 *
 * Manages document persistence operations.
 * Implemented by: TauriDocumentRepository, MockDocumentRepository
 */

export interface Document {
  id: string;
  filePath: string;
  title: string | null;
  pageCount: number | null;
  currentPage: number;
  scrollPosition: number;
  lastTtsChunkId: string | null;
  lastOpenedAt: string | null;
  fileHash: string | null;
  createdAt: string;
}

export interface FileExistsResponse {
  exists: boolean;
  filePath: string;
}

export type OrderBy = 'last_opened' | 'created' | 'title';

export interface DocumentRepositoryPort {
  /**
   * Add a new document to the library
   */
  add(filePath: string, title?: string, pageCount?: number): Promise<Document>;

  /**
   * Get a document by its content-hash ID
   */
  getById(id: string): Promise<Document | null>;

  /**
   * Get a document by its file path
   */
  getByPath(filePath: string): Promise<Document | null>;

  /**
   * List all documents with optional ordering and pagination
   */
  list(orderBy?: OrderBy, limit?: number, offset?: number): Promise<Document[]>;

  /**
   * Update reading progress for a document
   */
  updateProgress(
    id: string,
    page: number,
    scroll?: number,
    ttsChunkId?: string
  ): Promise<Document>;

  /**
   * Update document title
   */
  updateTitle(id: string, title: string): Promise<Document>;

  /**
   * Relocate a document to a new file path
   */
  relocate(id: string, newPath: string): Promise<Document>;

  /**
   * Remove a document from the library
   */
  remove(id: string): Promise<void>;

  /**
   * Check if a file exists at the given path
   */
  checkFileExists(filePath: string): Promise<FileExistsResponse>;
}
