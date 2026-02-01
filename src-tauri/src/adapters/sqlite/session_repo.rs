//! SQLite Session Repository Adapter (T059-T060)
//!
//! Implements the SessionRepository port using SQLite for persistence.

use async_trait::async_trait;
use sqlx::{Pool, Sqlite};

use crate::domain::errors::RepositoryError;
use crate::domain::sessions::{ReadingSession, SessionDocument};
use crate::ports::session_repository::{
    CreateSessionInput, SessionRepository, SessionSummary, UpdateSessionDocumentInput,
    UpdateSessionInput,
};

/// SQLite implementation of SessionRepository.
pub struct SqliteSessionRepo {
    pool: Pool<Sqlite>,
}

impl SqliteSessionRepo {
    /// Create a new SqliteSessionRepo with the given database pool.
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    /// Load documents for a session from the junction table
    async fn load_documents(
        &self,
        session_id: &str,
    ) -> Result<Vec<SessionDocument>, RepositoryError> {
        let rows: Vec<(String, i32, i32, f64, String, Option<String>, Option<i32>)> =
            sqlx::query_as(
                r#"
            SELECT
                sd.document_id,
                sd.position,
                sd.current_page,
                sd.scroll_position,
                sd.created_at,
                d.title,
                d.page_count
            FROM session_documents sd
            LEFT JOIN documents d ON sd.document_id = d.id
            WHERE sd.session_id = ?
            ORDER BY sd.position ASC
            "#,
            )
            .bind(session_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to load session documents: {}", e))
            })?;

        let documents = rows
            .into_iter()
            .map(
                |(
                    document_id,
                    position,
                    current_page,
                    scroll_position,
                    created_at,
                    title,
                    page_count,
                )| {
                    SessionDocument {
                        document_id,
                        position,
                        current_page,
                        scroll_position,
                        created_at,
                        title,
                        page_count,
                    }
                },
            )
            .collect();

        Ok(documents)
    }
}

#[async_trait]
impl SessionRepository for SqliteSessionRepo {
    /// Create a new reading session
    async fn create(&self, input: CreateSessionInput) -> Result<ReadingSession, RepositoryError> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        // Validate name
        if input.name.trim().is_empty() {
            return Err(RepositoryError::ValidationError(
                "Session name cannot be empty".into(),
            ));
        }

        // Insert session
        sqlx::query(
            r#"
            INSERT INTO reading_sessions (id, name, created_at, updated_at, last_accessed_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&input.name)
        .bind(&now)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(format!("Failed to create session: {}", e)))?;

        // Add documents in order
        for (position, document_id) in input.document_ids.iter().enumerate() {
            let doc_now = chrono::Utc::now().to_rfc3339();
            sqlx::query(
                r#"
                INSERT INTO session_documents (session_id, document_id, position, current_page, scroll_position, created_at)
                VALUES (?, ?, ?, 1, 0.0, ?)
                "#,
            )
            .bind(&id)
            .bind(document_id)
            .bind(position as i32)
            .bind(&doc_now)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to add document to session: {}", e))
            })?;
        }

        // Load and return the created session
        self.get(&id)
            .await?
            .ok_or_else(|| RepositoryError::NotFound("Session not found after creation".into()))
    }

    /// Get a session by ID with all documents
    async fn get(&self, session_id: &str) -> Result<Option<ReadingSession>, RepositoryError> {
        let row: Option<(String, String, String, String, String)> = sqlx::query_as(
            r#"
            SELECT id, name, created_at, updated_at, last_accessed_at
            FROM reading_sessions
            WHERE id = ?
            "#,
        )
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(format!("Failed to get session: {}", e)))?;

        let row = match row {
            Some(r) => r,
            None => return Ok(None),
        };

        let documents = self.load_documents(session_id).await?;

        Ok(Some(ReadingSession {
            id: row.0,
            name: row.1,
            documents,
            created_at: row.2,
            updated_at: row.3,
            last_accessed_at: row.4,
        }))
    }

    /// List all sessions (summary only)
    async fn list(&self) -> Result<Vec<SessionSummary>, RepositoryError> {
        let rows: Vec<(String, String, i64, String, String)> = sqlx::query_as(
            r#"
            SELECT
                rs.id,
                rs.name,
                (SELECT COUNT(*) FROM session_documents sd WHERE sd.session_id = rs.id) as document_count,
                rs.last_accessed_at,
                rs.created_at
            FROM reading_sessions rs
            ORDER BY rs.last_accessed_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(format!("Failed to list sessions: {}", e)))?;

        let summaries = rows
            .into_iter()
            .map(
                |(id, name, document_count, last_accessed_at, created_at)| SessionSummary {
                    id,
                    name,
                    document_count: document_count as i32,
                    last_accessed_at,
                    created_at,
                },
            )
            .collect();

        Ok(summaries)
    }

    /// Update session metadata
    async fn update(
        &self,
        session_id: &str,
        input: UpdateSessionInput,
    ) -> Result<ReadingSession, RepositoryError> {
        // First check session exists
        let exists = self.get(session_id).await?.is_some();
        if !exists {
            return Err(RepositoryError::NotFound(format!(
                "Session {} not found",
                session_id
            )));
        }

        let now = chrono::Utc::now().to_rfc3339();

        // Update name if provided
        if let Some(name) = &input.name {
            if name.trim().is_empty() {
                return Err(RepositoryError::ValidationError(
                    "Session name cannot be empty".into(),
                ));
            }
            sqlx::query(
                r#"
                UPDATE reading_sessions SET name = ?, updated_at = ? WHERE id = ?
                "#,
            )
            .bind(name)
            .bind(&now)
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to update session name: {}", e))
            })?;
        }

        // Update documents if provided (replace all)
        if let Some(document_ids) = &input.document_ids {
            // Delete existing documents
            sqlx::query("DELETE FROM session_documents WHERE session_id = ?")
                .bind(session_id)
                .execute(&self.pool)
                .await
                .map_err(|e| {
                    RepositoryError::DatabaseError(format!(
                        "Failed to clear session documents: {}",
                        e
                    ))
                })?;

            // Add new documents in order
            for (position, document_id) in document_ids.iter().enumerate() {
                let doc_now = chrono::Utc::now().to_rfc3339();
                sqlx::query(
                    r#"
                    INSERT INTO session_documents (session_id, document_id, position, current_page, scroll_position, created_at)
                    VALUES (?, ?, ?, 1, 0.0, ?)
                    "#,
                )
                .bind(session_id)
                .bind(document_id)
                .bind(position as i32)
                .bind(&doc_now)
                .execute(&self.pool)
                .await
                .map_err(|e| {
                    RepositoryError::DatabaseError(format!("Failed to add document to session: {}", e))
                })?;
            }

            // Update timestamp
            sqlx::query("UPDATE reading_sessions SET updated_at = ? WHERE id = ?")
                .bind(&now)
                .bind(session_id)
                .execute(&self.pool)
                .await
                .map_err(|e| {
                    RepositoryError::DatabaseError(format!(
                        "Failed to update session timestamp: {}",
                        e
                    ))
                })?;
        }

        self.get(session_id)
            .await?
            .ok_or_else(|| RepositoryError::NotFound("Session not found after update".into()))
    }

    /// Delete a session (cascade deletes session_documents)
    async fn delete(&self, session_id: &str) -> Result<(), RepositoryError> {
        let result = sqlx::query("DELETE FROM reading_sessions WHERE id = ?")
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to delete session: {}", e))
            })?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!(
                "Session {} not found",
                session_id
            )));
        }

        tracing::info!("Deleted session: {}", session_id);
        Ok(())
    }

    /// Add a document to a session
    async fn add_document(
        &self,
        session_id: &str,
        document_id: &str,
        position: Option<i32>,
    ) -> Result<(), RepositoryError> {
        // Get current max position
        let max_pos: (Option<i32>,) =
            sqlx::query_as("SELECT MAX(position) FROM session_documents WHERE session_id = ?")
                .bind(session_id)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| {
                    RepositoryError::DatabaseError(format!("Failed to get max position: {}", e))
                })?;

        let next_pos = max_pos.0.unwrap_or(-1) + 1;
        let insert_pos = position.unwrap_or(next_pos);
        let now = chrono::Utc::now().to_rfc3339();

        // If inserting at a specific position, shift existing documents
        if insert_pos < next_pos {
            sqlx::query(
                "UPDATE session_documents SET position = position + 1 WHERE session_id = ? AND position >= ?",
            )
            .bind(session_id)
            .bind(insert_pos)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to shift document positions: {}", e))
            })?;
        }

        // Insert the document
        sqlx::query(
            r#"
            INSERT INTO session_documents (session_id, document_id, position, current_page, scroll_position, created_at)
            VALUES (?, ?, ?, 1, 0.0, ?)
            ON CONFLICT(session_id, document_id) DO UPDATE SET position = excluded.position
            "#,
        )
        .bind(session_id)
        .bind(document_id)
        .bind(insert_pos)
        .bind(&now)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(format!("Failed to add document: {}", e)))?;

        // Update session timestamp
        sqlx::query("UPDATE reading_sessions SET updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to update session: {}", e))
            })?;

        Ok(())
    }

    /// Remove a document from a session
    async fn remove_document(
        &self,
        session_id: &str,
        document_id: &str,
    ) -> Result<(), RepositoryError> {
        // Get the position of the document being removed
        let pos: Option<(i32,)> = sqlx::query_as(
            "SELECT position FROM session_documents WHERE session_id = ? AND document_id = ?",
        )
        .bind(session_id)
        .bind(document_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            RepositoryError::DatabaseError(format!("Failed to get document position: {}", e))
        })?;

        let pos = match pos {
            Some((p,)) => p,
            None => return Ok(()), // Document not in session, nothing to do
        };

        // Delete the document
        sqlx::query("DELETE FROM session_documents WHERE session_id = ? AND document_id = ?")
            .bind(session_id)
            .bind(document_id)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to remove document: {}", e))
            })?;

        // Shift remaining documents down
        sqlx::query(
            "UPDATE session_documents SET position = position - 1 WHERE session_id = ? AND position > ?",
        )
        .bind(session_id)
        .bind(pos)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            RepositoryError::DatabaseError(format!("Failed to shift document positions: {}", e))
        })?;

        // Update session timestamp
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("UPDATE reading_sessions SET updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to update session: {}", e))
            })?;

        Ok(())
    }

    /// Update document state within session
    async fn update_document(
        &self,
        session_id: &str,
        document_id: &str,
        input: UpdateSessionDocumentInput,
    ) -> Result<(), RepositoryError> {
        if input.current_page.is_none() && input.scroll_position.is_none() {
            return Ok(()); // Nothing to update
        }

        let mut updates = Vec::new();
        let mut params: Vec<Box<dyn std::any::Any + Send + Sync>> = Vec::new();

        if let Some(page) = input.current_page {
            updates.push("current_page = ?");
            params.push(Box::new(page));
        }
        if let Some(scroll) = input.scroll_position {
            updates.push("scroll_position = ?");
            params.push(Box::new(scroll));
        }

        let sql = format!(
            "UPDATE session_documents SET {} WHERE session_id = ? AND document_id = ?",
            updates.join(", ")
        );

        // Build the query dynamically
        let mut query = sqlx::query(&sql);
        for (i, _) in params.iter().enumerate() {
            if i == 0 && input.current_page.is_some() {
                query = query.bind(input.current_page.unwrap());
            } else if input.scroll_position.is_some() {
                query = query.bind(input.scroll_position.unwrap());
            }
        }
        query = query.bind(session_id).bind(document_id);

        query.execute(&self.pool).await.map_err(|e| {
            RepositoryError::DatabaseError(format!("Failed to update document: {}", e))
        })?;

        Ok(())
    }

    /// Update last_accessed_at timestamp
    async fn touch(&self, session_id: &str) -> Result<(), RepositoryError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("UPDATE reading_sessions SET last_accessed_at = ? WHERE id = ?")
            .bind(&now)
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to touch session: {}", e))
            })?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> Pool<Sqlite> {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        // Run migrations
        sqlx::query(crate::db::migrations::MIGRATIONS[0])
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(crate::db::migrations::MIGRATIONS[1])
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(crate::db::migrations::MIGRATIONS[2])
            .execute(&pool)
            .await
            .unwrap();

        // Insert test documents to satisfy foreign key constraints
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

    #[tokio::test]
    async fn test_create_session() {
        let pool = setup_test_db().await;
        let repo = SqliteSessionRepo::new(pool);

        let input = CreateSessionInput {
            name: "My Session".to_string(),
            document_ids: vec!["doc-1".to_string(), "doc-2".to_string()],
        };

        let session = repo.create(input).await.unwrap();
        assert_eq!(session.name, "My Session");
        assert_eq!(session.documents.len(), 2);
        assert_eq!(session.documents[0].document_id, "doc-1");
        assert_eq!(session.documents[0].position, 0);
        assert_eq!(session.documents[1].document_id, "doc-2");
        assert_eq!(session.documents[1].position, 1);
    }

    #[tokio::test]
    async fn test_create_session_empty_name() {
        let pool = setup_test_db().await;
        let repo = SqliteSessionRepo::new(pool);

        let input = CreateSessionInput {
            name: "   ".to_string(),
            document_ids: vec![],
        };

        let result = repo.create(input).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_session() {
        let pool = setup_test_db().await;
        let repo = SqliteSessionRepo::new(pool);

        let input = CreateSessionInput {
            name: "Test".to_string(),
            document_ids: vec!["doc-1".to_string()],
        };
        let created = repo.create(input).await.unwrap();

        let retrieved = repo.get(&created.id).await.unwrap();
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.name, "Test");
        assert_eq!(retrieved.documents.len(), 1);
    }

    #[tokio::test]
    async fn test_get_nonexistent_session() {
        let pool = setup_test_db().await;
        let repo = SqliteSessionRepo::new(pool);

        let result = repo.get("nonexistent").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_list_sessions() {
        let pool = setup_test_db().await;
        let repo = SqliteSessionRepo::new(pool);

        // Create multiple sessions
        for i in 1..=3 {
            let input = CreateSessionInput {
                name: format!("Session {}", i),
                document_ids: vec![format!("doc-{}", i)],
            };
            repo.create(input).await.unwrap();
        }

        let summaries = repo.list().await.unwrap();
        assert_eq!(summaries.len(), 3);
    }

    #[tokio::test]
    async fn test_update_session_name() {
        let pool = setup_test_db().await;
        let repo = SqliteSessionRepo::new(pool);

        let input = CreateSessionInput {
            name: "Original".to_string(),
            document_ids: vec![],
        };
        let created = repo.create(input).await.unwrap();

        let update = UpdateSessionInput {
            name: Some("Updated".to_string()),
            document_ids: None,
        };
        let updated = repo.update(&created.id, update).await.unwrap();
        assert_eq!(updated.name, "Updated");
    }

    #[tokio::test]
    async fn test_delete_session() {
        let pool = setup_test_db().await;
        let repo = SqliteSessionRepo::new(pool);

        let input = CreateSessionInput {
            name: "To Delete".to_string(),
            document_ids: vec!["doc-1".to_string()],
        };
        let created = repo.create(input).await.unwrap();

        repo.delete(&created.id).await.unwrap();

        let result = repo.get(&created.id).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_add_document() {
        let pool = setup_test_db().await;
        let repo = SqliteSessionRepo::new(pool);

        let input = CreateSessionInput {
            name: "Test".to_string(),
            document_ids: vec!["doc-1".to_string()],
        };
        let created = repo.create(input).await.unwrap();

        repo.add_document(&created.id, "doc-2", None).await.unwrap();

        let session = repo.get(&created.id).await.unwrap().unwrap();
        assert_eq!(session.documents.len(), 2);
        assert_eq!(session.documents[1].document_id, "doc-2");
    }

    #[tokio::test]
    async fn test_remove_document() {
        let pool = setup_test_db().await;
        let repo = SqliteSessionRepo::new(pool);

        let input = CreateSessionInput {
            name: "Test".to_string(),
            document_ids: vec![
                "doc-1".to_string(),
                "doc-2".to_string(),
                "doc-3".to_string(),
            ],
        };
        let created = repo.create(input).await.unwrap();

        repo.remove_document(&created.id, "doc-2").await.unwrap();

        let session = repo.get(&created.id).await.unwrap().unwrap();
        assert_eq!(session.documents.len(), 2);
        assert_eq!(session.documents[0].document_id, "doc-1");
        assert_eq!(session.documents[0].position, 0);
        assert_eq!(session.documents[1].document_id, "doc-3");
        assert_eq!(session.documents[1].position, 1);
    }

    #[tokio::test]
    async fn test_update_document() {
        let pool = setup_test_db().await;
        let repo = SqliteSessionRepo::new(pool);

        let input = CreateSessionInput {
            name: "Test".to_string(),
            document_ids: vec!["doc-1".to_string()],
        };
        let created = repo.create(input).await.unwrap();

        repo.update_document(
            &created.id,
            "doc-1",
            UpdateSessionDocumentInput {
                current_page: Some(5),
                scroll_position: Some(0.5),
            },
        )
        .await
        .unwrap();

        let session = repo.get(&created.id).await.unwrap().unwrap();
        assert_eq!(session.documents[0].current_page, 5);
        assert!((session.documents[0].scroll_position - 0.5).abs() < 0.001);
    }
}
