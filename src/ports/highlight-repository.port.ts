/**
 * HighlightRepositoryPort
 *
 * Manages highlight persistence operations.
 * Implemented by: TauriHighlightRepository, MockHighlightRepository
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Highlight {
  id: string;
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface HighlightCreate {
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent?: string;
}

export interface HighlightUpdate {
  color?: string;
  note?: string | null;
}

export interface BatchCreateResponse {
  highlights: Highlight[];
  created: number;
}

export interface DeleteResponse {
  success: boolean;
  deleted: number | null;
}

export interface ExportResponse {
  content: string;
  filename: string;
}

export type ExportFormat = 'markdown' | 'json' | 'text';

export interface HighlightRepositoryPort {
  /**
   * Create a new highlight
   */
  create(input: HighlightCreate): Promise<Highlight>;

  /**
   * Create multiple highlights in a batch
   */
  batchCreate(inputs: HighlightCreate[]): Promise<BatchCreateResponse>;

  /**
   * Get a highlight by ID
   */
  getById(id: string): Promise<Highlight | null>;

  /**
   * List all highlights for a specific page
   */
  listForPage(documentId: string, pageNumber: number): Promise<Highlight[]>;

  /**
   * List all highlights for a document
   */
  listForDocument(documentId: string): Promise<Highlight[]>;

  /**
   * Update a highlight's color or note
   */
  update(id: string, input: HighlightUpdate): Promise<Highlight>;

  /**
   * Delete a highlight
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all highlights for a document
   */
  deleteForDocument(documentId: string): Promise<DeleteResponse>;

  /**
   * Export highlights in various formats
   */
  export(documentId: string, format: ExportFormat): Promise<ExportResponse>;
}
