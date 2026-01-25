import type {
  Document,
  DocumentRepositoryPort,
  FileExistsResponse,
  OrderBy,
} from '../../ports/document-repository.port';

/**
 * Mock implementation of DocumentRepositoryPort for testing.
 * Stores documents in memory.
 */
export class MockDocumentRepository implements DocumentRepositoryPort {
  private documents = new Map<string, Document>();
  private idCounter = 1;

  async add(
    filePath: string,
    title?: string,
    pageCount?: number
  ): Promise<Document> {
    const id = `doc-${this.idCounter++}`;
    const now = new Date().toISOString();
    const doc: Document = {
      id,
      filePath,
      title: title ?? null,
      pageCount: pageCount ?? null,
      currentPage: 1,
      scrollPosition: 0,
      lastTtsChunkId: null,
      lastOpenedAt: now,
      fileHash: `hash-${id}`,
      createdAt: now,
    };
    this.documents.set(id, doc);
    return doc;
  }

  async getById(id: string): Promise<Document | null> {
    return this.documents.get(id) ?? null;
  }

  async getByPath(filePath: string): Promise<Document | null> {
    for (const doc of this.documents.values()) {
      if (doc.filePath === filePath) {
        return doc;
      }
    }
    return null;
  }

  async list(
    orderBy?: OrderBy,
    limit?: number,
    _offset?: number
  ): Promise<Document[]> {
    let docs = Array.from(this.documents.values());

    // Sort
    switch (orderBy) {
      case 'title':
        docs.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
        break;
      case 'created':
        docs.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'last_opened':
      default:
        docs.sort((a, b) => {
          const aTime = a.lastOpenedAt
            ? new Date(a.lastOpenedAt).getTime()
            : 0;
          const bTime = b.lastOpenedAt
            ? new Date(b.lastOpenedAt).getTime()
            : 0;
          return bTime - aTime;
        });
        break;
    }

    if (limit) {
      docs = docs.slice(0, limit);
    }

    return docs;
  }

  async updateProgress(
    id: string,
    page: number,
    scroll?: number,
    ttsChunkId?: string
  ): Promise<Document> {
    const doc = this.documents.get(id);
    if (!doc) {
      throw new Error(`Document not found: ${id}`);
    }
    const updated: Document = {
      ...doc,
      currentPage: page,
      scrollPosition: scroll ?? doc.scrollPosition,
      lastTtsChunkId: ttsChunkId ?? doc.lastTtsChunkId,
      lastOpenedAt: new Date().toISOString(),
    };
    this.documents.set(id, updated);
    return updated;
  }

  async updateTitle(id: string, title: string): Promise<Document> {
    const doc = this.documents.get(id);
    if (!doc) {
      throw new Error(`Document not found: ${id}`);
    }
    const updated: Document = { ...doc, title };
    this.documents.set(id, updated);
    return updated;
  }

  async relocate(id: string, newPath: string): Promise<Document> {
    const doc = this.documents.get(id);
    if (!doc) {
      throw new Error(`Document not found: ${id}`);
    }
    const updated: Document = { ...doc, filePath: newPath };
    this.documents.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async checkFileExists(filePath: string): Promise<FileExistsResponse> {
    // In mock, we always say the file exists
    return { exists: true, filePath };
  }

  // Test helpers
  clear(): void {
    this.documents.clear();
    this.idCounter = 1;
  }

  addDocument(doc: Document): void {
    this.documents.set(doc.id, doc);
  }
}
