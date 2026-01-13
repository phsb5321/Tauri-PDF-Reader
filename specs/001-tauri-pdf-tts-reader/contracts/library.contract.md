# API Contract: Library Service

**Feature Branch**: `001-tauri-pdf-tts-reader`
**Date**: 2026-01-11

## Overview

The Library Service manages document lifecycle including opening PDFs, tracking reading progress, and library organization.

---

## Commands

### `library_open_document`

Open a PDF file and add it to the library.

**Input**:
```typescript
interface OpenDocumentInput {
  filePath: string;  // Absolute path to PDF file
}
```

**Output**:
```typescript
interface Document {
  id: string;              // SHA-256 content hash
  filePath: string;
  title: string;           // Filename without extension
  pageCount: number;
  currentPage: number;     // 1 (new) or restored position
  scrollPosition: number;  // 0.0 (new) or restored
  lastTtsChunkId: string | null;
  lastOpenedAt: string;    // ISO 8601
  createdAt: string;       // ISO 8601
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `FILE_NOT_FOUND` | File does not exist at specified path |
| `INVALID_PDF` | File is not a valid PDF |
| `READ_PERMISSION` | Cannot read file (permission denied) |
| `HASH_FAILED` | Failed to compute file hash |

**Behavior**:
1. Validate file exists and is readable
2. Compute SHA-256 hash of file content
3. If document exists in DB: update `last_opened_at`, return existing record
4. If new: extract page count, create record with defaults
5. Return document with restored or default reading position

---

### `library_list_documents`

List all documents in the library.

**Input**: None

**Output**:
```typescript
interface ListDocumentsResponse {
  documents: Document[];
}
```

**Behavior**:
- Returns all documents sorted by `last_opened_at` DESC
- Includes computed `progressPercentage` field

---

### `library_get_document`

Get a single document by ID.

**Input**:
```typescript
interface GetDocumentInput {
  id: string;  // Document ID (SHA-256 hash)
}
```

**Output**: `Document`

**Errors**:
| Code | Description |
|------|-------------|
| `NOT_FOUND` | Document with ID not in library |

---

### `library_update_progress`

Update reading position for a document.

**Input**:
```typescript
interface UpdateProgressInput {
  id: string;
  currentPage: number;       // 1-indexed
  scrollPosition: number;    // 0.0 to 1.0
  lastTtsChunkId?: string;   // Optional TTS position
}
```

**Output**: `Document`

**Errors**:
| Code | Description |
|------|-------------|
| `NOT_FOUND` | Document not in library |
| `INVALID_PAGE` | Page number out of range |
| `INVALID_SCROLL` | Scroll position out of 0-1 range |

**Behavior**:
- Updates `current_page`, `scroll_position`, `last_tts_chunk_id`
- Sets `last_opened_at` to current timestamp
- Debounced by frontend (not backend)

---

### `library_update_title`

Update the display title of a document.

**Input**:
```typescript
interface UpdateTitleInput {
  id: string;
  title: string;  // New display title
}
```

**Output**: `Document`

**Errors**:
| Code | Description |
|------|-------------|
| `NOT_FOUND` | Document not in library |
| `EMPTY_TITLE` | Title cannot be empty |

---

### `library_remove_document`

Remove a document from the library (does not delete file).

**Input**:
```typescript
interface RemoveDocumentInput {
  id: string;
}
```

**Output**:
```typescript
interface RemoveResponse {
  success: boolean;
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `NOT_FOUND` | Document not in library |

**Behavior**:
- Deletes document record from database
- CASCADE deletes all associated highlights
- Does NOT delete the PDF file from disk

---

### `library_relocate_document`

Update file path when document has been moved.

**Input**:
```typescript
interface RelocateDocumentInput {
  id: string;
  newFilePath: string;
}
```

**Output**: `Document`

**Errors**:
| Code | Description |
|------|-------------|
| `NOT_FOUND` | Document ID not in library |
| `FILE_NOT_FOUND` | File not at new path |
| `HASH_MISMATCH` | File at new path has different content |

**Behavior**:
1. Validate file exists at new path
2. Compute hash and verify it matches document ID
3. Update `file_path` in database
4. Return updated document

---

### `library_check_file_exists`

Check if document's file still exists on disk.

**Input**:
```typescript
interface CheckFileInput {
  id: string;
}
```

**Output**:
```typescript
interface FileExistsResponse {
  exists: boolean;
  filePath: string;
}
```

---

## Frontend Integration

```typescript
// src/lib/tauri-invoke.ts

import { invoke } from '@tauri-apps/api/core';
import { Document } from './schemas';

export async function libraryOpenDocument(filePath: string): Promise<Document> {
  return invoke('library_open_document', { filePath });
}

export async function libraryListDocuments(): Promise<Document[]> {
  const response = await invoke<{ documents: Document[] }>('library_list_documents');
  return response.documents;
}

export async function libraryGetDocument(id: string): Promise<Document> {
  return invoke('library_get_document', { id });
}

export async function libraryUpdateProgress(
  id: string,
  currentPage: number,
  scrollPosition: number,
  lastTtsChunkId?: string
): Promise<Document> {
  return invoke('library_update_progress', {
    id,
    currentPage,
    scrollPosition,
    lastTtsChunkId,
  });
}

export async function libraryRemoveDocument(id: string): Promise<void> {
  await invoke('library_remove_document', { id });
}
```

---

## Rust Command Signatures

```rust
// src-tauri/src/commands/library.rs

#[tauri::command]
pub async fn library_open_document(
    db: State<'_, DbInstances>,
    file_path: String,
) -> Result<Document, String>;

#[tauri::command]
pub async fn library_list_documents(
    db: State<'_, DbInstances>,
) -> Result<ListDocumentsResponse, String>;

#[tauri::command]
pub async fn library_get_document(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<Document, String>;

#[tauri::command]
pub async fn library_update_progress(
    db: State<'_, DbInstances>,
    id: String,
    current_page: i32,
    scroll_position: f64,
    last_tts_chunk_id: Option<String>,
) -> Result<Document, String>;

#[tauri::command]
pub async fn library_update_title(
    db: State<'_, DbInstances>,
    id: String,
    title: String,
) -> Result<Document, String>;

#[tauri::command]
pub async fn library_remove_document(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<RemoveResponse, String>;

#[tauri::command]
pub async fn library_relocate_document(
    db: State<'_, DbInstances>,
    id: String,
    new_file_path: String,
) -> Result<Document, String>;

#[tauri::command]
pub async fn library_check_file_exists(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<FileExistsResponse, String>;
```
