//! Highlight Repository Port
//!
//! Manages highlight persistence operations.
//! Implemented by: SqliteHighlightRepo, MockHighlightRepo

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[cfg(any(test, feature = "test-mocks"))]
use mockall::automock;

use crate::domain::DomainError;

/// Represents a rectangle in page coordinate space.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Represents a text highlight annotation within a document.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Highlight {
    pub id: String,
    pub document_id: String,
    pub page_number: i32,
    pub rects: Vec<Rect>,
    pub color: String,
    pub text_content: Option<String>,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

/// Input for creating a new highlight.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightCreate {
    pub document_id: String,
    pub page_number: i32,
    pub rects: Vec<Rect>,
    pub color: String,
    pub text_content: Option<String>,
}

/// Input for updating a highlight.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightUpdate {
    pub color: Option<String>,
    pub note: Option<String>,
}

/// Response for batch create operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchCreateResponse {
    pub highlights: Vec<Highlight>,
    pub created: i32,
}

/// Response for delete operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub success: bool,
    pub deleted: Option<i32>,
}

/// Response for export operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResponse {
    pub content: String,
    pub filename: String,
}

/// Export format options.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Markdown,
    Json,
    Text,
}

/// HighlightRepository Port
///
/// Manages highlight persistence operations.
/// Implemented by: SqliteHighlightRepo, MockHighlightRepo
#[cfg_attr(any(test, feature = "test-mocks"), automock)]
#[async_trait]
pub trait HighlightRepository: Send + Sync {
    /// Create a new highlight
    async fn create(&self, input: HighlightCreate) -> Result<Highlight, DomainError>;

    /// Create multiple highlights in a batch
    async fn batch_create(
        &self,
        inputs: Vec<HighlightCreate>,
    ) -> Result<BatchCreateResponse, DomainError>;

    /// Get a highlight by ID
    async fn get_by_id(&self, id: String) -> Result<Option<Highlight>, DomainError>;

    /// List all highlights for a specific page
    async fn list_for_page(
        &self,
        document_id: String,
        page_number: i32,
    ) -> Result<Vec<Highlight>, DomainError>;

    /// List all highlights for a document
    async fn list_for_document(&self, document_id: String) -> Result<Vec<Highlight>, DomainError>;

    /// Update a highlight's color or note
    async fn update(&self, id: String, input: HighlightUpdate) -> Result<Highlight, DomainError>;

    /// Delete a highlight
    async fn delete(&self, id: String) -> Result<(), DomainError>;

    /// Delete all highlights for a document
    async fn delete_for_document(&self, document_id: String)
        -> Result<DeleteResponse, DomainError>;

    /// Export highlights in various formats
    async fn export(
        &self,
        document_id: String,
        format: ExportFormat,
    ) -> Result<ExportResponse, DomainError>;
}
