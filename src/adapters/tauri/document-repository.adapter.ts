/**
 * TauriDocumentRepository
 *
 * Implements DocumentRepositoryPort using type-safe tauri-specta generated bindings.
 * All IPC calls are type-checked at compile time.
 */

import type {
  Document,
  DocumentRepositoryPort,
  FileExistsResponse,
  OrderBy,
} from '../../ports/document-repository.port';
import { commands, type Document as BindingDocument } from '../../lib/bindings';

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
 * Map binding Document to port Document (types should be identical)
 */
function mapDocument(doc: BindingDocument): Document {
  return doc as Document;
}

/**
 * Tauri implementation of DocumentRepositoryPort using generated type-safe bindings.
 */
export class TauriDocumentRepository implements DocumentRepositoryPort {
  async add(
    filePath: string,
    title?: string,
    pageCount?: number
  ): Promise<Document> {
    const result = await commands.libraryAddDocument(
      filePath,
      title ?? null,
      pageCount ?? null
    );
    return mapDocument(unwrapResult(result));
  }

  async getById(id: string): Promise<Document | null> {
    const result = await commands.libraryGetDocument(id);
    const doc = unwrapResult(result);
    return doc ? mapDocument(doc) : null;
  }

  async getByPath(filePath: string): Promise<Document | null> {
    const result = await commands.libraryGetDocumentByPath(filePath);
    const doc = unwrapResult(result);
    return doc ? mapDocument(doc) : null;
  }

  async list(
    orderBy?: OrderBy,
    limit?: number,
    offset?: number
  ): Promise<Document[]> {
    const result = await commands.libraryListDocuments(
      orderBy ?? null,
      limit ?? null,
      offset ?? null
    );
    const docs = unwrapResult(result);
    return docs.map(mapDocument);
  }

  async updateProgress(
    id: string,
    page: number,
    scroll?: number,
    ttsChunkId?: string
  ): Promise<Document> {
    const result = await commands.libraryUpdateProgress(
      id,
      page,
      scroll ?? null,
      ttsChunkId ?? null
    );
    return mapDocument(unwrapResult(result));
  }

  async updateTitle(id: string, title: string): Promise<Document> {
    const result = await commands.libraryUpdateTitle(id, title);
    return mapDocument(unwrapResult(result));
  }

  async relocate(id: string, newPath: string): Promise<Document> {
    const result = await commands.libraryRelocateDocument(id, newPath);
    return mapDocument(unwrapResult(result));
  }

  async remove(id: string): Promise<void> {
    const result = await commands.libraryRemoveDocument(id);
    unwrapResult(result);
  }

  async checkFileExists(filePath: string): Promise<FileExistsResponse> {
    // Note: The binding command uses document ID, but our port expects filePath
    // We need to get the document by path first, then check
    const doc = await this.getByPath(filePath);
    if (!doc) {
      return { exists: false, filePath };
    }
    const result = await commands.libraryCheckFileExists(doc.id);
    return unwrapResult(result) as FileExistsResponse;
  }
}
