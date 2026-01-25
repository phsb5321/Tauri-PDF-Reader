/**
 * Highlights API
 *
 * Tauri commands for highlight CRUD operations and export.
 */

import { invoke } from '@tauri-apps/api/core';
import type { Highlight, Rect, ListHighlightsResponse, DeleteResponse, ExportResponse } from '../schemas';

export interface CreateHighlightInput {
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent?: string;
}

export async function highlightsCreate(input: CreateHighlightInput): Promise<Highlight> {
  return invoke('highlights_create', { ...input });
}

export async function highlightsBatchCreate(
  highlights: CreateHighlightInput[]
): Promise<{ highlights: Highlight[]; created: number }> {
  return invoke('highlights_batch_create', { highlights });
}

export async function highlightsGet(id: string): Promise<Highlight> {
  return invoke('highlights_get', { id });
}

export async function highlightsListForDocument(
  documentId: string
): Promise<ListHighlightsResponse> {
  return invoke('highlights_list_for_document', { documentId });
}

export async function highlightsListForPage(
  documentId: string,
  pageNumber: number
): Promise<ListHighlightsResponse> {
  return invoke('highlights_list_for_page', { documentId, pageNumber });
}

export async function highlightsUpdate(
  id: string,
  updates: { color?: string; note?: string | null }
): Promise<Highlight> {
  return invoke('highlights_update', { id, ...updates });
}

export async function highlightsDelete(id: string): Promise<DeleteResponse> {
  return invoke('highlights_delete', { id });
}

export async function highlightsDeleteForDocument(
  documentId: string
): Promise<DeleteResponse> {
  return invoke('highlights_delete_for_document', { documentId });
}

export async function highlightsExport(
  documentId: string,
  format: 'markdown' | 'json'
): Promise<ExportResponse> {
  return invoke('highlights_export', { documentId, format });
}
