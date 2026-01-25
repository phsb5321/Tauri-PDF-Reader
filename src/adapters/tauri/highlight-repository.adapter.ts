/**
 * TauriHighlightRepository
 *
 * Implements HighlightRepositoryPort using type-safe tauri-specta generated bindings.
 * All IPC calls are type-checked at compile time.
 */

import type {
  BatchCreateResponse,
  DeleteResponse,
  ExportFormat,
  ExportResponse,
  Highlight,
  HighlightCreate,
  HighlightRepositoryPort,
  HighlightUpdate,
} from '../../ports/highlight-repository.port';
import {
  commands,
  type Highlight as BindingHighlight,
  type CreateHighlightInput,
} from '../../lib/bindings';

/**
 * Helper to unwrap Result type from tauri-specta
 */
function unwrapResult<T>(result: { status: 'ok'; data: T } | { status: 'error'; error: string }): T {
  if (result.status === 'error') {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * Map binding Highlight to port Highlight (types should be identical)
 */
function mapHighlight(h: BindingHighlight): Highlight {
  return h as Highlight;
}

/**
 * Map port HighlightCreate to binding CreateHighlightInput
 */
function mapCreateInput(input: HighlightCreate): CreateHighlightInput {
  return {
    documentId: input.documentId,
    pageNumber: input.pageNumber,
    rects: input.rects,
    color: input.color,
    textContent: input.textContent ?? null,
  };
}

/**
 * Tauri implementation of HighlightRepositoryPort using generated type-safe bindings.
 */
export class TauriHighlightRepository implements HighlightRepositoryPort {
  async create(input: HighlightCreate): Promise<Highlight> {
    const result = await commands.highlightsCreate(
      input.documentId,
      input.pageNumber,
      input.rects,
      input.color,
      input.textContent ?? null
    );
    return mapHighlight(unwrapResult(result));
  }

  async batchCreate(inputs: HighlightCreate[]): Promise<BatchCreateResponse> {
    const bindingInputs = inputs.map(mapCreateInput);
    const result = await commands.highlightsBatchCreate(bindingInputs);
    const response = unwrapResult(result);
    return {
      highlights: response.highlights.map(mapHighlight),
      created: response.created,
    };
  }

  async getById(id: string): Promise<Highlight | null> {
    try {
      const result = await commands.highlightsGet(id);
      return mapHighlight(unwrapResult(result));
    } catch {
      // Not found returns error, treat as null
      return null;
    }
  }

  async listForPage(documentId: string, pageNumber: number): Promise<Highlight[]> {
    const result = await commands.highlightsListForPage(documentId, pageNumber);
    const response = unwrapResult(result);
    return response.highlights.map(mapHighlight);
  }

  async listForDocument(documentId: string): Promise<Highlight[]> {
    const result = await commands.highlightsListForDocument(documentId);
    const response = unwrapResult(result);
    return response.highlights.map(mapHighlight);
  }

  async update(id: string, input: HighlightUpdate): Promise<Highlight> {
    const result = await commands.highlightsUpdate(
      id,
      input.color ?? null,
      input.note ?? null
    );
    return mapHighlight(unwrapResult(result));
  }

  async delete(id: string): Promise<void> {
    const result = await commands.highlightsDelete(id);
    unwrapResult(result);
  }

  async deleteForDocument(documentId: string): Promise<DeleteResponse> {
    const result = await commands.highlightsDeleteForDocument(documentId);
    return unwrapResult(result) as DeleteResponse;
  }

  async export(documentId: string, format: ExportFormat): Promise<ExportResponse> {
    const result = await commands.highlightsExport(documentId, format);
    return unwrapResult(result) as ExportResponse;
  }
}
