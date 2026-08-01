//! Library command handlers
//!
//! Tauri commands for document library management.

// `pub(crate)` so sibling command modules can reach `get_pool` rather than
// each re-deriving the pool lookup from `DbInstances`.
pub(crate) mod db;
mod heal;

use crate::db::models::{Document, FileExistsResponse};
use chrono::Utc;
use db::{compute_file_hash, get_pool, validate_pdf_path};
use heal::{collect_pdfs, find_by_hash, rank_candidates, search_roots};
use sqlx::Row;
use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use tauri::State;
use tauri_plugin_sql::DbInstances;

/// Add a new document to the library
/// Uses SHA-256 content hash as ID for duplicate detection
#[tauri::command]
#[specta::specta]
pub async fn library_add_document(
    db: State<'_, DbInstances>,
    file_path: String,
    title: Option<String>,
    page_count: Option<i32>,
) -> Result<Document, String> {
    let pool = get_pool(&db).await?;

    if !Path::new(&file_path).exists() {
        return Err("FILE_NOT_FOUND: File does not exist at path".to_string());
    }

    let file_hash = compute_file_hash(&file_path)?;

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

/// List all documents in the library
#[tauri::command]
#[specta::specta]
pub async fn library_list_documents(
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

    Ok(docs)
}

/// Remove a document from the library
#[tauri::command]
#[specta::specta]
pub async fn library_remove_document(db: State<'_, DbInstances>, id: String) -> Result<(), String> {
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
