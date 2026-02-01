# Quickstart: Reading Session Manager with Audio Cache

**Feature Branch**: `006-reading-session-audio-cache`
**Created**: 2026-01-25

This guide provides step-by-step instructions for implementing the feature. Follow these steps in order.

---

## Prerequisites

Before starting:

```bash
# Ensure you're on the feature branch
git checkout 006-reading-session-audio-cache

# Install dependencies
pnpm install
cd src-tauri && cargo fetch && cd ..

# Verify tests pass
pnpm verify
```

---

## Phase 1: Database Schema (Backend)

### Step 1.1: Add Migration

**File**: `src-tauri/src/db/migrations.rs`

Add migration version 3 after existing migrations:

```rust
// Add to MIGRATIONS constant array
const MIGRATION_3: &str = r#"
-- Reading Sessions
CREATE TABLE IF NOT EXISTS reading_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_accessed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_documents (
    session_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    current_page INTEGER NOT NULL DEFAULT 1,
    scroll_position REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    PRIMARY KEY (session_id, document_id),
    FOREIGN KEY (session_id) REFERENCES reading_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Enhance tts_cache_metadata
ALTER TABLE tts_cache_metadata ADD COLUMN chunk_index INTEGER;
ALTER TABLE tts_cache_metadata ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tts_cache_metadata ADD COLUMN total_chunks INTEGER;

-- Cache settings
CREATE TABLE IF NOT EXISTS cache_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO cache_settings (key, value, updated_at) VALUES
    ('max_size_bytes', '5368709120', datetime('now')),
    ('eviction_policy', 'lru', datetime('now'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reading_sessions_last_accessed
    ON reading_sessions(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_documents_session
    ON session_documents(session_id, position);
CREATE INDEX IF NOT EXISTS idx_tts_cache_document_page
    ON tts_cache_metadata(document_id, page_number);
"#;
```

**Test**: Run `cargo test --features test-mocks` in `src-tauri/`

---

## Phase 2: Domain Layer (Both)

### Step 2.1: Backend Domain Entities

**Create**: `src-tauri/src/domain/sessions/mod.rs`

```rust
pub mod session;
pub mod coverage;

pub use session::*;
pub use coverage::*;
```

**Create**: `src-tauri/src/domain/sessions/session.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingSession {
    pub id: String,
    pub name: String,
    pub documents: Vec<SessionDocument>,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDocument {
    pub document_id: String,
    pub position: i32,
    pub current_page: i32,
    pub scroll_position: f64,
    pub created_at: String,
}

impl ReadingSession {
    pub fn validate(&self) -> Result<(), String> {
        if self.name.is_empty() || self.name.len() > 100 {
            return Err("Session name must be 1-100 characters".into());
        }
        if self.documents.len() > 50 {
            return Err("Session cannot contain more than 50 documents".into());
        }
        Ok(())
    }
}
```

### Step 2.2: Frontend Domain Entities

**Create**: `src/domain/sessions/session.ts`

```typescript
export interface ReadingSession {
  id: string;
  name: string;
  documents: SessionDocument[];
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

export interface SessionDocument {
  documentId: string;
  position: number;
  currentPage: number;
  scrollPosition: number;
  createdAt: string;
}

export const SESSION_NAME_MIN_LENGTH = 1;
export const SESSION_NAME_MAX_LENGTH = 100;
export const MAX_DOCUMENTS_PER_SESSION = 50;

export function validateSessionName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < SESSION_NAME_MIN_LENGTH) {
    return "Session name is required";
  }
  if (trimmed.length > SESSION_NAME_MAX_LENGTH) {
    return "Session name must be 100 characters or less";
  }
  return null;
}
```

---

## Phase 3: Ports Layer (Both)

### Step 3.1: Backend Session Repository Port

**Create**: `src-tauri/src/ports/session_repository.rs`

```rust
use async_trait::async_trait;
use crate::domain::sessions::{ReadingSession, SessionDocument};

#[async_trait]
pub trait SessionRepository: Send + Sync {
    async fn create(&self, name: &str, document_ids: &[String]) -> Result<ReadingSession, String>;
    async fn get(&self, session_id: &str) -> Result<Option<ReadingSession>, String>;
    async fn list(&self) -> Result<Vec<ReadingSession>, String>;
    async fn update(&self, session_id: &str, name: Option<&str>, document_ids: Option<&[String]>) -> Result<ReadingSession, String>;
    async fn delete(&self, session_id: &str) -> Result<(), String>;
    async fn touch(&self, session_id: &str) -> Result<(), String>;
}
```

### Step 3.2: Frontend Session Repository Port

**Create**: `src/ports/session-repository.ts`

```typescript
import type { ReadingSession } from "@/domain/sessions/session";

export interface SessionRepository {
  create(name: string, documentIds: string[]): Promise<ReadingSession>;
  get(sessionId: string): Promise<ReadingSession | null>;
  list(): Promise<ReadingSession[]>;
  update(
    sessionId: string,
    updates: { name?: string; documentIds?: string[] },
  ): Promise<ReadingSession>;
  delete(sessionId: string): Promise<void>;
}
```

---

## Phase 4: Adapters Layer

### Step 4.1: Backend SQLite Session Repository

**Create**: `src-tauri/src/adapters/sqlite/session_repo.rs`

Implement `SessionRepository` trait with SQLite queries.

### Step 4.2: Frontend Tauri Session Adapter

**Create**: `src/adapters/tauri/session.adapter.ts`

```typescript
import { commands } from "@/lib/bindings";
import type { SessionRepository } from "@/ports/session-repository";
import type { ReadingSession } from "@/domain/sessions/session";

export class TauriSessionAdapter implements SessionRepository {
  async create(name: string, documentIds: string[]): Promise<ReadingSession> {
    return commands.sessionCreate({ name, documentIds });
  }

  async get(sessionId: string): Promise<ReadingSession | null> {
    return commands.sessionGet({ sessionId });
  }

  async list(): Promise<ReadingSession[]> {
    const result = await commands.sessionList();
    return result.sessions;
  }

  async update(
    sessionId: string,
    updates: { name?: string; documentIds?: string[] },
  ): Promise<ReadingSession> {
    return commands.sessionUpdate({ sessionId, ...updates });
  }

  async delete(sessionId: string): Promise<void> {
    await commands.sessionDelete({ sessionId });
  }
}
```

> **IMPORTANT**: Always use generated bindings from `@/lib/bindings` instead of direct `invoke()` calls. This is a non-negotiable rule per the project constitution.

````

---

## Phase 5: Tauri Commands

### Step 5.1: Register Commands

**File**: `src-tauri/src/lib.rs`

Add to `collect_commands!` macro:
```rust
// Session commands
session_create,
session_get,
session_list,
session_update,
session_delete,
session_restore,
// Cache commands
audio_cache_get_coverage,
audio_cache_clear_document,
audio_cache_get_stats,
audio_cache_set_limit,
// Export commands
audio_export_check_ready,
audio_export_document,
````

Add to `generate_handler!` macro (same list).

### Step 5.2: Implement Commands

**Create**: `src-tauri/src/tauri_api/sessions.rs`

```rust
use tauri::State;
use crate::ports::SessionRepository;

#[tauri::command]
#[specta::specta]
pub async fn session_create(
    repo: State<'_, Box<dyn SessionRepository>>,
    name: String,
    document_ids: Vec<String>,
) -> Result<ReadingSession, String> {
    repo.create(&name, &document_ids).await
}

// ... other commands
```

---

## Phase 6: Frontend State & UI

### Step 6.1: Session Store

**Create**: `src/stores/session-store.ts`

```typescript
import { create } from "zustand";
import type { ReadingSession } from "@/domain/sessions/session";

interface SessionState {
  sessions: ReadingSession[];
  activeSessionId: string | null;
  loading: boolean;
  error: string | null;

  loadSessions: () => Promise<void>;
  createSession: (
    name: string,
    documentIds: string[],
  ) => Promise<ReadingSession>;
  restoreSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  loading: false,
  error: null,

  loadSessions: async () => {
    set({ loading: true, error: null });
    try {
      const sessions = await sessionAdapter.list();
      set({ sessions, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  // ... other actions
}));
```

### Step 6.2: Session Menu Component

**Create**: `src/components/session-menu/SessionMenu.tsx`

Basic structure:

```tsx
import { useSessionStore } from '@/stores/session-store';

export function SessionMenu() {
  const { sessions, loadSessions, createSession } = useSessionStore();

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <div className="session-menu">
      <h3>Reading Sessions</h3>
      {sessions.map(session => (
        <SessionItem key={session.id} session={session} />
      ))}
      <button onClick={() => /* open create dialog */}>
        New Session
      </button>
    </div>
  );
}
```

---

## Phase 7: Audio Cache Enhancement

### Step 7.1: Extend AudioCacheAdapter

**File**: `src-tauri/src/adapters/audio_cache.rs`

Add methods:

- `store_with_metadata()` - writes to SQLite + filesystem
- `get_coverage()` - queries metadata for coverage stats
- `evict_lru()` - removes oldest entries

### Step 7.2: Cache Coverage UI

**Create**: `src/components/audio-progress/AudioCacheProgress.tsx`

```tsx
interface Props {
  documentId: string;
}

export function AudioCacheProgress({ documentId }: Props) {
  const [coverage, setCoverage] = useState<CoverageStats | null>(null);

  useEffect(() => {
    loadCoverage();
    const unsubscribe = onCacheCoverageUpdated((event) => {
      if (event.documentId === documentId) {
        setCoverage((prev) => ({ ...prev, ...event }));
      }
    });
    return () => unsubscribe();
  }, [documentId]);

  if (!coverage) return null;

  return (
    <div className="cache-progress">
      <progress value={coverage.cachedChunks} max={coverage.totalChunks} />
      <span>{coverage.coveragePercent}% cached</span>
    </div>
  );
}
```

---

## Phase 8: Audio Export

### Step 8.1: Add id3 Dependency

**File**: `src-tauri/Cargo.toml`

```toml
[dependencies]
id3 = "1.14"
```

### Step 8.2: Export Service

**Create**: `src-tauri/src/application/audio_export_service.rs`

Key functions:

- `check_readiness()` - verify all chunks cached
- `concatenate_audio()` - join MP3 samples
- `add_chapters()` - embed ID3v2 CHAP frames
- `write_output()` - save final file

### Step 8.3: Export Dialog

**Create**: `src/components/export-dialog/AudioExportDialog.tsx`

Features:

- Check readiness before enabling export
- Show missing chunks if not ready
- Progress indicator during export
- File path selection via dialog

---

## Verification Checklist

After implementation, verify:

```bash
# All tests pass
pnpm verify

# Frontend coverage maintained
pnpm test:coverage

# Backend tests pass
cd src-tauri && cargo test --features test-mocks

# Manual testing
pnpm tauri dev
```

### Manual Test Cases

1. **Session CRUD**
   - Create session with 2 documents
   - Close app, reopen, restore session
   - Documents open at correct pages

2. **Cache Coverage**
   - Play TTS on page 1
   - Verify coverage shows 10% (1 of 10 pages)
   - Play through all pages
   - Verify coverage shows 100%

3. **Export**
   - Cache entire document
   - Export to MP3
   - Open in VLC, verify chapter navigation

4. **LRU Eviction**
   - Set cache limit to 10MB
   - Cache more than 10MB of audio
   - Verify oldest entries evicted

---

## Next Steps

After implementation:

1. Run `/speckit.tasks` to generate detailed task breakdown
2. Create PR with feature branch
3. Request code review
