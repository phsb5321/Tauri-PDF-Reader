//! Document Repository Port
//!
//! Manages document persistence operations.
//! Implemented by: SqliteDocumentRepo, MockDocumentRepo

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[cfg(any(test, feature = "test-mocks"))]
use mockall::automock;

use crate::domain::DomainError;

/// Represents a PDF document in the user's library.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub file_path: String,
    pub title: Option<String>,
    pub page_count: Option<i32>,
    pub current_page: i32,
    pub scroll_position: f64,
    pub last_tts_chunk_id: Option<String>,
    pub last_opened_at: Option<String>,
    pub file_hash: Option<String>,
    pub created_at: String,
}

/// Response for file existence check.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileExistsResponse {
    pub exists: bool,
    pub file_path: String,
}

/// Ordering options for document lists.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OrderBy {
    #[default]
    LastOpened,
    Created,
    Title,
}

/// DocumentRepository Port
///
/// Manages document persistence operations.
/// Implemented by: SqliteDocumentRepo, MockDocumentRepo
#[cfg_attr(any(test, feature = "test-mocks"), automock)]
#[async_trait]
pub trait DocumentRepository: Send + Sync {
    /// Add a new document to the library
    async fn add(
        &self,
        file_path: String,
        title: Option<String>,
        page_count: Option<i32>,
    ) -> Result<Document, DomainError>;

    /// Get a document by its content-hash ID
    async fn get_by_id(&self, id: String) -> Result<Option<Document>, DomainError>;

    /// Get a document by its file path
    async fn get_by_path(&self, path: String) -> Result<Option<Document>, DomainError>;

    /// List all documents with optional ordering and pagination
    async fn list(
        &self,
        order: OrderBy,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Result<Vec<Document>, DomainError>;

    /// Update reading progress for a document
    async fn update_progress(
        &self,
        id: String,
        page: i32,
        scroll: Option<f64>,
        tts_chunk: Option<String>,
    ) -> Result<Document, DomainError>;

    /// Update document title
    async fn update_title(&self, id: String, title: String) -> Result<Document, DomainError>;

    /// Relocate a document to a new file path
    async fn relocate(&self, id: String, new_path: String) -> Result<Document, DomainError>;

    /// Remove a document from the library
    async fn remove(&self, id: String) -> Result<(), DomainError>;

    /// Check if a file exists at the given path
    async fn check_file_exists(&self, path: String) -> Result<FileExistsResponse, DomainError>;
}
