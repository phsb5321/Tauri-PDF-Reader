//! Database helpers for shelf commands
//!
//! The Tauri commands in the parent module are thin wrappers that resolve the
//! pool and delegate here. Keeping the SQL in free functions over `&Pool` is
//! what makes it testable against an in-memory database.

use crate::db::models::{Collection, CollectionMembership};
use sqlx::{Pool, Row, Sqlite};

/// Longest shelf name the UI can display without truncation.
pub const COLLECTION_NAME_MAX_LENGTH: usize = 100;

/// Trim a shelf name and reject the ones that cannot address a shelf.
///
/// Whitespace-only names are rejected rather than silently accepted: a shelf
/// the reader cannot see or type is a shelf they cannot use again.
pub fn normalize_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("INVALID_NAME: Shelf name cannot be empty".to_string());
    }
    if trimmed.chars().count() > COLLECTION_NAME_MAX_LENGTH {
        return Err(format!(
            "INVALID_NAME: Shelf name must be {} characters or less",
            COLLECTION_NAME_MAX_LENGTH
        ));
    }
    Ok(trimmed.to_string())
}

/// Map a UNIQUE-index violation on `collections.name` to a message the UI can
/// show, and leave every other database failure alone.
fn map_write_error(error: sqlx::Error) -> String {
    let text = error.to_string();
    if text.contains("UNIQUE constraint failed") {
        "DUPLICATE_NAME: A shelf with that name already exists".to_string()
    } else {
        format!("DATABASE_ERROR: {}", text)
    }
}

const SELECT_COLLECTIONS: &str = "SELECT c.id, c.name, c.created_at, c.updated_at,
        (SELECT COUNT(*) FROM document_collections dc WHERE dc.collection_id = c.id) AS document_count
     FROM collections c
     ORDER BY c.name COLLATE NOCASE";

fn row_to_collection(row: &sqlx::sqlite::SqliteRow) -> Collection {
    Collection {
        id: row.get("id"),
        name: row.get("name"),
        document_count: row.get("document_count"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

/// Every shelf, by name, each with the number of documents filed under it.
pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<Collection>, String> {
    let rows = sqlx::query(SELECT_COLLECTIONS)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(rows.iter().map(row_to_collection).collect())
}

async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Collection, String> {
    let row = sqlx::query(
        "SELECT c.id, c.name, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM document_collections dc WHERE dc.collection_id = c.id) AS document_count
         FROM collections c WHERE c.id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?
    .ok_or_else(|| "NOT_FOUND: Shelf does not exist".to_string())?;

    Ok(row_to_collection(&row))
}

/// Create a shelf. Fails when the name is blank or already taken.
pub async fn create(pool: &Pool<Sqlite>, id: &str, name: &str) -> Result<Collection, String> {
    let name = normalize_name(name)?;
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query("INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .bind(id)
        .bind(&name)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await
        .map_err(map_write_error)?;

    get(pool, id).await
}

/// Rename a shelf. Fails when the shelf is gone or the new name is taken.
pub async fn rename(pool: &Pool<Sqlite>, id: &str, name: &str) -> Result<Collection, String> {
    let name = normalize_name(name)?;
    let now = chrono::Utc::now().to_rfc3339();

    let result = sqlx::query("UPDATE collections SET name = ?, updated_at = ? WHERE id = ?")
        .bind(&name)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(map_write_error)?;

    if result.rows_affected() == 0 {
        return Err("NOT_FOUND: Shelf does not exist".to_string());
    }

    get(pool, id).await
}

/// Delete a shelf. The documents on it are untouched — only the filing is
/// removed, by the `ON DELETE CASCADE` on `document_collections`.
pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<(), String> {
    // The cascade is declared on the table, but `PRAGMA foreign_keys` is per
    // connection and the pool hands out whichever one is free — clear the
    // memberships explicitly rather than depend on it being ON.
    sqlx::query("DELETE FROM document_collections WHERE collection_id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    sqlx::query("DELETE FROM collections WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}

/// File a document on a shelf. Filing it twice is not an error.
pub async fn add_document(
    pool: &Pool<Sqlite>,
    collection_id: &str,
    document_id: &str,
) -> Result<(), String> {
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM collections WHERE id = ?")
        .bind(collection_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    if exists.is_none() {
        return Err("NOT_FOUND: Shelf does not exist".to_string());
    }

    sqlx::query(
        "INSERT OR IGNORE INTO document_collections (document_id, collection_id, added_at)
         VALUES (?, ?, ?)",
    )
    .bind(document_id)
    .bind(collection_id)
    .bind(chrono::Utc::now().to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}

/// Take a document off a shelf. Removing what was never filed is not an error.
pub async fn remove_document(
    pool: &Pool<Sqlite>,
    collection_id: &str,
    document_id: &str,
) -> Result<(), String> {
    sqlx::query("DELETE FROM document_collections WHERE collection_id = ? AND document_id = ?")
        .bind(collection_id)
        .bind(document_id)
        .execute(pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(())
}

/// Every (document, shelf) pair. Small enough to load in one call, which is
/// what lets the shelf filter and the per-document picker run without further
/// round trips.
pub async fn list_memberships(pool: &Pool<Sqlite>) -> Result<Vec<CollectionMembership>, String> {
    let rows = sqlx::query("SELECT document_id, collection_id FROM document_collections")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {}", e))?;

    Ok(rows
        .iter()
        .map(|row| CollectionMembership {
            document_id: row.get("document_id"),
            collection_id: row.get("collection_id"),
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup() -> Pool<Sqlite> {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        for migration in crate::db::migrations::MIGRATIONS {
            sqlx::query(migration).execute(&pool).await.unwrap();
        }

        for i in 1..=3 {
            sqlx::query(
                "INSERT INTO documents (id, file_path, title, page_count, current_page, created_at)
                 VALUES (?, ?, ?, 10, 1, datetime('now'))",
            )
            .bind(format!("doc-{}", i))
            .bind(format!("/test/doc{}.pdf", i))
            .bind(format!("Test Doc {}", i))
            .execute(&pool)
            .await
            .unwrap();
        }

        pool
    }

    #[test]
    fn normalize_trims_surrounding_whitespace() {
        assert_eq!(normalize_name("  Philosophy  ").unwrap(), "Philosophy");
    }

    #[test]
    fn normalize_rejects_blank_names() {
        assert!(normalize_name("").is_err());
        assert!(normalize_name("   ").is_err());
    }

    #[test]
    fn normalize_measures_length_in_characters_not_bytes() {
        // 100 accented characters is 200 bytes; a byte-length check would
        // reject a name the UI can display fine.
        let accented = "é".repeat(COLLECTION_NAME_MAX_LENGTH);
        assert!(normalize_name(&accented).is_ok());
        assert!(normalize_name(&"a".repeat(COLLECTION_NAME_MAX_LENGTH + 1)).is_err());
    }

    #[tokio::test]
    async fn create_stores_the_trimmed_name() {
        let pool = setup().await;
        let shelf = create(&pool, "c1", "  Philosophy ").await.unwrap();

        assert_eq!(shelf.name, "Philosophy");
        assert_eq!(shelf.document_count, 0);
    }

    #[tokio::test]
    async fn create_rejects_a_name_already_taken_ignoring_case() {
        let pool = setup().await;
        create(&pool, "c1", "Philosophy").await.unwrap();

        let clash = create(&pool, "c2", "philosophy").await;

        assert!(
            clash
                .as_ref()
                .is_err_and(|e| e.starts_with("DUPLICATE_NAME")),
            "expected DUPLICATE_NAME, got {clash:?}"
        );
    }

    #[tokio::test]
    async fn list_orders_by_name_and_counts_documents() {
        let pool = setup().await;
        create(&pool, "c1", "Zettel").await.unwrap();
        create(&pool, "c2", "Anthropology").await.unwrap();
        add_document(&pool, "c1", "doc-1").await.unwrap();
        add_document(&pool, "c1", "doc-2").await.unwrap();

        let shelves = list(&pool).await.unwrap();

        assert_eq!(
            shelves.iter().map(|c| c.name.as_str()).collect::<Vec<_>>(),
            vec!["Anthropology", "Zettel"]
        );
        assert_eq!(shelves[0].document_count, 0);
        assert_eq!(shelves[1].document_count, 2);
    }

    #[tokio::test]
    async fn filing_the_same_document_twice_is_idempotent() {
        let pool = setup().await;
        create(&pool, "c1", "Philosophy").await.unwrap();

        add_document(&pool, "c1", "doc-1").await.unwrap();
        add_document(&pool, "c1", "doc-1").await.unwrap();

        assert_eq!(list_memberships(&pool).await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn a_document_can_sit_on_several_shelves() {
        let pool = setup().await;
        create(&pool, "c1", "Philosophy").await.unwrap();
        create(&pool, "c2", "Reread").await.unwrap();

        add_document(&pool, "c1", "doc-1").await.unwrap();
        add_document(&pool, "c2", "doc-1").await.unwrap();

        let memberships = list_memberships(&pool).await.unwrap();
        assert_eq!(memberships.len(), 2);
        assert!(memberships.iter().all(|m| m.document_id == "doc-1"));
    }

    #[tokio::test]
    async fn filing_onto_a_missing_shelf_fails() {
        let pool = setup().await;

        let result = add_document(&pool, "nope", "doc-1").await;

        assert!(
            result.as_ref().is_err_and(|e| e.starts_with("NOT_FOUND")),
            "expected NOT_FOUND, got {result:?}"
        );
    }

    #[tokio::test]
    async fn removing_a_document_that_was_never_filed_is_not_an_error() {
        let pool = setup().await;
        create(&pool, "c1", "Philosophy").await.unwrap();

        assert!(remove_document(&pool, "c1", "doc-1").await.is_ok());
    }

    #[tokio::test]
    async fn rename_rejects_a_name_already_taken() {
        let pool = setup().await;
        create(&pool, "c1", "Philosophy").await.unwrap();
        create(&pool, "c2", "Reread").await.unwrap();

        let clash = rename(&pool, "c2", "Philosophy").await;

        assert!(
            clash
                .as_ref()
                .is_err_and(|e| e.starts_with("DUPLICATE_NAME")),
            "expected DUPLICATE_NAME, got {clash:?}"
        );
    }

    #[tokio::test]
    async fn rename_reports_a_missing_shelf() {
        let pool = setup().await;

        let result = rename(&pool, "nope", "Philosophy").await;

        assert!(
            result.as_ref().is_err_and(|e| e.starts_with("NOT_FOUND")),
            "expected NOT_FOUND, got {result:?}"
        );
    }

    #[tokio::test]
    async fn deleting_a_shelf_unfiles_its_documents_and_keeps_them() {
        let pool = setup().await;
        create(&pool, "c1", "Philosophy").await.unwrap();
        add_document(&pool, "c1", "doc-1").await.unwrap();

        delete(&pool, "c1").await.unwrap();

        assert!(list(&pool).await.unwrap().is_empty());
        assert!(list_memberships(&pool).await.unwrap().is_empty());

        let surviving: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM documents WHERE id = 'doc-1'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(surviving.0, 1, "deleting a shelf must not delete books");
    }
}
