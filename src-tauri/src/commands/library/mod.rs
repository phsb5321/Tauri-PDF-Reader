//! Library command handlers
//!
//! Tauri commands for document library management.

// `pub(crate)` so sibling command modules can reach `get_pool` rather than
// each re-deriving the pool lookup from `DbInstances`.
pub(crate) mod db;
mod heal;

use crate::commands::cover::remove_covers_for_document;
use crate::db::models::{Document, FileExistsResponse};
use crate::domain::cover::is_valid_doc_id;
use chrono::Utc;
use db::{compute_file_hash, get_pool, validate_pdf_path};
use heal::{collect_pdfs, find_by_hash, rank_candidates, search_roots};
use sqlx::Row;
use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri::{AppHandle, State};
use tauri_plugin_fs::FsExt;
use tauri_plugin_sql::DbInstances;

use crate::commands::audio_cache::create_service as create_audio_cache_service;

fn require_expected_hash(file_hash: &str, expected_sha256: Option<&str>) -> Result<(), String> {
    if expected_sha256.is_some_and(|expected| !expected.eq_ignore_ascii_case(file_hash)) {
        return Err(
            "HASH_MISMATCH: File content changed while the document was being added".to_string(),
        );
    }
    Ok(())
}

/// Add a new document to the library
/// Uses SHA-256 content hash as ID for duplicate detection
#[tauri::command]
#[specta::specta]
pub async fn library_add_document(
    db: State<'_, DbInstances>,
    file_path: String,
    title: Option<String>,
    page_count: Option<i32>,
    expected_sha256: Option<String>,
) -> Result<Document, String> {
    let pool = get_pool(&db).await?;

    if !Path::new(&file_path).exists() {
        return Err("FILE_NOT_FOUND: File does not exist at path".to_string());
    }

    let file_hash = compute_file_hash(&file_path)?;
    // Fresh imports parse bytes in the frontend before this command creates
    // their row. Refuse a path swap between those reads BEFORE touching the
    // database: the caller supplies the SHA of the exact bytes it parsed, and
    // a document id is this same lowercase SHA-256.
    require_expected_hash(&file_hash, expected_sha256.as_deref())?;

    // Check for existing document with same hash
    let existing: Vec<Document> = sqlx::query_as(
        "SELECT id, file_path, title, page_count, current_page, scroll_position, last_tts_chunk_id, last_opened_at, file_hash, created_at
         FROM documents WHERE id = ?",
    )
    .bind(&file_hash)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    if let Some(mut existing_doc) = existing.into_iter().next() {
        if existing_doc.file_path != file_path {
            sqlx::query("UPDATE documents SET file_path = ? WHERE id = ?")
                .bind(&file_path)
                .bind(&file_hash)
                .execute(&pool)
                .await
                .map_err(|e| format!("DATABASE_ERROR: {}", e))?;
            existing_doc.file_path = file_path;
        }
        return Ok(existing_doc);
    }

    let now = Utc::now().to_rfc3339();
    let doc_title = title.or_else(|| {
        Path::new(&file_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
    });

    sqlx::query(
        "INSERT INTO documents (id, file_path, title, page_count, current_page, scroll_position, last_opened_at, file_hash, created_at)
         VALUES (?, ?, ?, ?, 1, 0.0, ?, ?, ?)",
    )
    .bind(&file_hash)
    .bind(&file_path)
    .bind(&doc_title)
    .bind(page_count)
    .bind(&now)
    .bind(&file_hash)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(Document {
        id: file_hash.clone(),
        file_path,
        title: doc_title,
        page_count,
        current_page: 1,
        scroll_position: 0.0,
        last_tts_chunk_id: None,
        last_opened_at: Some(now.clone()),
        file_hash: Some(file_hash),
        created_at: now,
    })
}

/// Get a document by ID
#[tauri::command]
#[specta::specta]
pub async fn library_get_document(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<Option<Document>, String> {
    let pool = get_pool(&db).await?;

    let docs: Vec<Document> = sqlx::query_as(
        "SELECT id, file_path, title, page_count, current_page, scroll_position, last_tts_chunk_id, last_opened_at, file_hash, created_at
         FROM documents WHERE id = ?",
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(docs.into_iter().next())
}

/// Get a document by file path
#[tauri::command]
#[specta::specta]
pub async fn library_get_document_by_path(
    db: State<'_, DbInstances>,
    file_path: String,
) -> Result<Option<Document>, String> {
    let pool = get_pool(&db).await?;

    let docs: Vec<Document> = sqlx::query_as(
        "SELECT id, file_path, title, page_count, current_page, scroll_position, last_tts_chunk_id, last_opened_at, file_hash, created_at
         FROM documents WHERE file_path = ?",
    )
    .bind(&file_path)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(docs.into_iter().next())
}

/// Update reading progress for a document
#[tauri::command]
#[specta::specta]
pub async fn library_update_progress(
    db: State<'_, DbInstances>,
    id: String,
    current_page: i32,
    scroll_position: Option<f64>,
    last_tts_chunk_id: Option<String>,
) -> Result<Document, String> {
    let pool = get_pool(&db).await?;
    let now = Utc::now().to_rfc3339();
    let scroll = scroll_position.unwrap_or(0.0);

    let result = sqlx::query(
        "UPDATE documents SET current_page = ?, scroll_position = ?, last_tts_chunk_id = ?, last_opened_at = ? WHERE id = ?",
    )
    .bind(current_page)
    .bind(scroll)
    .bind(&last_tts_chunk_id)
    .bind(&now)
    .bind(&id)
    .execute(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("NOT_FOUND: Document with ID not found".to_string());
    }

    library_get_document(db, id)
        .await?
        .ok_or_else(|| "NOT_FOUND: Document not found after update".to_string())
}

/// Update document metadata
#[tauri::command]
#[specta::specta]
pub async fn library_update_document(
    db: State<'_, DbInstances>,
    id: String,
    title: Option<String>,
    page_count: Option<i32>,
    file_hash: Option<String>,
) -> Result<(), String> {
    let pool = get_pool(&db).await?;

    let mut query = String::from("UPDATE documents SET ");
    let mut updates = Vec::new();

    if title.is_some() {
        updates.push("title = ?");
    }
    if page_count.is_some() {
        updates.push("page_count = ?");
    }
    if file_hash.is_some() {
        updates.push("file_hash = ?");
    }

    if updates.is_empty() {
        return Ok(());
    }

    query.push_str(&updates.join(", "));
    query.push_str(" WHERE id = ?");

    let mut q = sqlx::query(&query);
    if let Some(ref t) = title {
        q = q.bind(t);
    }
    if let Some(pc) = page_count {
        q = q.bind(pc);
    }
    if let Some(ref fh) = file_hash {
        q = q.bind(fh);
    }
    q = q.bind(&id);

    q.execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}

fn restore_library_file_grants<IsAllowed, Allow, Error>(
    documents: &[Document],
    is_allowed: IsAllowed,
    mut allow_file: Allow,
) -> usize
where
    IsAllowed: Fn(&Path) -> bool,
    Allow: FnMut(&Path) -> Result<(), Error>,
    Error: std::fmt::Display,
{
    let mut restored = 0;
    // Picker grants are path-based, not content-bound. Restore that same exact
    // path authority here; the cover pipeline still hashes bytes against the
    // row identity before it can cache or display a changed file.
    for document in documents {
        if !is_valid_doc_id(&document.id) {
            continue;
        }
        let path = match validate_pdf_path(&document.file_path) {
            Ok(path) => path,
            Err(_) => continue,
        };
        if is_allowed(&path) {
            continue;
        }
        match allow_file(&path) {
            Ok(()) => restored += 1,
            Err(error) => tracing::warn!(
                "Failed to restore file scope for library document {}: {}",
                document.id,
                error
            ),
        }
    }
    restored
}

/// List all documents in the library
#[tauri::command]
#[specta::specta]
pub async fn library_list_documents(
    app: AppHandle,
    db: State<'_, DbInstances>,
    order_by: Option<String>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<Document>, String> {
    let pool = get_pool(&db).await?;

    let order = match order_by.as_deref() {
        Some("created") => "created_at DESC",
        Some("title") => "title ASC",
        _ => "last_opened_at DESC NULLS LAST, created_at DESC",
    };

    let mut query = format!(
        "SELECT id, file_path, title, page_count, current_page, scroll_position, last_tts_chunk_id, last_opened_at, file_hash, created_at
         FROM documents ORDER BY {}",
        order
    );

    if let Some(l) = limit {
        query.push_str(&format!(" LIMIT {}", l));
    }
    if let Some(o) = offset {
        query.push_str(&format!(" OFFSET {}", o));
    }

    let docs: Vec<Document> = sqlx::query_as(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    let scope = app.fs_scope();
    restore_library_file_grants(
        &docs,
        |path| scope.is_allowed(path),
        |path| scope.allow_file(path),
    );

    Ok(docs)
}

/// Remove a document from the library
#[tauri::command]
#[specta::specta]
pub async fn library_remove_document(
    app: AppHandle,
    db: State<'_, DbInstances>,
    id: String,
) -> Result<(), String> {
    // Slice 104: deleting a book must not strand its cached audio on disk
    // (SECURITY.md retention section). Clear the document's cache FIRST —
    // files + metadata — so the delete cannot leak .mp3s. Best-effort: a
    // cache failure must not block the delete the user asked for, so it is
    // logged and the row is still removed.
    match create_audio_cache_service(&app, &db).await {
        Ok(service) => {
            if let Err(e) = service.clear_document(&id).await {
                tracing::warn!(
                    "Failed to clear audio cache for deleted document {}: {:?}",
                    id,
                    e
                );
            }
        }
        Err(e) => tracing::warn!(
            "Failed to construct audio cache service during document delete: {:?}",
            e
        ),
    }

    // Slice 121: deleting a book must not strand its derived cover raster on
    // disk. Best-effort, mirroring the audio-cache cleanup above — a cache
    // failure must not block the delete the user asked for.
    match app.path().app_cache_dir() {
        Ok(root) => {
            if let Err(e) = remove_covers_for_document(&root, &id) {
                tracing::warn!("Failed to remove covers for deleted document {id}: {e}");
            }
        }
        Err(e) => tracing::warn!("Failed to resolve app cache dir during document delete: {e}"),
    }

    let pool = get_pool(&db).await?;

    sqlx::query("DELETE FROM documents WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}

/// Mark a document as opened
#[tauri::command]
#[specta::specta]
pub async fn library_open_document(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<Document, String> {
    let pool = get_pool(&db).await?;
    let now = Utc::now().to_rfc3339();

    sqlx::query("UPDATE documents SET last_opened_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    library_get_document(db, id.clone())
        .await?
        .ok_or_else(|| "NOT_FOUND: Document with ID not found".to_string())
}

/// Check if a document's file still exists
#[tauri::command]
#[specta::specta]
pub async fn library_check_file_exists(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<FileExistsResponse, String> {
    let doc = library_get_document(db, id).await?;

    match doc {
        // Gate the existence probe through the same regular-`.pdf` validation
        // used at ingest, so a maliciously-inserted row (e.g. via the SQL
        // capability) cannot turn this into an arbitrary path existence oracle.
        Some(d) => Ok(FileExistsResponse {
            exists: validate_pdf_path(&d.file_path).is_ok(),
            file_path: d.file_path,
        }),
        None => Err("NOT_FOUND: Document with ID not found".to_string()),
    }
}

/// Update title of a document
#[tauri::command]
#[specta::specta]
pub async fn library_update_title(
    db: State<'_, DbInstances>,
    id: String,
    title: String,
) -> Result<Document, String> {
    if title.trim().is_empty() {
        return Err("EMPTY_TITLE: Title cannot be empty".to_string());
    }

    let pool = get_pool(&db).await?;

    let result = sqlx::query("UPDATE documents SET title = ? WHERE id = ?")
        .bind(&title)
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("NOT_FOUND: Document not found".to_string());
    }

    library_get_document(db, id)
        .await?
        .ok_or_else(|| "NOT_FOUND: Document not found after update".to_string())
}

/// Relocate a document to a new path
#[tauri::command]
#[specta::specta]
pub async fn library_relocate_document(
    db: State<'_, DbInstances>,
    id: String,
    new_file_path: String,
) -> Result<Document, String> {
    if !Path::new(&new_file_path).exists() {
        return Err("FILE_NOT_FOUND: File not at new path".to_string());
    }

    let new_hash = compute_file_hash(&new_file_path)?;
    if new_hash != id {
        return Err("HASH_MISMATCH: File at new path has different content".to_string());
    }

    let pool = get_pool(&db).await?;

    let result = sqlx::query("UPDATE documents SET file_path = ? WHERE id = ?")
        .bind(&new_file_path)
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("NOT_FOUND: Document not found".to_string());
    }

    library_get_document(db, id)
        .await?
        .ok_or_else(|| "NOT_FOUND: Document not found after update".to_string())
}

/// Relink a document whose file moved, without asking where it went.
///
/// The id already is the file's SHA-256, so a book that was renamed or filed
/// into a subfolder can be recovered by hashing what is nearby instead of being
/// shown as missing — reading position, highlights and shelves come back with
/// it. See `heal` for how "nearby" is bounded.
///
/// A document whose path still resolves is returned untouched, so the caller
/// can invoke this whenever a file fails to open without checking first.
///
/// The winning candidate is hashed twice — once to identify it, once inside
/// `library_relocate_document`. That is one extra read of one file, and it
/// keeps the content check that guards the UPDATE in a single place rather
/// than duplicated here.
#[tauri::command]
#[specta::specta]
pub async fn library_heal_document(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<Document, String> {
    let pool = get_pool(&db).await?;

    let docs: Vec<Document> = sqlx::query_as(
        "SELECT id, file_path, title, page_count, current_page, scroll_position, last_tts_chunk_id, last_opened_at, file_hash, created_at
         FROM documents WHERE id = ?",
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    let doc = docs
        .into_iter()
        .next()
        .ok_or_else(|| "NOT_FOUND: Document not found".to_string())?;

    // ponytail: a resolving path is taken at its word — no hash. Ceiling: if
    // the book moved away *and* a different PDF took its place at the old path,
    // this opens the impostor under the old book's progress. That is what the
    // library already did before healing existed, so it is not a regression,
    // and closing it here is not free: healing runs on every open (see
    // `LibraryView.handleDocumentOpen`), so verifying content would put a
    // SHA-256 of the whole file on the hot path, and `documents.file_hash` is
    // nullable — rows added before hashing have nothing to compare against.
    // Upgrade path: store size+mtime alongside the hash and compare those
    // first, hashing only when the cheap pair disagrees.
    if validate_pdf_path(&doc.file_path).is_ok() {
        return Ok(doc);
    }

    let rows = sqlx::query("SELECT id, file_path FROM documents")
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    // Documents that still resolve serve twice over: their folders are where
    // the missing book most likely went, and their files are already spoken
    // for, so hashing them would waste the candidate budget.
    let mut live_paths = Vec::new();
    let mut claimed: HashSet<PathBuf> = HashSet::new();

    for row in rows {
        let row_id: String = row.get("id");
        let file_path: String = row.get("file_path");

        if row_id == id || validate_pdf_path(&file_path).is_err() {
            continue;
        }

        claimed.insert(PathBuf::from(&file_path));
        live_paths.push(file_path);
    }

    let roots = search_roots(&doc.file_path, &live_paths);
    let candidates = collect_pdfs(&roots, &claimed);
    let wanted_name = Path::new(&doc.file_path)
        .file_name()
        .unwrap_or_else(|| OsStr::new(""));

    let found = find_by_hash(
        &rank_candidates(candidates, wanted_name),
        &id,
        compute_file_hash,
    )
    .ok_or_else(|| "FILE_NOT_FOUND: No file near the library matches this document".to_string())?;

    let new_file_path = found
        .to_str()
        .ok_or_else(|| "FILE_READ_ERROR: Path is not valid UTF-8".to_string())?
        .to_string();

    library_relocate_document(db, id, new_file_path).await
}

#[cfg(test)]
mod legacy_scope_tests {
    use super::restore_library_file_grants;
    use crate::db::models::Document;
    use std::cell::RefCell;
    use std::fs;
    use std::path::{Path, PathBuf};

    fn document(id: &str, file_path: &Path) -> Document {
        Document {
            id: id.to_string(),
            file_path: file_path.to_string_lossy().into_owned(),
            title: Some("Legacy book".to_string()),
            page_count: Some(1),
            current_page: 1,
            scroll_position: 0.0,
            last_tts_chunk_id: None,
            last_opened_at: None,
            file_hash: Some(id.to_string()),
            created_at: "2026-08-24T18:00:00Z".to_string(),
        }
    }

    fn scratch(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "lectrice-legacy-scope-{}-{name}",
            std::process::id()
        ))
    }

    #[test]
    fn restores_only_ungranted_regular_pdf_rows() {
        let root = scratch("candidates");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let pdf = root.join("book.pdf");
        let text = root.join("notes.txt");
        let missing = root.join("missing.pdf");
        fs::write(&pdf, b"%PDF-1.7 fixture").unwrap();
        fs::write(&text, b"not a pdf").unwrap();
        let valid_id = "a".repeat(64);
        let rows = vec![
            document(&valid_id, &pdf),
            document(&"b".repeat(64), &missing),
            document(&"c".repeat(64), &text),
            document("not-a-sha", &pdf),
            document(&"d".repeat(64), &root),
        ];
        let allowed = RefCell::new(Vec::<PathBuf>::new());

        let restored = restore_library_file_grants(
            &rows,
            |_| false,
            |path| {
                allowed.borrow_mut().push(path.to_path_buf());
                Ok::<_, String>(())
            },
        );

        assert_eq!(restored, 1);
        assert_eq!(allowed.into_inner(), vec![fs::canonicalize(&pdf).unwrap()]);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn already_allowed_file_is_not_added_again() {
        let root = scratch("already-allowed");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let pdf = root.join("book.pdf");
        fs::write(&pdf, b"%PDF-1.7 fixture").unwrap();
        let rows = vec![document(&"a".repeat(64), &pdf)];
        let allow_calls = RefCell::new(0usize);

        let restored = restore_library_file_grants(
            &rows,
            |_| true,
            |_| {
                *allow_calls.borrow_mut() += 1;
                Ok::<_, String>(())
            },
        );

        assert_eq!(restored, 0);
        assert_eq!(*allow_calls.borrow(), 0);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn one_scope_failure_does_not_block_later_documents() {
        let root = scratch("partial-failure");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let first = root.join("first.pdf");
        let second = root.join("second.pdf");
        fs::write(&first, b"%PDF-1.7 first").unwrap();
        fs::write(&second, b"%PDF-1.7 second").unwrap();
        let rows = vec![
            document(&"a".repeat(64), &first),
            document(&"b".repeat(64), &second),
        ];
        let attempts = RefCell::new(Vec::<PathBuf>::new());

        let restored = restore_library_file_grants(
            &rows,
            |_| false,
            |path| {
                let mut attempted = attempts.borrow_mut();
                attempted.push(path.to_path_buf());
                if attempted.len() == 1 {
                    Err("first grant failed")
                } else {
                    Ok(())
                }
            },
        );

        assert_eq!(restored, 1);
        assert_eq!(attempts.borrow().len(), 2);
        let _ = fs::remove_dir_all(root);
    }
}

#[cfg(test)]
mod expected_hash_tests {
    use super::require_expected_hash;

    #[test]
    fn fresh_import_accepts_the_hash_of_the_bytes_the_frontend_parsed() {
        assert!(require_expected_hash("a1b2", Some("A1B2")).is_ok());
        assert!(require_expected_hash("a1b2", None).is_ok());
    }

    #[test]
    fn fresh_import_rejects_a_path_swap_before_database_mutation() {
        let error = require_expected_hash("hash-of-file-b", Some("hash-of-file-a"))
            .expect_err("different bytes must fail closed");
        assert!(error.starts_with("HASH_MISMATCH:"));
    }
}
