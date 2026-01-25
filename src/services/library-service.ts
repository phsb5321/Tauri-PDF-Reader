import { invoke } from '@tauri-apps/api/core';
import type { Document } from '../lib/schemas';

export interface AddDocumentOptions {
  filePath: string;
  title?: string;
  pageCount?: number;
}

export interface UpdateDocumentOptions {
  id: string;
  title?: string;
  pageCount?: number;
  fileHash?: string;
}

export interface ListDocumentsOptions {
  orderBy?: 'recent' | 'created' | 'title';
  limit?: number;
  offset?: number;
}

/**
 * Library service for managing PDF documents in the database
 */
export const libraryService = {
  /**
   * Add a new document to the library
   */
  async addDocument(options: AddDocumentOptions): Promise<Document> {
    // Tauri expects snake_case parameter names matching Rust function signatures
    return invoke<Document>('library_add_document', {
      file_path: options.filePath,
      title: options.title,
      page_count: options.pageCount,
    });
  },

  /**
   * Get a document by ID
   */
  async getDocument(id: string): Promise<Document | null> {
    return invoke<Document | null>('library_get_document', { id });
  },

  /**
   * Get a document by file path
   */
  async getDocumentByPath(filePath: string): Promise<Document | null> {
    // Tauri expects snake_case parameter names matching Rust function signatures
    return invoke<Document | null>('library_get_document_by_path', { file_path: filePath });
  },

  /**
   * Update reading progress for a document
   */
  async updateProgress(id: string, currentPage: number): Promise<void> {
    // Tauri expects snake_case parameter names matching Rust function signatures
    return invoke<void>('library_update_progress', { id, current_page: currentPage });
  },

  /**
   * Update document metadata
   */
  async updateDocument(options: UpdateDocumentOptions): Promise<void> {
    // Tauri expects snake_case parameter names matching Rust function signatures
    return invoke<void>('library_update_document', {
      id: options.id,
      title: options.title,
      page_count: options.pageCount,
      file_hash: options.fileHash,
    });
  },

  /**
   * List all documents in the library
   */
  async listDocuments(options: ListDocumentsOptions = {}): Promise<Document[]> {
    // Tauri expects snake_case parameter names matching Rust function signatures
    return invoke<Document[]>('library_list_documents', {
      order_by: options.orderBy,
      limit: options.limit,
      offset: options.offset,
    });
  },

  /**
   * Remove a document from the library
   */
  async removeDocument(id: string): Promise<void> {
    return invoke<void>('library_remove_document', { id });
  },

  /**
   * Mark a document as opened (updates last_opened_at)
   */
  async openDocument(id: string): Promise<Document> {
    return invoke<Document>('library_open_document', { id });
  },

  /**
   * Check if a document's file still exists on disk
   */
  async checkFileExists(id: string): Promise<boolean> {
    return invoke<boolean>('library_check_file_exists', { id });
  },
};
