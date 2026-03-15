/// SQL migrations for the PDF Reader database
/// Note: Currently managed by tauri-plugin-sql, these are kept for reference/future use
#[allow(dead_code)]
pub const MIGRATIONS: &[&str] = &[
    // Migration 1: Initial schema
    r##"
    -- Documents table
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        title TEXT,
        page_count INTEGER,
        current_page INTEGER NOT NULL DEFAULT 1,
        scroll_position REAL NOT NULL DEFAULT 0.0,
        last_tts_chunk_id TEXT,
        last_opened_at TEXT,
        file_hash TEXT,
        created_at TEXT NOT NULL
    );

    -- Highlights table
    CREATE TABLE IF NOT EXISTS highlights (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        rects TEXT NOT NULL,
        color TEXT NOT NULL,
        text_content TEXT,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    -- Index for fast highlight lookup by document and page
    CREATE INDEX IF NOT EXISTS idx_highlights_document_page
        ON highlights(document_id, page_number);

    -- Index for library sorting by last opened
    CREATE INDEX IF NOT EXISTS idx_documents_last_opened
        ON documents(last_opened_at DESC);

    -- App settings table (key-value store)
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- Insert default settings
    INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
        ('highlight.defaultColor', '"#FFEB3B"', datetime('now')),
        ('highlight.colors', '["#FFEB3B", "#4CAF50", "#2196F3", "#F44336"]', datetime('now')),
        ('tts.rate', '1.0', datetime('now')),
        ('tts.voice', 'null', datetime('now')),
        ('tts.followAlong', 'true', datetime('now')),
        ('theme', '"system"', datetime('now')),
        ('telemetry.analytics', 'false', datetime('now')),
        ('telemetry.errors', 'false', datetime('now')),
        ('lastCleanShutdown', 'true', datetime('now'));

    -- Migrations tracking table
    CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (1, datetime('now'));
    "##,
    // Migration 2: TTS Cache Metadata table
    r##"
    -- TTS Audio Cache metadata table
    -- Stores metadata for cached TTS audio files stored in {cache_dir}/tts_cache/
    CREATE TABLE IF NOT EXISTS tts_cache_metadata (
        cache_key TEXT PRIMARY KEY,
        document_id TEXT,
        page_number INTEGER,
        text_hash TEXT NOT NULL,
        voice_id TEXT NOT NULL,
        settings_hash TEXT NOT NULL,
        file_path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    -- Index for document-based cache invalidation
    CREATE INDEX IF NOT EXISTS idx_tts_cache_document
        ON tts_cache_metadata(document_id);

    -- Index for voice-based cache invalidation
    CREATE INDEX IF NOT EXISTS idx_tts_cache_voice
        ON tts_cache_metadata(voice_id);

    INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (2, datetime('now'));
    "##,
    // Migration 3: Reading Sessions and Enhanced Audio Cache
    r##"
    -- Reading Sessions Table
    CREATE TABLE IF NOT EXISTS reading_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL
    );

    -- Session Documents Junction Table
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

    -- Enhance existing tts_cache_metadata with chunk tracking
    -- Note: Using ALTER TABLE for backward compatibility
    ALTER TABLE tts_cache_metadata ADD COLUMN chunk_index INTEGER;
    ALTER TABLE tts_cache_metadata ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE tts_cache_metadata ADD COLUMN total_chunks INTEGER;

    -- Indexes for reading sessions performance
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_last_accessed
        ON reading_sessions(last_accessed_at DESC);

    CREATE INDEX IF NOT EXISTS idx_session_documents_session
        ON session_documents(session_id, position);

    CREATE INDEX IF NOT EXISTS idx_tts_cache_document_page
        ON tts_cache_metadata(document_id, page_number);

    -- Cache settings table for configuration
    CREATE TABLE IF NOT EXISTS cache_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- Insert default cache settings (5GB = 5368709120 bytes)
    INSERT OR IGNORE INTO cache_settings (key, value, updated_at) VALUES
        ('max_size_bytes', '5368709120', datetime('now')),
        ('eviction_policy', 'lru', datetime('now'));

    INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (3, datetime('now'));
    "##,
];

/// SQLite PRAGMA configuration for optimal performance
/// These should be run at connection time
#[allow(dead_code)]
pub const PRAGMA_CONFIG: &str = r#"
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000;
PRAGMA busy_timeout = 5000;
"#;

/// Get the SQL for creating initial schema
#[allow(dead_code)]
pub fn get_init_sql() -> &'static str {
    MIGRATIONS[0]
}

/// Get PRAGMA configuration SQL
#[allow(dead_code)]
pub fn get_pragma_sql() -> &'static str {
    PRAGMA_CONFIG
}
