//! Session Repository Port
//!
//! Defines the contract for reading session persistence operations.

use crate::domain::errors::RepositoryError;
use crate::domain::sessions::ReadingSession;
use async_trait::async_trait;
#[cfg(any(test, feature = "test-mocks"))]
use mockall::automock;
use serde::{Deserialize, Serialize};

/// Input for creating a new session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionInput {
    pub name: String,
    pub document_ids: Vec<String>,
}

/// Input for updating a session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionInput {
    pub name: Option<String>,
    pub document_ids: Option<Vec<String>>,
}

/// Input for updating a document within a session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionDocumentInput {
    pub current_page: Option<i32>,
    pub scroll_position: Option<f64>,
}

/// Summary of a session for list operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub name: String,
    pub document_count: i32,
    pub last_accessed_at: String,
    pub created_at: String,
}

/// Repository trait for reading session persistence
#[cfg_attr(any(test, feature = "test-mocks"), automock)]
#[async_trait]
pub trait SessionRepository: Send + Sync {
    /// Create a new reading session
    async fn create(&self, input: CreateSessionInput) -> Result<ReadingSession, RepositoryError>;

    /// Get a session by ID with all documents
    async fn get(&self, session_id: &str) -> Result<Option<ReadingSession>, RepositoryError>;

    /// List all sessions (summary only)
    async fn list(&self) -> Result<Vec<SessionSummary>, RepositoryError>;

    /// Update session metadata
    async fn update(
        &self,
        session_id: &str,
        input: UpdateSessionInput,
    ) -> Result<ReadingSession, RepositoryError>;

    /// Delete a session (cascade deletes session_documents)
    async fn delete(&self, session_id: &str) -> Result<(), RepositoryError>;

    /// Add a document to a session
    async fn add_document(
        &self,
        session_id: &str,
        document_id: &str,
        position: Option<i32>,
    ) -> Result<(), RepositoryError>;

    /// Remove a document from a session
    async fn remove_document(
        &self,
        session_id: &str,
        document_id: &str,
    ) -> Result<(), RepositoryError>;

    /// Update document state within session
    async fn update_document(
        &self,
        session_id: &str,
        document_id: &str,
        input: UpdateSessionDocumentInput,
    ) -> Result<(), RepositoryError>;

    /// Update last_accessed_at timestamp
    async fn touch(&self, session_id: &str) -> Result<(), RepositoryError>;
}

/// Response for session restore operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRestoreResponse {
    pub success: bool,
    pub session: ReadingSession,
    pub missing_documents: Vec<String>,
}
