/**
 * Database initialization for PDF Reader
 * Runs migrations to create required tables
 */
import Database from '@tauri-apps/plugin-sql';

// Individual migration statements - must be executed one at a time
const MIGRATIONS: string[] = [
  // Documents table
  `CREATE TABLE IF NOT EXISTS documents (
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
  )`,

  // Highlights table
  `CREATE TABLE IF NOT EXISTS highlights (
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
  )`,

  // Index for fast highlight lookup
  `CREATE INDEX IF NOT EXISTS idx_highlights_document_page ON highlights(document_id, page_number)`,

  // Index for library sorting
  `CREATE INDEX IF NOT EXISTS idx_documents_last_opened ON documents(last_opened_at DESC)`,

  // Settings table
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  // Migrations tracking
  `CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`,
];

// Default settings to insert
const DEFAULT_SETTINGS = [
  ['highlight.defaultColor', '"#FFEB3B"'],
  ['highlight.colors', '["#FFEB3B", "#4CAF50", "#2196F3", "#F44336"]'],
  ['tts.rate', '1.0'],
  ['tts.voice', 'null'],
  ['tts.followAlong', 'true'],
  ['theme', '"system"'],
  ['telemetry.analytics', 'false'],
  ['telemetry.errors', 'false'],
];

let initialized = false;

/**
 * Initialize the database with required tables
 * Safe to call multiple times - will only run once
 */
export async function initDatabase(): Promise<void> {
  if (initialized) {
    console.log('[DB] Already initialized, skipping');
    return;
  }

  // Check if running in Tauri
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    console.log('[DB] Not in Tauri environment, skipping database init');
    initialized = true;
    return;
  }

  try {
    console.log('[DB] Initializing database...');
    const db = await Database.load('sqlite:pdf-reader.db');

    // Run each migration statement
    for (let i = 0; i < MIGRATIONS.length; i++) {
      const sql = MIGRATIONS[i];
      console.log(`[DB] Running migration ${i + 1}/${MIGRATIONS.length}...`);
      try {
        await db.execute(sql);
        console.log(`[DB] Migration ${i + 1} completed`);
      } catch (err) {
        console.error(`[DB] Migration ${i + 1} failed:`, err);
        throw err;
      }
    }

    // Insert default settings
    console.log('[DB] Inserting default settings...');
    for (const [key, value] of DEFAULT_SETTINGS) {
      try {
        await db.execute(
          `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ($1, $2, datetime('now'))`,
          [key, value]
        );
      } catch (err) {
        console.warn(`[DB] Setting ${key} insert warning:`, err);
      }
    }

    // Mark migration as applied
    await db.execute(
      `INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (1, datetime('now'))`
    );

    console.log('[DB] Database initialized successfully');
    initialized = true;
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
}
