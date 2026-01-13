use crate::db::models::{
    BatchCreateResponse, CreateHighlightInput, DeleteResponse, ExportResponse, Highlight,
    ListHighlightsResponse, Rect,
};
use chrono::Utc;
use sqlx::{Pool, Sqlite};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};
use uuid::Uuid;

/// Create a new highlight
#[tauri::command]
pub async fn highlights_create(
    db: State<'_, DbInstances>,
    document_id: String,
    page_number: i32,
    rects: Vec<Rect>,
    color: String,
    text_content: Option<String>,
) -> Result<Highlight, String> {
    // Validate inputs
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

    // Check document exists
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
    let rects_json = serde_json::to_string(&rects)
        .map_err(|e| format!("SERIALIZATION_ERROR: {}", e))?;

    sqlx::query(
        "INSERT INTO highlights (id, document_id, page_number, rects, color, text_content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
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
             VALUES (?, ?, ?, ?, ?, ?, ?)"
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
pub async fn highlights_list_for_page(
    db: State<'_, DbInstances>,
    document_id: String,
    page_number: i32,
) -> Result<ListHighlightsResponse, String> {
    let pool = get_pool(&db).await?;

    let rows: Vec<HighlightRow> = sqlx::query_as(
        "SELECT id, document_id, page_number, rects, color, text_content, note, created_at, updated_at
         FROM highlights WHERE document_id = ? AND page_number = ? ORDER BY created_at ASC"
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
pub async fn highlights_list_for_document(
    db: State<'_, DbInstances>,
    document_id: String,
) -> Result<ListHighlightsResponse, String> {
    let pool = get_pool(&db).await?;

    let rows: Vec<HighlightRow> = sqlx::query_as(
        "SELECT id, document_id, page_number, rects, color, text_content, note, created_at, updated_at
         FROM highlights WHERE document_id = ? ORDER BY page_number ASC, created_at ASC"
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
pub async fn highlights_get(
    db: State<'_, DbInstances>,
    id: String,
) -> Result<Highlight, String> {
    let pool = get_pool(&db).await?;

    let rows: Vec<HighlightRow> = sqlx::query_as(
        "SELECT id, document_id, page_number, rects, color, text_content, note, created_at, updated_at
         FROM highlights WHERE id = ?"
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

    // Build dynamic update query
    let mut updates = Vec::new();
    let mut params: Vec<String> = Vec::new();

    if let Some(ref c) = color {
        updates.push("color = ?");
        params.push(c.clone());
    }
    if note.is_some() || note.is_none() {
        // Always update note (can be set to NULL)
        updates.push("note = ?");
    }
    updates.push("updated_at = ?");

    if updates.is_empty() {
        return highlights_get(db, id).await;
    }

    let query = format!(
        "UPDATE highlights SET {} WHERE id = ?",
        updates.join(", ")
    );

    let mut q = sqlx::query(&query);
    if let Some(ref c) = color {
        q = q.bind(c);
    }
    q = q.bind(&note);
    q = q.bind(&now);
    q = q.bind(&id);

    let result = q.execute(&pool).await.map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("NOT_FOUND: Highlight not found".to_string());
    }

    highlights_get(db, id).await
}

/// Delete a highlight
#[tauri::command]
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
pub async fn highlights_export(
    db: State<'_, DbInstances>,
    document_id: String,
    format: String,
) -> Result<ExportResponse, String> {
    let pool = get_pool(&db).await?;

    // Get document title
    let title: Option<String> = sqlx::query_scalar("SELECT title FROM documents WHERE id = ?")
        .bind(&document_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?
        .flatten();

    let doc_title = title.unwrap_or_else(|| "Untitled".to_string());

    // Get highlights
    let response = highlights_list_for_document(db, document_id.clone()).await?;
    let highlights = response.highlights;

    let (content, ext) = match format.as_str() {
        "json" => {
            let export = serde_json::json!({
                "documentId": document_id,
                "documentTitle": doc_title,
                "exportedAt": Utc::now().to_rfc3339(),
                "highlights": highlights.iter().map(|h| {
                    serde_json::json!({
                        "pageNumber": h.page_number,
                        "textContent": h.text_content,
                        "color": h.color,
                        "note": h.note
                    })
                }).collect::<Vec<_>>()
            });
            (serde_json::to_string_pretty(&export).unwrap(), "json")
        }
        _ => {
            // Default to markdown
            let mut md = format!("# Highlights: {}\n\n", doc_title);
            let mut current_page = 0;

            for h in &highlights {
                if h.page_number != current_page {
                    md.push_str(&format!("\n## Page {}\n\n", h.page_number));
                    current_page = h.page_number;
                }

                if let Some(ref text) = h.text_content {
                    md.push_str(&format!("> \"{}\"\n", text));
                }
                md.push_str(&format!("- Color: {}\n", color_name(&h.color)));
                if let Some(ref note) = h.note {
                    md.push_str(&format!("- Note: {}\n", note));
                }
                md.push('\n');
            }
            (md, "md")
        }
    };

    let safe_title = doc_title.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let filename = format!("{}_highlights.{}", safe_title, ext);

    Ok(ExportResponse { content, filename })
}

// Helper functions

fn get_pool<'a>(db: &'a State<'a, DbInstances>) -> impl std::future::Future<Output = Result<Pool<Sqlite>, String>> + 'a {
    async move {
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
}

fn is_valid_hex_color(color: &str) -> bool {
    color.len() == 7
        && color.starts_with('#')
        && color[1..].chars().all(|c| c.is_ascii_hexdigit())
}

fn color_name(hex: &str) -> &str {
    match hex.to_uppercase().as_str() {
        "#FFEB3B" => "Yellow",
        "#4CAF50" => "Green",
        "#2196F3" => "Blue",
        "#F44336" => "Red",
        "#FF9800" => "Orange",
        "#9C27B0" => "Purple",
        _ => hex,
    }
}

// Row struct for sqlx
struct HighlightRow {
    id: String,
    document_id: String,
    page_number: i32,
    rects: String,
    color: String,
    text_content: Option<String>,
    note: Option<String>,
    created_at: String,
    updated_at: Option<String>,
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
    fn into_highlight(self) -> Result<Highlight, String> {
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
