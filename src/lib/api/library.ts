/**
 * Library API
 *
 * Tauri commands for document library management.
 */

import { invoke } from '@tauri-apps/api/core';
import type { Document, FileExistsResponse } from '../schemas';

export async function libraryAddDocument(
  filePath: string,
  title?: string,
  pageCount?: number
): Promise<Document> {
  return invoke('library_add_document', { filePath, title, pageCount });
}

export async function libraryGetDocument(id: string): Promise<Document | null> {
  return invoke('library_get_document', { id });
}

export async function libraryGetDocumentByPath(filePath: string): Promise<Document | null> {
  return invoke('library_get_document_by_path', { filePath });
}

export async function libraryListDocuments(
  orderBy: 'last_opened' | 'created' | 'title' = 'last_opened',
  limit?: number,
  offset?: number
): Promise<Document[]> {
  return invoke('library_list_documents', { orderBy, limit, offset });
}

export async function libraryUpdateProgress(
  id: string,
  currentPage: number,
  scrollPosition?: number,
  lastTtsChunkId?: string
): Promise<Document> {
  return invoke('library_update_progress', {
    id,
    currentPage,
    scrollPosition,
    lastTtsChunkId,
  });
}

export async function libraryUpdateDocument(
  id: string,
  updates: { title?: string; pageCount?: number; fileHash?: string }
): Promise<void> {
  return invoke('library_update_document', { id, ...updates });
}

export async function libraryUpdateTitle(id: string, title: string): Promise<Document> {
  return invoke('library_update_title', { id, title });
}

export async function libraryRelocateDocument(
  id: string,
  newFilePath: string
): Promise<Document> {
  return invoke('library_relocate_document', { id, newFilePath });
}

export async function libraryRemoveDocument(id: string): Promise<void> {
  return invoke('library_remove_document', { id });
}

export async function libraryOpenDocument(id: string): Promise<Document> {
  return invoke('library_open_document', { id });
}

export async function libraryCheckFileExists(id: string): Promise<FileExistsResponse> {
  return invoke('library_check_file_exists', { id });
}
