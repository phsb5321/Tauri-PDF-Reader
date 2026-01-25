//! Database helpers for library commands
//!
//! Contains database access, row mapping, and file operations.

use crate::db::models::Document;
use sha2::{Digest, Sha256};
use sqlx::{Pool, Sqlite};
use std::fs::File;
use std::io::Read;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

/// Get SQLite pool from Tauri state
pub async fn get_pool(db: &State<'_, DbInstances>) -> Result<Pool<Sqlite>, String> {
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

/// Compute SHA-256 hash of a file for content-based identification
pub fn compute_file_hash(file_path: &str) -> Result<String, String> {
    let mut file =
        File::open(file_path).map_err(|e| format!("FILE_READ_ERROR: Cannot open file: {}", e))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file
            .read(&mut buffer)
            .map_err(|e| format!("FILE_READ_ERROR: Cannot read file: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Implement FromRow for Document to work with sqlx
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
