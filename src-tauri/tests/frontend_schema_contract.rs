//! The schema the app actually ships, executed and asserted.
//!
//! `src/lib/db-init.ts` is the production DDL: tauri-plugin-sql runs those
//! statements against the real `pdf-reader.db` at start-up. Nothing else does —
//! `src-tauri/src/db/migrations.rs` is a `cfg(test)` fixture, and the two copies
//! drifted far enough that a shipped profile had no `tts_cache_metadata`,
//! `cache_settings`, `reading_sessions` or `session_documents` while every Rust
//! test passed against tables production never had.
//!
//! The assertions live on the Rust side because this is where SQLite is
//! available in CI: the frontend job runs on Node 20, and `node:sqlite` only
//! exists from Node 22.5. Reading the TypeScript file from a Rust test is odd,
//! but it is the version that actually runs on every pull request, and executing
//! the real statements catches things a string comparison cannot — a view whose
//! join is wrong, a foreign key that does not cascade, a statement SQLite
//! rejects outright.

use sqlx::{Column, Executor, Row, SqlitePool};

const DB_INIT_TS: &str = include_str!("../../src/lib/db-init.ts");

/// Pull the backtick-quoted SQL out of one declaration in `db-init.ts`.
///
/// `decl` is matched literally and the scan stops at the first `terminator`
/// after it. Line comments are dropped first because the prose in that file
/// contains backticks of its own.
///
/// ponytail: a hand-rolled scan, not a TypeScript parser. It holds because each
/// block scanned contains nothing but template literals and `//` comments; the
/// sanity checks in `parses_the_production_ddl` fail loudly if that stops being
/// true, rather than silently yielding an empty list.
fn sql_literals(decl: &str, terminator: &str) -> Vec<String> {
    // `find` takes the first hit, so a second declaration of the same name would
    // be silently ignored and a longer identifier could be anchored on instead —
    // `MIGRATIONS` matches the start of `MIGRATIONS_V2`. Both would have this
    // test validating a schema the app does not ship.
    let hits = DB_INIT_TS.matches(decl).count();
    assert_eq!(
        hits, 1,
        "db-init.ts must declare `{decl}` exactly once — found {hits}. Did the \
         production DDL move, or does a longer identifier start with this name?"
    );
    let start = DB_INIT_TS.find(decl).unwrap();
    let next = DB_INIT_TS[start + decl.len()..].chars().next();
    assert!(
        !matches!(next, Some(c) if c.is_alphanumeric() || c == '_'),
        "`{decl}` matched the beginning of a longer identifier — widen the needle"
    );

    let body = &DB_INIT_TS[start..];
    let end = body
        .find(terminator)
        .unwrap_or_else(|| panic!("`{decl}` must be terminated by `{terminator}`"));
    let body = &body[..end + terminator.len()];

    let uncommented: String = body
        .lines()
        .filter(|line| !line.trim_start().starts_with("//"))
        .collect::<Vec<_>>()
        .join("\n");

    // Every literal opens and closes, so the count is even. Odd means either the
    // terminator turned up inside a literal and cut the scan short, or something
    // in the block carries a stray backtick — both invert the parity below and
    // fill the result with the gaps between the statements.
    let ticks = uncommented.matches('`').count();
    assert!(
        ticks.is_multiple_of(2),
        "`{decl}` holds {ticks} backticks before `{terminator}` — either the \
         terminator landed inside a SQL literal or a stray backtick got in"
    );

    uncommented
        .split('`')
        .skip(1) // everything before the first backtick is the declaration
        .step_by(2) // odd chunks are inside the literals, even ones between them
        .map(str::to_string)
        .collect()
}

/// Every DDL statement `initSchema` executes, in the order it executes them.
///
/// Four declarations, because they run under different rules and the
/// distinction is load-bearing: `MIGRATIONS` entries run once per database and
/// are stamped in `_migrations`, whereas the contract views are torn down before
/// the migrations and rebuilt after, on every launch, so an edited view
/// definition reaches databases that already exist.
///
/// Not the whole of `initDatabase`: the `_migrations` stamps and the
/// `DEFAULT_SETTINGS` inserts are parameterised queries rather than literals,
/// and are covered by `src/lib/db-init.test.ts` against a recording fake. What
/// this builds is the schema, which is what the assertions below are about.
fn production_migrations() -> Vec<String> {
    let mut statements = sql_literals("const MIGRATIONS_TABLE", "`;");
    statements.extend(sql_literals("export const CONTRACT_VIEW_DROPS", "\n];"));
    statements.extend(sql_literals("export const MIGRATIONS", "\n];"));
    statements.extend(sql_literals("export const CONTRACT_VIEWS", "\n];"));
    statements
}

async fn shipped_schema() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    pool.execute("PRAGMA foreign_keys = ON").await.unwrap();
    for statement in production_migrations() {
        pool.execute(statement.as_str())
            .await
            .unwrap_or_else(|e| panic!("db-init.ts statement failed:\n{statement}\n\n{e}"));
    }
    pool
}

async fn columns_of(pool: &SqlitePool, table: &str) -> Vec<String> {
    sqlx::query(&format!("PRAGMA table_info({table})"))
        .fetch_all(pool)
        .await
        .unwrap()
        .iter()
        .map(|row| row.get::<String, _>("name"))
        .collect()
}

#[tokio::test]
async fn parses_the_production_ddl() {
    let statements = production_migrations();

    // A parse that quietly returned nothing would make every other test here
    // pass against an empty database.
    assert!(
        statements.len() >= 10,
        "expected the full migration list, extracted {} statement(s)",
        statements.len()
    );
    // One block per declaration: missing `CONTRACT_VIEWS` would leave every
    // view assertion below testing a database the app does not build.
    assert!(
        statements.iter().any(|s| s.contains("CREATE VIEW")),
        "no view was extracted — CONTRACT_VIEWS did not make it into the fixture"
    );
    // And the teardown has to come before the DDL it protects, or a migration
    // that drops a base column fails against the view still attached to it.
    let drop_view = statements
        .iter()
        .position(|s| s.contains("DROP VIEW"))
        .expect("no view teardown was extracted — CONTRACT_VIEW_DROPS is missing");
    let first_table = statements
        .iter()
        .position(|s| s.contains("CREATE TABLE IF NOT EXISTS documents"))
        .expect("the documents table is missing from what was extracted");
    assert!(
        drop_view < first_table,
        "the contract view teardown must come before the migrations \
         (found at {drop_view}, migrations start at {first_table})"
    );
    assert!(
        statements.iter().all(|s| !s.trim().is_empty()),
        "extracted an empty statement — the scan is picking up the gaps between literals"
    );

    // The scan assumes the array holds nothing but template literals, so the
    // odd-numbered chunks are statements and the even ones are the `,` and
    // comments between them. Add a backtick anywhere else in that array — a
    // backtick-quoted SQLite identifier, a block comment, a non-literal entry —
    // and the parity inverts: `statements` fills up with the *gaps*. Those look
    // like `,\n\n  ` and would still satisfy the two checks above, so assert
    // the shape of what came out, not just how much of it there is.
    for statement in &statements {
        let head = statement.trim_start();
        assert!(
            ["CREATE", "INSERT", "DROP", "ALTER", "PRAGMA", "UPDATE", "DELETE"]
                .iter()
                .any(|kw| head.starts_with(kw)),
            "extracted a chunk that is not a SQL statement, so the backtick scan has \
             lost parity — check db-init.ts for a backtick outside a migration literal:\n{}",
            &head[..head.len().min(120)]
        );
    }
}

#[tokio::test]
async fn ships_every_table_the_command_handlers_query() {
    let pool = shipped_schema().await;
    let tables: Vec<String> = sqlx::query("SELECT name FROM sqlite_master WHERE type = 'table'")
        .fetch_all(&pool)
        .await
        .unwrap()
        .iter()
        .map(|row| row.get::<String, _>("name"))
        .collect();

    for table in [
        "documents",
        "highlights",
        "settings",
        "tts_cache_metadata", // adapters/sqlite/audio_cache_repo.rs
        "cache_settings",     // adapters/sqlite/audio_cache_repo.rs, get_limit
        "reading_sessions",   // adapters/sqlite/session_repo.rs
        "session_documents",  // adapters/sqlite/session_repo.rs
    ] {
        assert!(
            tables.contains(&table.to_string()),
            "`{table}` is queried by a registered Tauri command but db-init.ts never creates it — \
             the command fails at runtime with \"no such table\". Tables present: {tables:?}"
        );
    }
}

#[tokio::test]
async fn tts_cache_metadata_has_the_columns_the_insert_binds() {
    // audio_cache_repo.rs:55 names thirteen columns in one INSERT. A missing one
    // is a runtime error, not a compile error.
    let pool = shipped_schema().await;
    assert_eq!(
        columns_of(&pool, "tts_cache_metadata").await,
        vec![
            "cache_key",
            "document_id",
            "page_number",
            "text_hash",
            "voice_id",
            "settings_hash",
            "file_path",
            "size_bytes",
            "created_at",
            "last_accessed_at",
            "chunk_index",
            "duration_ms",
            "total_chunks",
        ]
    );
}

#[tokio::test]
async fn is_re_runnable_because_a_crash_before_the_stamp_replays_it() {
    // `runMigrations` records a version only after its statements succeeded, so
    // a crash in between leaves that migration half-applied and it runs again on
    // the next launch. `CONTRACT_VIEWS` is re-executed unconditionally every
    // launch. Either way a second execution has to be harmless.
    let pool = shipped_schema().await;
    for statement in production_migrations() {
        pool.execute(statement.as_str())
            .await
            .unwrap_or_else(|e| panic!("second run of a statement failed:\n{statement}\n\n{e}"));
    }
}

/// Exactly what an out-of-process consumer selects. Adding a column is a
/// feature; removing or renaming one breaks somebody else's script silently, at
/// runtime, on their machine. See `docs/highlight-consumer-contract.md`.
const CITATION_COLUMNS: [&str; 10] = [
    "highlight_id",
    "document_id",
    "file_path",
    "title",
    "page_number",
    "text_content",
    "note",
    "color",
    "created_at",
    "document_last_opened_at",
];

#[tokio::test]
async fn exposes_v_highlight_citations_to_external_readers() {
    let pool = shipped_schema().await;

    pool.execute(
        "INSERT INTO documents (id, file_path, title, page_count, created_at, last_opened_at)
         VALUES ('doc-1', '/books/ddia.pdf', 'Designing Data-Intensive Applications', 600,
                 '2026-07-01T00:00:00Z', '2026-07-31T12:00:00Z')",
    )
    .await
    .unwrap();
    pool.execute(
        "INSERT INTO highlights (id, document_id, page_number, rects, color, text_content, note, created_at)
         VALUES ('hl-1', 'doc-1', 42, '[]', '#FFEB3B',
                 'Reliability means the system continues to work correctly.',
                 'anchors gap 7', '2026-07-31T12:05:00Z')",
    )
    .await
    .unwrap();

    let rows = sqlx::query("SELECT * FROM v_highlight_citations")
        .fetch_all(&pool)
        .await
        .expect("v_highlight_citations must exist — external tools select from it");

    assert_eq!(rows.len(), 1);

    let mut names: Vec<&str> = rows[0].columns().iter().map(|c| c.name()).collect();
    let mut expected = CITATION_COLUMNS.to_vec();
    names.sort_unstable();
    expected.sort_unstable();
    assert_eq!(names, expected, "the citation view's column names changed");

    // The values too: a view that joined the wrong way would still have the
    // right column list.
    assert_eq!(rows[0].get::<String, _>("highlight_id"), "hl-1");
    assert_eq!(rows[0].get::<String, _>("file_path"), "/books/ddia.pdf");
    assert_eq!(rows[0].get::<i64, _>("page_number"), 42);
    assert_eq!(
        rows[0].get::<String, _>("text_content"),
        "Reliability means the system continues to work correctly."
    );
    assert_eq!(rows[0].get::<String, _>("note"), "anchors gap 7");
    assert_eq!(
        rows[0].get::<String, _>("document_last_opened_at"),
        "2026-07-31T12:00:00Z"
    );
}

#[tokio::test]
async fn keeps_the_base_columns_the_view_is_built_from() {
    let pool = shipped_schema().await;

    let documents = columns_of(&pool, "documents").await;
    for column in ["id", "file_path", "title", "last_opened_at"] {
        assert!(
            documents.contains(&column.to_string()),
            "documents.{column} went missing"
        );
    }

    let highlights = columns_of(&pool, "highlights").await;
    for column in [
        "id",
        "document_id",
        "page_number",
        "text_content",
        "note",
        "created_at",
    ] {
        assert!(
            highlights.contains(&column.to_string()),
            "highlights.{column} went missing"
        );
    }
}

#[tokio::test]
async fn deleting_a_document_takes_its_citations_with_it() {
    let pool = shipped_schema().await;
    // Per-connection pragma, and the pool may hand out a different connection.
    pool.execute("PRAGMA foreign_keys = ON").await.unwrap();
    pool.execute("INSERT INTO documents (id, file_path, created_at) VALUES ('d', '/a.pdf', 'now')")
        .await
        .unwrap();
    pool.execute(
        "INSERT INTO highlights (id, document_id, page_number, rects, color, created_at)
         VALUES ('h', 'd', 1, '[]', '#FFEB3B', 'now')",
    )
    .await
    .unwrap();

    pool.execute("DELETE FROM documents WHERE id = 'd'")
        .await
        .unwrap();

    let remaining: i64 = sqlx::query("SELECT count(*) AS n FROM v_highlight_citations")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get("n");
    assert_eq!(
        remaining, 0,
        "the view is showing highlights of a deleted document"
    );
}
