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

/**
 * Mock implementation of HighlightRepositoryPort for testing.
 * Stores highlights in memory.
 */
export class MockHighlightRepository implements HighlightRepositoryPort {
  private highlights = new Map<string, Highlight>();
  private idCounter = 1;

  async create(input: HighlightCreate): Promise<Highlight> {
    const id = `highlight-${this.idCounter++}`;
    const now = new Date().toISOString();
    const highlight: Highlight = {
      id,
      documentId: input.documentId,
      pageNumber: input.pageNumber,
      rects: input.rects,
      color: input.color,
      textContent: input.textContent ?? null,
      note: null,
      createdAt: now,
      updatedAt: null,
    };
    this.highlights.set(id, highlight);
    return highlight;
  }

  async batchCreate(inputs: HighlightCreate[]): Promise<BatchCreateResponse> {
    const highlights: Highlight[] = [];
    for (const input of inputs) {
      const highlight = await this.create(input);
      highlights.push(highlight);
    }
    return { highlights, created: highlights.length };
  }

  async getById(id: string): Promise<Highlight | null> {
    return this.highlights.get(id) ?? null;
  }

  async listForPage(
    documentId: string,
    pageNumber: number
  ): Promise<Highlight[]> {
    return Array.from(this.highlights.values()).filter(
      (h) => h.documentId === documentId && h.pageNumber === pageNumber
    );
  }

  async listForDocument(documentId: string): Promise<Highlight[]> {
    return Array.from(this.highlights.values()).filter(
      (h) => h.documentId === documentId
    );
  }

  async update(id: string, input: HighlightUpdate): Promise<Highlight> {
    const highlight = this.highlights.get(id);
    if (!highlight) {
      throw new Error(`Highlight not found: ${id}`);
    }
    const updated: Highlight = {
      ...highlight,
      color: input.color ?? highlight.color,
      note: input.note !== undefined ? input.note : highlight.note,
      updatedAt: new Date().toISOString(),
    };
    this.highlights.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.highlights.delete(id);
  }

  async deleteForDocument(documentId: string): Promise<DeleteResponse> {
    let deleted = 0;
    for (const [id, highlight] of this.highlights) {
      if (highlight.documentId === documentId) {
        this.highlights.delete(id);
        deleted++;
      }
    }
    return { success: true, deleted };
  }

  async export(
    documentId: string,
    format: ExportFormat
  ): Promise<ExportResponse> {
    const highlights = await this.listForDocument(documentId);

    let content: string;
    switch (format) {
      case 'json':
        content = JSON.stringify(highlights, null, 2);
        break;
      case 'markdown':
        content = highlights
          .map(
            (h) =>
              `## Page ${h.pageNumber}\n\n${h.textContent ?? ''}\n\n${h.note ? `> ${h.note}` : ''}`
          )
          .join('\n\n---\n\n');
        break;
      case 'text':
      default:
        content = highlights
          .map((h) => `[Page ${h.pageNumber}] ${h.textContent ?? ''}`)
          .join('\n');
        break;
    }

    return {
      content,
      filename: `highlights-${documentId}.${format === 'markdown' ? 'md' : format}`,
    };
  }

  // Test helpers
  clear(): void {
    this.highlights.clear();
    this.idCounter = 1;
  }

  addHighlight(highlight: Highlight): void {
    this.highlights.set(highlight.id, highlight);
  }
}
