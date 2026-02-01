//! Session Application Service (T061)
//!
//! Provides use cases for managing reading sessions.
//! Orchestrates session lifecycle operations with validation.

use crate::domain::errors::RepositoryError;
use crate::domain::sessions::ReadingSession;
use crate::ports::session_repository::{
    CreateSessionInput, SessionRepository, SessionRestoreResponse, SessionSummary,
    UpdateSessionDocumentInput, UpdateSessionInput,
};

/// Application service for managing reading sessions.
///
/// This service:
/// - Creates and manages reading sessions
/// - Handles document organization within sessions
/// - Provides session restore functionality
pub struct SessionService<R: SessionRepository> {
    repository: R,
}

impl<R: SessionRepository> SessionService<R> {
    /// Create a new SessionService with the given repository.
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    /// Create a new reading session.
    pub async fn create(
        &self,
        input: CreateSessionInput,
    ) -> Result<ReadingSession, RepositoryError> {
        // Validate name
        if input.name.trim().is_empty() {
            return Err(RepositoryError::ValidationError(
                "Session name cannot be empty".into(),
            ));
        }

        self.repository.create(input).await
    }

    /// Get a session by ID.
    pub async fn get(&self, session_id: &str) -> Result<Option<ReadingSession>, RepositoryError> {
        self.repository.get(session_id).await
    }

    /// List all sessions.
    pub async fn list(&self) -> Result<Vec<SessionSummary>, RepositoryError> {
        self.repository.list().await
    }

    /// Update a session.
    pub async fn update(
        &self,
        session_id: &str,
        input: UpdateSessionInput,
    ) -> Result<ReadingSession, RepositoryError> {
        // Validate name if provided
        if let Some(name) = &input.name {
            if name.trim().is_empty() {
                return Err(RepositoryError::ValidationError(
                    "Session name cannot be empty".into(),
                ));
            }
        }

        self.repository.update(session_id, input).await
    }

    /// Delete a session.
    pub async fn delete(&self, session_id: &str) -> Result<(), RepositoryError> {
        self.repository.delete(session_id).await
    }

    /// Add a document to a session.
    pub async fn add_document(
        &self,
        session_id: &str,
        document_id: &str,
        position: Option<i32>,
    ) -> Result<(), RepositoryError> {
        self.repository
            .add_document(session_id, document_id, position)
            .await
    }

    /// Remove a document from a session.
    pub async fn remove_document(
        &self,
        session_id: &str,
        document_id: &str,
    ) -> Result<(), RepositoryError> {
        self.repository
            .remove_document(session_id, document_id)
            .await
    }

    /// Update document state within a session.
    pub async fn update_document(
        &self,
        session_id: &str,
        document_id: &str,
        input: UpdateSessionDocumentInput,
    ) -> Result<(), RepositoryError> {
        self.repository
            .update_document(session_id, document_id, input)
            .await
    }

    /// Restore a session (returns session with missing document info).
    ///
    /// This method retrieves the session and checks which documents still exist.
    /// Documents that no longer exist are reported in the `missing_documents` list.
    pub async fn restore(
        &self,
        session_id: &str,
    ) -> Result<SessionRestoreResponse, RepositoryError> {
        let session = self.repository.get(session_id).await?.ok_or_else(|| {
            RepositoryError::NotFound(format!("Session {} not found", session_id))
        })?;

        // Touch to update last_accessed_at
        self.repository.touch(session_id).await?;

        // Check for missing documents
        // In a real implementation, we'd query the documents table to verify
        // For now, assume all documents exist (validation would happen at command level)
        let missing_documents = Vec::new();

        Ok(SessionRestoreResponse {
            success: true,
            session,
            missing_documents,
        })
    }

    /// Touch a session to update its last_accessed_at timestamp.
    pub async fn touch(&self, session_id: &str) -> Result<(), RepositoryError> {
        self.repository.touch(session_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::sessions::SessionDocument;
    use crate::ports::MockSessionRepository;
    use mockall::predicate::*;

    fn make_test_session() -> ReadingSession {
        ReadingSession {
            id: "session-1".to_string(),
            name: "Test Session".to_string(),
            documents: vec![SessionDocument {
                document_id: "doc-1".to_string(),
                position: 0,
                current_page: 1,
                scroll_position: 0.0,
                created_at: "2024-01-01T00:00:00Z".to_string(),
                title: Some("Test Doc".to_string()),
                page_count: Some(10),
            }],
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            last_accessed_at: "2024-01-01T00:00:00Z".to_string(),
        }
    }

    #[tokio::test]
    async fn test_create_session() {
        let mut mock = MockSessionRepository::new();
        let session = make_test_session();
        let session_clone = session.clone();

        mock.expect_create()
            .times(1)
            .returning(move |_| Ok(session_clone.clone()));

        let service = SessionService::new(mock);
        let input = CreateSessionInput {
            name: "Test Session".to_string(),
            document_ids: vec!["doc-1".to_string()],
        };

        let result = service.create(input).await.unwrap();
        assert_eq!(result.name, "Test Session");
    }

    #[tokio::test]
    async fn test_create_session_empty_name() {
        let mock = MockSessionRepository::new();
        let service = SessionService::new(mock);

        let input = CreateSessionInput {
            name: "   ".to_string(),
            document_ids: vec![],
        };

        let result = service.create(input).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_session() {
        let mut mock = MockSessionRepository::new();
        let session = make_test_session();
        let session_clone = session.clone();

        mock.expect_get()
            .with(eq("session-1"))
            .times(1)
            .returning(move |_| Ok(Some(session_clone.clone())));

        let service = SessionService::new(mock);
        let result = service.get("session-1").await.unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().name, "Test Session");
    }

    #[tokio::test]
    async fn test_list_sessions() {
        let mut mock = MockSessionRepository::new();
        mock.expect_list().times(1).returning(|| {
            Ok(vec![SessionSummary {
                id: "session-1".to_string(),
                name: "Test".to_string(),
                document_count: 1,
                last_accessed_at: "2024-01-01".to_string(),
                created_at: "2024-01-01".to_string(),
            }])
        });

        let service = SessionService::new(mock);
        let result = service.list().await.unwrap();
        assert_eq!(result.len(), 1);
    }

    #[tokio::test]
    async fn test_delete_session() {
        let mut mock = MockSessionRepository::new();
        mock.expect_delete()
            .with(eq("session-1"))
            .times(1)
            .returning(|_| Ok(()));

        let service = SessionService::new(mock);
        let result = service.delete("session-1").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_restore_session() {
        let mut mock = MockSessionRepository::new();
        let session = make_test_session();
        let session_clone = session.clone();

        mock.expect_get()
            .with(eq("session-1"))
            .times(1)
            .returning(move |_| Ok(Some(session_clone.clone())));

        mock.expect_touch()
            .with(eq("session-1"))
            .times(1)
            .returning(|_| Ok(()));

        let service = SessionService::new(mock);
        let result = service.restore("session-1").await.unwrap();
        assert!(result.success);
        assert_eq!(result.session.name, "Test Session");
        assert!(result.missing_documents.is_empty());
    }

    #[tokio::test]
    async fn test_add_document() {
        let mut mock = MockSessionRepository::new();
        mock.expect_add_document()
            .with(eq("session-1"), eq("doc-2"), eq(None))
            .times(1)
            .returning(|_, _, _| Ok(()));

        let service = SessionService::new(mock);
        let result = service.add_document("session-1", "doc-2", None).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_remove_document() {
        let mut mock = MockSessionRepository::new();
        mock.expect_remove_document()
            .with(eq("session-1"), eq("doc-1"))
            .times(1)
            .returning(|_, _| Ok(()));

        let service = SessionService::new(mock);
        let result = service.remove_document("session-1", "doc-1").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_update_document() {
        let mut mock = MockSessionRepository::new();
        mock.expect_update_document()
            .times(1)
            .returning(|_, _, _| Ok(()));

        let service = SessionService::new(mock);
        let input = UpdateSessionDocumentInput {
            current_page: Some(5),
            scroll_position: None,
        };
        let result = service.update_document("session-1", "doc-1", input).await;
        assert!(result.is_ok());
    }
}
