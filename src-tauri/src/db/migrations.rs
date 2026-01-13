/// SQL migrations for the PDF Reader database
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
];

/// SQLite PRAGMA configuration for optimal performance
/// These should be run at connection time
pub const PRAGMA_CONFIG: &str = r#"
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000;
PRAGMA busy_timeout = 5000;
"#;

/// Get the SQL for creating initial schema
pub fn get_init_sql() -> &'static str {
    MIGRATIONS[0]
}

/// Get PRAGMA configuration SQL
pub fn get_pragma_sql() -> &'static str {
    PRAGMA_CONFIG
}
