/**
 * Database initialization for Lectrice.
 *
 * Migrations are versioned and applied incrementally: on every launch each
 * migration whose version is absent from `_migrations` runs, in order, and then
 * records its own version.
 *
 * Before this, the runner executed one flat statement list and unconditionally
 * stamped `version = 1`. There was no way to express a second migration, so the
 * ones declared in `src-tauri/src/db/migrations.rs` (TTS cache metadata,
 * reading sessions) only ever existed in Rust unit tests — a real database
 * stopped at version 1. That left the session menu in the toolbar wired to
 * `reading_sessions`, a table no production database had.
 *
 * This module is the authoritative runner. `src-tauri/src/db/migrations.rs`
 * holds the same DDL for Rust test fixtures; the two must be kept in step.
 */
import Database from "@tauri-apps/plugin-sql";

export interface Migration {
  version: number;
  /** Idempotent statements, executed in order. One statement per entry. */
  statements: string[];
}

/**
 * Schema history. Append new migrations; never edit or renumber a released one —
 * databases in the field record versions, not content.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
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

      `CREATE INDEX IF NOT EXISTS idx_highlights_document_page ON highlights(document_id, page_number)`,

      `CREATE INDEX IF NOT EXISTS idx_documents_last_opened ON documents(last_opened_at DESC)`,

      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    statements: [
      // Metadata for TTS audio cached as files under {cache_dir}/tts_cache/.
      // chunk_index/duration_ms/total_chunks were originally bolted on by
      // ALTER TABLE in migration 3; they are declared here instead because no
      // database ever reached version 2 (the previous runner could only stamp
      // version 1), so this table has no deployed shape to preserve.
      `CREATE TABLE IF NOT EXISTS tts_cache_metadata (
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
        chunk_index INTEGER,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        total_chunks INTEGER,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )`,

      `CREATE INDEX IF NOT EXISTS idx_tts_cache_document ON tts_cache_metadata(document_id)`,

      `CREATE INDEX IF NOT EXISTS idx_tts_cache_voice ON tts_cache_metadata(voice_id)`,
    ],
  },
  {
    version: 3,
    statements: [
      `CREATE TABLE IF NOT EXISTS reading_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS session_documents (
        session_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        current_page INTEGER NOT NULL DEFAULT 1,
        scroll_position REAL NOT NULL DEFAULT 0.0,
        created_at TEXT NOT NULL,
        PRIMARY KEY (session_id, document_id),
        FOREIGN KEY (session_id) REFERENCES reading_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )`,

      `CREATE INDEX IF NOT EXISTS idx_reading_sessions_last_accessed ON reading_sessions(last_accessed_at DESC)`,

      `CREATE INDEX IF NOT EXISTS idx_session_documents_session ON session_documents(session_id, position)`,

      `CREATE INDEX IF NOT EXISTS idx_tts_cache_document_page ON tts_cache_metadata(document_id, page_number)`,

      `CREATE TABLE IF NOT EXISTS cache_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      // 5 GiB default cache ceiling.
      `INSERT OR IGNORE INTO cache_settings (key, value, updated_at)
        VALUES ('max_size_bytes', '5368709120', datetime('now'))`,

      `INSERT OR IGNORE INTO cache_settings (key, value, updated_at)
        VALUES ('eviction_policy', 'lru', datetime('now'))`,
    ],
  },
];

/** Records which migrations have run. Created before any migration executes. */
const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS _migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
)`;

// Re-applied on every launch so a key deleted from the table comes back.
const DEFAULT_SETTINGS = [
  ["highlight.defaultColor", '"#FFEB3B"'],
  ["highlight.colors", '["#FFEB3B", "#4CAF50", "#2196F3", "#F44336"]'],
  ["tts.rate", "1.0"],
  ["tts.voice", "null"],
  ["tts.followAlong", "true"],
  ["theme", '"system"'],
  ["telemetry.analytics", "false"],
  ["telemetry.errors", "false"],
];

/**
 * Minimal surface this module needs from a database handle, so the runner can
 * be exercised without a live Tauri connection.
 */
export interface MigrationRunnerDb {
  execute(sql: string, values?: unknown[]): Promise<unknown>;
  select<T>(sql: string, values?: unknown[]): Promise<T>;
}

/** Migrations not yet recorded in `_migrations`, in ascending version order. */
export function pendingMigrations(
  applied: ReadonlySet<number>,
  migrations: readonly Migration[] = MIGRATIONS,
): Migration[] {
  return migrations
    .filter((m) => !applied.has(m.version))
    .sort((a, b) => a.version - b.version);
}

async function appliedVersions(db: MigrationRunnerDb): Promise<Set<number>> {
  const rows = await db.select<{ version: number }[]>(
    "SELECT version FROM _migrations",
  );
  return new Set(rows.map((r) => r.version));
}

/**
 * Bring the schema up to the latest version. Applies only migrations this
 * database has not recorded, then records each one.
 *
 * @returns the versions applied by this call, ascending.
 */
export async function runMigrations(db: MigrationRunnerDb): Promise<number[]> {
  await db.execute(MIGRATIONS_TABLE);

  const pending = pendingMigrations(await appliedVersions(db));
  const applied: number[] = [];

  for (const migration of pending) {
    for (const sql of migration.statements) {
      await db.execute(sql);
    }

    await db.execute(
      `INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES ($1, datetime('now'))`,
      [migration.version],
    );
    applied.push(migration.version);
  }

  return applied;
}

let initialized = false;

/**
 * Initialize the database. Safe to call repeatedly — runs once per process.
 */
export async function initDatabase(): Promise<void> {
  if (initialized) {
    console.log("[DB] Already initialized, skipping");
    return;
  }

  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    console.log("[DB] Not in Tauri environment, skipping database init");
    initialized = true;
    return;
  }

  try {
    console.log("[DB] Initializing database...");
    const db = await Database.load("sqlite:pdf-reader.db");

    const applied = await runMigrations(db);
    console.log(
      applied.length > 0
        ? `[DB] Applied migration(s): ${applied.join(", ")}`
        : "[DB] Schema already up to date",
    );

    for (const [key, value] of DEFAULT_SETTINGS) {
      try {
        await db.execute(
          `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ($1, $2, datetime('now'))`,
          [key, value],
        );
      } catch (err) {
        console.warn(`[DB] Setting ${key} insert warning:`, err);
      }
    }

    console.log("[DB] Database initialized successfully");
    initialized = true;
  } catch (error) {
    console.error("[DB] Failed to initialize database:", error);
    throw error;
  }
}
