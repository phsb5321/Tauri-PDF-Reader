# Contract: Highlights Commands

**Feature**: 044-tauri-pdf-reader | **Date**: 2026-01-11 | **Phase**: 1

## Overview

Tauri IPC commands for highlight CRUD operations.

---

## Commands

### `highlights_create`

Create a new highlight.

**Invoke**:
```typescript
const highlight = await invoke<Highlight>('highlights_create', {
  documentId: 'doc-uuid',
  pageNumber: 5,
  rects: [{ x: 100, y: 200, width: 300, height: 20 }],
  color: '#ffff00',
  textContent: 'Selected text'
});
```

**Request**:
```typescript
interface CreateHighlightRequest {
  documentId: string;   // Parent document UUID
  pageNumber: number;   // 1-indexed page number
  rects: Rect[];        // Array of bounding rectangles
  color: string;        // CSS hex color (e.g., "#ffff00")
  textContent?: string; // Highlighted text for TTS
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

**Response**:
```typescript
interface Highlight {
  id: string;
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent: string | null;
  createdAt: string;
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `DOCUMENT_NOT_FOUND` | Document with ID not found |
| `INVALID_PAGE` | Page number invalid |
| `INVALID_RECTS` | Rects array empty or malformed |
| `INVALID_COLOR` | Color not valid hex format |

---

### `highlights_get`

Get a highlight by ID.

**Invoke**:
```typescript
const highlight = await invoke<Highlight | null>('highlights_get', { id: 'uuid' });
```

**Request**:
```typescript
interface GetHighlightRequest {
  id: string;
}
```

**Response**:
```typescript
type Response = Highlight | null;
```

---

### `highlights_list_for_document`

Get all highlights for a document.

**Invoke**:
```typescript
const highlights = await invoke<Highlight[]>('highlights_list_for_document', {
  documentId: 'doc-uuid'
});
```

**Request**:
```typescript
interface ListHighlightsRequest {
  documentId: string;
}
```

**Response**:
```typescript
type Response = Highlight[];
```

---

### `highlights_list_for_page`

Get highlights for a specific page.

**Invoke**:
```typescript
const highlights = await invoke<Highlight[]>('highlights_list_for_page', {
  documentId: 'doc-uuid',
  pageNumber: 5
});
```

**Request**:
```typescript
interface ListPageHighlightsRequest {
  documentId: string;
  pageNumber: number;
}
```

**Response**:
```typescript
type Response = Highlight[];
```

---

### `highlights_update`

Update a highlight's color or text.

**Invoke**:
```typescript
await invoke('highlights_update', {
  id: 'uuid',
  color: '#ff0000'
});
```

**Request**:
```typescript
interface UpdateHighlightRequest {
  id: string;
  color?: string;
  textContent?: string;
}
```

**Response**:
```typescript
type Response = null;  // Success
```

**Errors**:
| Code | Description |
|------|-------------|
| `HIGHLIGHT_NOT_FOUND` | Highlight with ID not found |

---

### `highlights_delete`

Delete a highlight.

**Invoke**:
```typescript
await invoke('highlights_delete', { id: 'uuid' });
```

**Request**:
```typescript
interface DeleteHighlightRequest {
  id: string;
}
```

**Response**:
```typescript
type Response = null;  // Success
```

---

### `highlights_delete_for_document`

Delete all highlights for a document.

**Invoke**:
```typescript
const count = await invoke<number>('highlights_delete_for_document', {
  documentId: 'doc-uuid'
});
```

**Request**:
```typescript
interface DeleteDocumentHighlightsRequest {
  documentId: string;
}
```

**Response**:
```typescript
type Response = number;  // Number of deleted highlights
```

---

## TypeScript Client

```typescript
// src/services/highlight-service.ts
import { invoke } from '@tauri-apps/api/core';

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
  createdAt: string;
}

export interface CreateHighlightInput {
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent?: string;
}

class HighlightService {
  async create(input: CreateHighlightInput): Promise<Highlight> {
    return await invoke('highlights_create', input);
  }

  async get(id: string): Promise<Highlight | null> {
    return await invoke('highlights_get', { id });
  }

  async listForDocument(documentId: string): Promise<Highlight[]> {
    return await invoke('highlights_list_for_document', { documentId });
  }

  async listForPage(documentId: string, pageNumber: number): Promise<Highlight[]> {
    return await invoke('highlights_list_for_page', { documentId, pageNumber });
  }

  async update(id: string, updates: { color?: string; textContent?: string }): Promise<void> {
    await invoke('highlights_update', { id, ...updates });
  }

  async delete(id: string): Promise<void> {
    await invoke('highlights_delete', { id });
  }

  async deleteForDocument(documentId: string): Promise<number> {
    return await invoke('highlights_delete_for_document', { documentId });
  }
}

export const highlightService = new HighlightService();
```

---

## Highlight Colors (Predefined)

```typescript
// src/lib/constants.ts
export const HIGHLIGHT_COLORS = [
  { id: 'yellow', hex: '#ffff00', name: 'Yellow' },
  { id: 'green', hex: '#00ff00', name: 'Green' },
  { id: 'blue', hex: '#00bfff', name: 'Blue' },
  { id: 'pink', hex: '#ff69b4', name: 'Pink' },
  { id: 'orange', hex: '#ffa500', name: 'Orange' },
] as const;

export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0].hex;
```

---

## Database Queries Reference

```sql
-- Create highlight
INSERT INTO highlights (id, document_id, page_number, rects, color, text_content, created_at)
VALUES (?, ?, ?, ?, ?, ?, datetime('now'));

-- Get by ID
SELECT * FROM highlights WHERE id = ?;

-- List for document
SELECT * FROM highlights WHERE document_id = ? ORDER BY page_number, created_at;

-- List for page
SELECT * FROM highlights WHERE document_id = ? AND page_number = ? ORDER BY created_at;

-- Update
UPDATE highlights SET color = ?, text_content = ? WHERE id = ?;

-- Delete
DELETE FROM highlights WHERE id = ?;

-- Delete all for document
DELETE FROM highlights WHERE document_id = ?;
```

---

## Coordinate System

Highlight coordinates are stored in **PDF.js text layer coordinates**:

- Origin (0, 0) is top-left of the text layer div
- Units are CSS pixels at the current viewport scale
- When zoom changes, coordinates must be scaled accordingly

**Important**: Store coordinates at a reference scale (e.g., scale=1.0) and transform on render:

```typescript
function transformRects(rects: Rect[], fromScale: number, toScale: number): Rect[] {
  const ratio = toScale / fromScale;
  return rects.map(r => ({
    x: r.x * ratio,
    y: r.y * ratio,
    width: r.width * ratio,
    height: r.height * ratio,
  }));
}
```
