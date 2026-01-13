# API Contract: Highlights Service

**Feature Branch**: `001-tauri-pdf-tts-reader`
**Date**: 2026-01-11

## Overview

The Highlights Service manages text highlight creation, modification, and retrieval within PDF documents.

---

## Commands

### `highlights_create`

Create a new highlight on a document page.

**Input**:
```typescript
interface CreateHighlightInput {
  documentId: string;
  pageNumber: number;        // 1-indexed
  rects: Rect[];             // At least one rect required
  color: string;             // Hex color #RRGGBB
  textContent: string | null; // Selected text for anchoring
}

interface Rect {
  x: number;      // Page coordinates
  y: number;
  width: number;
  height: number;
}
```

**Output**:
```typescript
interface Highlight {
  id: string;                // UUID
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent: string | null;
  note: string | null;
  createdAt: string;         // ISO 8601
  updatedAt: string | null;
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `DOCUMENT_NOT_FOUND` | Referenced document doesn't exist |
| `INVALID_PAGE` | Page number < 1 |
| `EMPTY_RECTS` | Rects array is empty |
| `INVALID_COLOR` | Color doesn't match #RRGGBB format |

**Behavior**:
1. Validate document exists
2. Generate UUID for highlight
3. Store rects as JSON
4. Set `created_at` to current timestamp
5. Return created highlight

---

### `highlights_batch_create`

Create multiple highlights in a single transaction.

**Input**:
```typescript
interface BatchCreateInput {
  highlights: CreateHighlightInput[];
}
```

**Output**:
```typescript
interface BatchCreateResponse {
  highlights: Highlight[];
  created: number;
}
```

**Behavior**:
- Wraps all inserts in single transaction
- Fails entirely if any highlight fails validation
- Returns all created highlights

---

### `highlights_list_for_page`

Get all highlights for a specific page.

**Input**:
```typescript
interface ListForPageInput {
  documentId: string;
  pageNumber: number;
}
```

**Output**:
```typescript
interface ListHighlightsResponse {
  highlights: Highlight[];
}
```

**Behavior**:
- Returns highlights sorted by `created_at` ASC
- Uses `(document_id, page_number)` index for performance

---

### `highlights_list_for_document`

Get all highlights for an entire document.

**Input**:
```typescript
interface ListForDocumentInput {
  documentId: string;
}
```

**Output**:
```typescript
interface ListHighlightsResponse {
  highlights: Highlight[];
}
```

**Behavior**:
- Returns highlights sorted by `page_number` ASC, then `created_at` ASC
- Useful for highlights panel and export

---

### `highlights_get`

Get a single highlight by ID.

**Input**:
```typescript
interface GetHighlightInput {
  id: string;
}
```

**Output**: `Highlight`

**Errors**:
| Code | Description |
|------|-------------|
| `NOT_FOUND` | Highlight with ID not found |

---

### `highlights_update`

Update highlight color or note.

**Input**:
```typescript
interface UpdateHighlightInput {
  id: string;
  color?: string;        // New color (optional)
  note?: string | null;  // New note (optional, null clears)
}
```

**Output**: `Highlight`

**Errors**:
| Code | Description |
|------|-------------|
| `NOT_FOUND` | Highlight not found |
| `INVALID_COLOR` | Color doesn't match #RRGGBB format |

**Behavior**:
- Only updates provided fields
- Sets `updated_at` to current timestamp
- Returns updated highlight

---

### `highlights_delete`

Delete a highlight.

**Input**:
```typescript
interface DeleteHighlightInput {
  id: string;
}
```

**Output**:
```typescript
interface DeleteResponse {
  success: boolean;
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `NOT_FOUND` | Highlight not found |

---

### `highlights_delete_for_document`

Delete all highlights for a document.

**Input**:
```typescript
interface DeleteForDocumentInput {
  documentId: string;
}
```

**Output**:
```typescript
interface DeleteResponse {
  deleted: number;
}
```

**Behavior**:
- Returns count of deleted highlights
- Used for "clear all highlights" feature

---

### `highlights_export`

Export highlights for a document in specified format.

**Input**:
```typescript
interface ExportHighlightsInput {
  documentId: string;
  format: 'markdown' | 'json';
}
```

**Output**:
```typescript
interface ExportResponse {
  content: string;     // Formatted export content
  filename: string;    // Suggested filename
}
```

**Markdown Format**:
```markdown
# Highlights: [Document Title]

## Page 1

> "Highlighted text content"
- Color: Yellow
- Note: User's note if present

> "Another highlight"
- Color: Green

## Page 5

...
```

**JSON Format**:
```json
{
  "documentId": "...",
  "documentTitle": "...",
  "exportedAt": "2026-01-11T12:00:00Z",
  "highlights": [
    {
      "pageNumber": 1,
      "textContent": "...",
      "color": "#FFEB3B",
      "note": "..."
    }
  ]
}
```

---

## Frontend Integration

```typescript
// src/lib/tauri-invoke.ts

import { invoke } from '@tauri-apps/api/core';
import { Highlight, CreateHighlightInput, UpdateHighlightInput } from './schemas';

export async function highlightsCreate(input: CreateHighlightInput): Promise<Highlight> {
  return invoke('highlights_create', input);
}

export async function highlightsBatchCreate(
  highlights: CreateHighlightInput[]
): Promise<Highlight[]> {
  const response = await invoke<{ highlights: Highlight[] }>(
    'highlights_batch_create',
    { highlights }
  );
  return response.highlights;
}

export async function highlightsListForPage(
  documentId: string,
  pageNumber: number
): Promise<Highlight[]> {
  const response = await invoke<{ highlights: Highlight[] }>(
    'highlights_list_for_page',
    { documentId, pageNumber }
  );
  return response.highlights;
}

export async function highlightsListForDocument(
  documentId: string
): Promise<Highlight[]> {
  const response = await invoke<{ highlights: Highlight[] }>(
    'highlights_list_for_document',
    { documentId }
  );
  return response.highlights;
}

export async function highlightsUpdate(
  id: string,
  updates: UpdateHighlightInput
): Promise<Highlight> {
  return invoke('highlights_update', { id, ...updates });
}

export async function highlightsDelete(id: string): Promise<void> {
  await invoke('highlights_delete', { id });
}

export async function highlightsExport(
  documentId: string,
  format: 'markdown' | 'json'
): Promise<{ content: string; filename: string }> {
  return invoke('highlights_export', { documentId, format });
}
```

---

## Rust Command Signatures

```rust
// src-tauri/src/commands/highlights.rs

#[tauri::command]
pub async fn highlights_create(
    db: State<'_, DbInstances>,
    document_id: String,
    page_number: i32,
    rects: Vec<Rect>,
    color: String,
    text_content: Option<String>,
) -> Result<Highlight, String>;

#[tauri::command]
pub async fn highlights_batch_create(
    db: State<'_, DbInstances>,
    highlights: Vec<CreateHighlightInput>,
) -> Result<BatchCreateResponse, String>;

#[tauri::command]
pub async fn highlights_list_for_page(
    db: State<'_, DbInstances>,
    document_id: String,
    page_number: i32,
) -> Result<ListHighlightsResponse, String>;

#[tauri::command]
pub async fn highlights_list_for_document(
    db: State<'_, DbInstances>,
    document_id: String,
) -> Result<ListHighlightsResponse, String>;

#[tauri::command]
pub async fn highlights_get(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<Highlight, String>;

#[tauri::command]
pub async fn highlights_update(
    db: State<'_, DbInstances>,
    id: String,
    color: Option<String>,
    note: Option<String>,
) -> Result<Highlight, String>;

#[tauri::command]
pub async fn highlights_delete(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<DeleteResponse, String>;

#[tauri::command]
pub async fn highlights_delete_for_document(
    db: State<'_, DbInstances>,
    document_id: String,
) -> Result<DeleteResponse, String>;

#[tauri::command]
pub async fn highlights_export(
    db: State<'_, DbInstances>,
    document_id: String,
    format: String,
) -> Result<ExportResponse, String>;
```
