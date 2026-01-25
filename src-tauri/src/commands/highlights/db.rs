//! Database helpers for highlight commands
//!
//! Contains database access, row mapping, and validation helpers.

use crate::db::models::{Highlight, Rect};
use sqlx::{Pool, Sqlite};
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

/// Validate hex color format (#RRGGBB)
pub fn is_valid_hex_color(color: &str) -> bool {
    color.len() == 7 && color.starts_with('#') && color[1..].chars().all(|c| c.is_ascii_hexdigit())
}

/// Database row representation for highlights
pub struct HighlightRow {
    pub id: String,
    pub document_id: String,
    pub page_number: i32,
    pub rects: String,
    pub color: String,
    pub text_content: Option<String>,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

impl<'r> sqlx::FromRow<'r, sqlx::sqlite::SqliteRow> for HighlightRow {
    fn from_row(row: &'r sqlx::sqlite::SqliteRow) -> Result<Self, sqlx::Error> {
        use sqlx::Row;
        Ok(HighlightRow {
            id: row.get("id"),
            document_id: row.get("document_id"),
            page_number: row.get("page_number"),
            rects: row.get("rects"),
            color: row.get("color"),
            text_content: row.get("text_content"),
            note: row.get("note"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }
}

impl HighlightRow {
    /// Convert database row to Highlight model
    pub fn into_highlight(self) -> Result<Highlight, String> {
        let rects: Vec<Rect> = serde_json::from_str(&self.rects)
            .map_err(|e| format!("DESERIALIZATION_ERROR: {}", e))?;

        Ok(Highlight {
            id: self.id,
            document_id: self.document_id,
            page_number: self.page_number,
            rects,
            color: self.color,
            text_content: self.text_content,
            note: self.note,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}
