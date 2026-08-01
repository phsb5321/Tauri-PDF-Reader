# Contract: Library Commands

**Feature**: 044-tauri-pdf-reader | **Date**: 2026-01-11 | **Phase**: 1

## Overview

Tauri IPC commands for document library management (CRUD operations on documents).

---

## Commands

### `library_add_document`

Add a new document to the library.

**Invoke**:
```typescript
const doc = await invoke<Document>('library_add_document', { filePath: '/path/to/file.pdf' });
```

**Request**:
```typescript
interface AddDocumentRequest {
  filePath: string;    // Absolute path to PDF file
  title?: string;      // Optional title (defaults to filename)
  pageCount?: number;  // Optional page count (extracted during open)
}
```

**Response**:
```typescript
interface Document {
  id: string;
  filePath: string;
  title: string | null;
  pageCount: number | null;
  currentPage: number;
  lastOpenedAt: string | null;
  fileHash: string | null;
  createdAt: string;
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `DOCUMENT_NOT_FOUND` | File does not exist at path |
| `DOCUMENT_NOT_PDF` | File is not a valid PDF |
| `DOCUMENT_ALREADY_EXISTS` | Document with this path already in library |
| `DATABASE_ERROR` | Database operation failed |

---

### `library_get_document`

Get a document by ID.

**Invoke**:
```typescript
const doc = await invoke<Document | null>('library_get_document', { id: 'uuid' });
```

**Request**:
```typescript
interface GetDocumentRequest {
  id: string;  // Document UUID
}
```

**Response**:
```typescript
type Response = Document | null;
```

---

### `library_get_document_by_path`

Get a document by file path.

**Invoke**:
```typescript
const doc = await invoke<Document | null>('library_get_document_by_path', { filePath: '/path/to/file.pdf' });
```

**Request**:
```typescript
interface GetDocumentByPathRequest {
  filePath: string;
}
```

**Response**:
```typescript
type Response = Document | null;
```

---

### `library_list_documents`

List all documents in the library.

**Invoke**:
```typescript
const docs = await invoke<Document[]>('library_list_documents', { 
  orderBy: 'last_opened', 
  limit: 20 
});
```

**Request**:
```typescript
interface ListDocumentsRequest {
  orderBy?: 'last_opened' | 'created' | 'title';  // Default: 'last_opened'
  limit?: number;   // Default: no limit
  offset?: number;  // Default: 0
}
```

**Response**:
```typescript
type Response = Document[];
```

---

### `library_update_progress`

Update reading progress for a document.

**Invoke**:
```typescript
await invoke('library_update_progress', { 
  id: 'uuid', 
  currentPage: 42 
});
```

**Request**:
```typescript
interface UpdateProgressRequest {
  id: string;        // Document UUID
  currentPage: number;  // 1-indexed page number
}
```

**Response**:
```typescript
type Response = null;  // Success
```

**Errors**:
| Code | Description |
|------|-------------|
| `DOCUMENT_NOT_FOUND` | Document with ID not found |
| `INVALID_PAGE` | Page number out of range |

---

### `library_update_document`

Update document metadata.

**Invoke**:
```typescript
await invoke('library_update_document', { 
  id: 'uuid', 
  title: 'New Title',
  pageCount: 100 
});
```

**Request**:
```typescript
interface UpdateDocumentRequest {
  id: string;           // Document UUID
  title?: string;       // New title
  pageCount?: number;   // Page count
  fileHash?: string;    // File hash
}
```

**Response**:
```typescript
type Response = null;  // Success
```

---

### `library_remove_document`

Remove a document from the library (does not delete file).

**Invoke**:
```typescript
await invoke('library_remove_document', { id: 'uuid' });
```

**Request**:
```typescript
interface RemoveDocumentRequest {
  id: string;  // Document UUID
}
```

**Response**:
```typescript
type Response = null;  // Success
```

**Notes**: Also deletes all associated highlights (CASCADE).

---

### `library_open_document`

Mark a document as opened (updates lastOpenedAt).

**Invoke**:
```typescript
const doc = await invoke<Document>('library_open_document', { id: 'uuid' });
```

**Request**:
```typescript
interface OpenDocumentRequest {
  id: string;  // Document UUID
}
```

**Response**:
```typescript
type Response = Document;  // Updated document
```

---

### `library_check_file_exists`

Check if a document's file still exists on disk.

**Invoke**:
```typescript
const exists = await invoke<boolean>('library_check_file_exists', { id: 'uuid' });
```

**Request**:
```typescript
interface CheckFileExistsRequest {
  id: string;  // Document UUID
}
```

**Response**:
```typescript
type Response = boolean;
```

---

## TypeScript Client

```typescript
// src/services/library-service.ts
import { invoke } from '@tauri-apps/api/core';

export interface Document {
  id: string;
  filePath: string;
  title: string | null;
  pageCount: number | null;
  currentPage: number;
  lastOpenedAt: string | null;
  fileHash: string | null;
  createdAt: string;
}

export type OrderBy = 'last_opened' | 'created' | 'title';

class LibraryService {
  async addDocument(filePath: string, title?: string): Promise<Document> {
    return await invoke('library_add_document', { filePath, title });
  }

  async getDocument(id: string): Promise<Document | null> {
    return await invoke('library_get_document', { id });
  }

  async getDocumentByPath(filePath: string): Promise<Document | null> {
    return await invoke('library_get_document_by_path', { filePath });
  }

  async listDocuments(
    orderBy: OrderBy = 'last_opened',
    limit?: number,
    offset?: number
  ): Promise<Document[]> {
    return await invoke('library_list_documents', { orderBy, limit, offset });
  }

  async updateProgress(id: string, currentPage: number): Promise<void> {
    await invoke('library_update_progress', { id, currentPage });
  }

  async updateDocument(
    id: string,
    updates: { title?: string; pageCount?: number; fileHash?: string }
  ): Promise<void> {
    await invoke('library_update_document', { id, ...updates });
  }

  async removeDocument(id: string): Promise<void> {
    await invoke('library_remove_document', { id });
  }

  async openDocument(id: string): Promise<Document> {
    return await invoke('library_open_document', { id });
  }

  async checkFileExists(id: string): Promise<boolean> {
    return await invoke('library_check_file_exists', { id });
  }
}

export const libraryService = new LibraryService();
```

---

## Database Queries Reference

```sql
-- Add document
INSERT INTO documents (id, file_path, title, page_count, current_page, created_at)
VALUES (?, ?, ?, ?, 1, datetime('now'));

-- Get by ID
SELECT * FROM documents WHERE id = ?;

-- Get by path
SELECT * FROM documents WHERE file_path = ?;

-- List (ordered by last opened)
SELECT * FROM documents 
ORDER BY last_opened_at DESC NULLS LAST, created_at DESC
LIMIT ? OFFSET ?;

-- Update progress
UPDATE documents 
SET current_page = ?, last_opened_at = datetime('now')
WHERE id = ?;

-- Delete
DELETE FROM documents WHERE id = ?;
```
