use crate::db::models::{Document, FileExistsResponse};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{Pool, Sqlite};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

#[derive(Debug, Serialize, Deserialize)]
pub struct AddDocumentRequest {
    pub file_path: String,
    pub title: Option<String>,
    pub page_count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDocumentRequest {
    pub id: String,
    pub title: Option<String>,
    pub page_count: Option<i32>,
    pub file_hash: Option<String>,
}

/// Compute SHA-256 hash of a file
fn compute_file_hash(file_path: &str) -> Result<String, String> {
    let mut file = File::open(file_path)
        .map_err(|e| format!("FILE_READ_ERROR: Cannot open file: {}", e))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer)
            .map_err(|e| format!("FILE_READ_ERROR: Cannot read file: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Add a new document to the library
/// Uses SHA-256 content hash as ID for duplicate detection
#[tauri::command]
pub async fn library_add_document(
    db: State<'_, DbInstances>,
    file_path: String,
    title: Option<String>,
    page_count: Option<i32>,
) -> Result<Document, String> {
    let pool = get_pool(&db).await?;

    // Check if file exists
    if !Path::new(&file_path).exists() {
        return Err("FILE_NOT_FOUND: File does not exist at path".to_string());
    }

    // Compute file hash for content-based identification
    let file_hash = compute_file_hash(&file_path)?;

    // Check if document with same hash already exists (duplicate detection)
    let existing: Vec<Document> = sqlx::query_as(
        "SELECT id, file_path, title, page_count, current_page, scroll_position, last_tts_chunk_id, last_opened_at, file_hash, created_at
         FROM documents WHERE id = ?"
    )
    .bind(&file_hash)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    if let Some(mut existing_doc) = existing.into_iter().next() {
        // Document exists, update path if different and return
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
         VALUES (?, ?, ?, ?, 1, 0.0, ?, ?, ?)"
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
pub async fn library_get_document(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<Option<Document>, String> {
    let pool = get_pool(&db).await?;

    let docs: Vec<Document> = sqlx::query_as(
        "SELECT id, file_path, title, page_count, current_page, scroll_position, last_tts_chunk_id, last_opened_at, file_hash, created_at
         FROM documents WHERE id = ?"
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(docs.into_iter().next())
}

/// Get a document by file path
#[tauri::command]
pub async fn library_get_document_by_path(
    db: State<'_, DbInstances>,
    file_path: String,
) -> Result<Option<Document>, String> {
    let pool = get_pool(&db).await?;

    let docs: Vec<Document> = sqlx::query_as(
        "SELECT id, file_path, title, page_count, current_page, scroll_position, last_tts_chunk_id, last_opened_at, file_hash, created_at
         FROM documents WHERE file_path = ?"
    )
    .bind(&file_path)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(docs.into_iter().next())
}

/// Update reading progress for a document
#[tauri::command]
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
        "UPDATE documents SET current_page = ?, scroll_position = ?, last_tts_chunk_id = ?, last_opened_at = ? WHERE id = ?"
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
        return Ok(()); // Nothing to update
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
         FROM documents ORDER BY {}", order
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
pub async fn library_remove_document(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<(), String> {
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
pub async fn library_check_file_exists(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<FileExistsResponse, String> {
    let doc = library_get_document(db, id).await?;

    match doc {
        Some(d) => Ok(FileExistsResponse {
            exists: Path::new(&d.file_path).exists(),
            file_path: d.file_path,
        }),
        None => Err("NOT_FOUND: Document with ID not found".to_string()),
    }
}

/// Update title of a document
#[tauri::command]
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
pub async fn library_relocate_document(
    db: State<'_, DbInstances>,
    id: String,
    new_file_path: String,
) -> Result<Document, String> {
    // Check if file exists at new path
    if !Path::new(&new_file_path).exists() {
        return Err("FILE_NOT_FOUND: File not at new path".to_string());
    }

    // Verify hash matches (same file content)
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

// Helper to get the SQLite pool - clones the pool to avoid lifetime issues
async fn get_pool(db: &State<'_, DbInstances>) -> Result<Pool<Sqlite>, String> {
    let instances = db.0.read().await;
    let db_pool = instances
        .get("sqlite:pdf-reader.db")
        .ok_or_else(|| "DATABASE_ERROR: Database not initialized".to_string())?;

    match db_pool {
        DbPool::Sqlite(pool) => Ok(pool.clone()),
        #[allow(unreachable_patterns)]
        _ => Err("DATABASE_ERROR: Expected SQLite database".to_string()),
    }
}

// Implement FromRow for Document to work with sqlx
impl<'r> sqlx::FromRow<'r, sqlx::sqlite::SqliteRow> for Document {
    fn from_row(row: &'r sqlx::sqlite::SqliteRow) -> Result<Self, sqlx::Error> {
        use sqlx::Row;
        Ok(Document {
            id: row.get("id"),
            file_path: row.get("file_path"),
            title: row.get("title"),
            page_count: row.get("page_count"),
            current_page: row.get("current_page"),
            scroll_position: row.get("scroll_position"),
            last_tts_chunk_id: row.get("last_tts_chunk_id"),
            last_opened_at: row.get("last_opened_at"),
            file_hash: row.get("file_hash"),
            created_at: row.get("created_at"),
        })
    }
}
