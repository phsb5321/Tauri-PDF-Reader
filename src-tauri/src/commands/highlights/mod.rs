//! Highlight command handlers
//!
//! Tauri commands for highlight CRUD operations and export.

mod db;
mod export;

use crate::db::models::{
    BatchCreateResponse, CreateHighlightInput, DeleteResponse, ExportResponse, Highlight,
    ListHighlightsResponse, Rect,
};
use chrono::Utc;
use db::{get_pool, is_valid_hex_color, HighlightRow};
use tauri::State;
use tauri_plugin_sql::DbInstances;
use uuid::Uuid;

/// Create a new highlight
#[tauri::command]
#[specta::specta]
pub async fn highlights_create(
    db: State<'_, DbInstances>,
    document_id: String,
    page_number: i32,
    rects: Vec<Rect>,
    color: String,
    text_content: Option<String>,
) -> Result<Highlight, String> {
    if rects.is_empty() {
        return Err("EMPTY_RECTS: Rects array cannot be empty".to_string());
    }
    if !is_valid_hex_color(&color) {
        return Err("INVALID_COLOR: Color must be hex format #RRGGBB".to_string());
    }
    if page_number < 1 {
        return Err("INVALID_PAGE: Page number must be >= 1".to_string());
    }

    let pool = get_pool(&db).await?;

    let doc_exists: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM documents WHERE id = ?")
        .bind(&document_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    if doc_exists == 0 {
        return Err("DOCUMENT_NOT_FOUND: Document does not exist".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let rects_json =
        serde_json::to_string(&rects).map_err(|e| format!("SERIALIZATION_ERROR: {}", e))?;

    sqlx::query(
        "INSERT INTO highlights (id, document_id, page_number, rects, color, text_content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&document_id)
    .bind(page_number)
    .bind(&rects_json)
    .bind(&color)
    .bind(&text_content)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(Highlight {
        id,
        document_id,
        page_number,
        rects,
        color,
        text_content,
        note: None,
        created_at: now,
        updated_at: None,
    })
}

/// Create multiple highlights in a batch
#[tauri::command]
#[specta::specta]
pub async fn highlights_batch_create(
    db: State<'_, DbInstances>,
    highlights: Vec<CreateHighlightInput>,
) -> Result<BatchCreateResponse, String> {
    let pool = get_pool(&db).await?;
    let mut created_highlights = Vec::new();

    for input in &highlights {
        if input.rects.is_empty() {
            return Err("EMPTY_RECTS: All highlights must have rects".to_string());
        }
        if !is_valid_hex_color(&input.color) {
            return Err("INVALID_COLOR: All colors must be hex format #RRGGBB".to_string());
        }
    }

    for input in highlights {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let rects_json = serde_json::to_string(&input.rects)
            .map_err(|e| format!("SERIALIZATION_ERROR: {}", e))?;

        sqlx::query(
            "INSERT INTO highlights (id, document_id, page_number, rects, color, text_content, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&input.document_id)
        .bind(input.page_number)
        .bind(&rects_json)
        .bind(&input.color)
        .bind(&input.text_content)
        .bind(&now)
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

        created_highlights.push(Highlight {
            id,
            document_id: input.document_id,
            page_number: input.page_number,
            rects: input.rects,
            color: input.color,
            text_content: input.text_content,
            note: None,
            created_at: now,
            updated_at: None,
        });
    }

    let count = created_highlights.len() as i32;
    Ok(BatchCreateResponse {
        highlights: created_highlights,
        created: count,
    })
}

/// List highlights for a specific page
#[tauri::command]
#[specta::specta]
pub async fn highlights_list_for_page(
    db: State<'_, DbInstances>,
    document_id: String,
    page_number: i32,
) -> Result<ListHighlightsResponse, String> {
    let pool = get_pool(&db).await?;

    let rows: Vec<HighlightRow> = sqlx::query_as(
        "SELECT id, document_id, page_number, rects, color, text_content, note, created_at, updated_at
         FROM highlights WHERE document_id = ? AND page_number = ? ORDER BY created_at ASC",
    )
    .bind(&document_id)
    .bind(page_number)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    let highlights: Vec<Highlight> = rows
        .into_iter()
        .map(|row| row.into_highlight())
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ListHighlightsResponse { highlights })
}

/// List all highlights for a document
#[tauri::command]
#[specta::specta]
pub async fn highlights_list_for_document(
    db: State<'_, DbInstances>,
    document_id: String,
) -> Result<ListHighlightsResponse, String> {
    let pool = get_pool(&db).await?;

    let rows: Vec<HighlightRow> = sqlx::query_as(
        "SELECT id, document_id, page_number, rects, color, text_content, note, created_at, updated_at
         FROM highlights WHERE document_id = ? ORDER BY page_number ASC, created_at ASC",
    )
    .bind(&document_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    let highlights: Vec<Highlight> = rows
        .into_iter()
        .map(|row| row.into_highlight())
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ListHighlightsResponse { highlights })
}

/// Get a single highlight by ID
#[tauri::command]
#[specta::specta]
pub async fn highlights_get(db: State<'_, DbInstances>, id: String) -> Result<Highlight, String> {
    let pool = get_pool(&db).await?;

    let rows: Vec<HighlightRow> = sqlx::query_as(
        "SELECT id, document_id, page_number, rects, color, text_content, note, created_at, updated_at
         FROM highlights WHERE id = ?",
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    rows.into_iter()
        .next()
        .ok_or_else(|| "NOT_FOUND: Highlight not found".to_string())?
        .into_highlight()
}

/// Update a highlight's color or note
#[tauri::command]
#[specta::specta]
pub async fn highlights_update(
    db: State<'_, DbInstances>,
    id: String,
    color: Option<String>,
    note: Option<String>,
) -> Result<Highlight, String> {
    if let Some(ref c) = color {
        if !is_valid_hex_color(c) {
            return Err("INVALID_COLOR: Color must be hex format #RRGGBB".to_string());
        }
    }

    let pool = get_pool(&db).await?;
    let now = Utc::now().to_rfc3339();

    let mut updates = Vec::new();
    if color.is_some() {
        updates.push("color = ?");
    }
    updates.push("note = ?");
    updates.push("updated_at = ?");

    let query = format!("UPDATE highlights SET {} WHERE id = ?", updates.join(", "));

    let mut q = sqlx::query(&query);
    if let Some(ref c) = color {
        q = q.bind(c);
    }
    q = q.bind(&note);
    q = q.bind(&now);
    q = q.bind(&id);

    let result = q
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("NOT_FOUND: Highlight not found".to_string());
    }

    highlights_get(db, id).await
}

/// Delete a highlight
#[tauri::command]
#[specta::specta]
pub async fn highlights_delete(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<DeleteResponse, String> {
    let pool = get_pool(&db).await?;

    let result = sqlx::query("DELETE FROM highlights WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("NOT_FOUND: Highlight not found".to_string());
    }

    Ok(DeleteResponse {
        success: true,
        deleted: Some(1),
    })
}

/// Delete all highlights for a document
#[tauri::command]
#[specta::specta]
pub async fn highlights_delete_for_document(
    db: State<'_, DbInstances>,
    document_id: String,
) -> Result<DeleteResponse, String> {
    let pool = get_pool(&db).await?;

    let result = sqlx::query("DELETE FROM highlights WHERE document_id = ?")
        .bind(&document_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(DeleteResponse {
        success: true,
        deleted: Some(result.rows_affected() as i32),
    })
}

/// Export highlights to markdown or JSON
#[tauri::command]
#[specta::specta]
pub async fn highlights_export(
    db: State<'_, DbInstances>,
    document_id: String,
    format: String,
) -> Result<ExportResponse, String> {
    let pool = get_pool(&db).await?;

    let title: Option<String> = sqlx::query_scalar("SELECT title FROM documents WHERE id = ?")
        .bind(&document_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?
        .flatten();

    let doc_title = title.unwrap_or_else(|| "Untitled".to_string());
    let response = highlights_list_for_document(db, document_id.clone()).await?;

    Ok(export::build_export_response(
        &document_id,
        &doc_title,
        &response.highlights,
        &format,
    ))
}
