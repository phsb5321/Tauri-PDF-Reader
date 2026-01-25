//! Library Application Service
//!
//! Provides use cases for managing the document library.
//! Uses generic trait bounds to allow dependency injection of the repository.

use crate::domain::DomainError;
use crate::ports::{Document, DocumentRepository, FileExistsResponse, OrderBy};

/// Application service for managing the document library.
///
/// This service:
/// - Validates document operations
/// - Delegates persistence to the injected repository
/// - Orchestrates complex library operations
pub struct LibraryService<R: DocumentRepository> {
    repository: R,
}

impl<R: DocumentRepository> LibraryService<R> {
    /// Create a new LibraryService with the given repository.
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    /// Add a new document to the library.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if the file path is empty.
    /// Returns `DomainError::Storage` if the document cannot be saved.
    pub async fn add_document(
        &self,
        file_path: String,
        title: Option<String>,
        page_count: Option<i32>,
    ) -> Result<Document, DomainError> {
        // Validate file path
        if file_path.trim().is_empty() {
            return Err(DomainError::validation("File path required"));
        }

        // Validate page_count if provided
        if let Some(count) = page_count {
            if count < 1 {
                return Err(DomainError::validation("Page count must be positive"));
            }
        }

        self.repository.add(file_path, title, page_count).await
    }

    /// Get a document by its ID.
    pub async fn get_document(&self, id: String) -> Result<Option<Document>, DomainError> {
        self.repository.get_by_id(id).await
    }

    /// Get a document by its file path.
    pub async fn get_document_by_path(
        &self,
        file_path: String,
    ) -> Result<Option<Document>, DomainError> {
        self.repository.get_by_path(file_path).await
    }

    /// List all documents in the library.
    pub async fn list_documents(
        &self,
        order: OrderBy,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Result<Vec<Document>, DomainError> {
        // Validate pagination params
        if let Some(lim) = limit {
            if lim < 0 {
                return Err(DomainError::validation("Limit must be non-negative"));
            }
        }
        if let Some(off) = offset {
            if off < 0 {
                return Err(DomainError::validation("Offset must be non-negative"));
            }
        }

        self.repository.list(order, limit, offset).await
    }

    /// Update reading progress for a document.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if page is < 1 or scroll is not in [0, 1].
    pub async fn update_progress(
        &self,
        id: String,
        page: i32,
        scroll: Option<f64>,
        tts_chunk: Option<String>,
    ) -> Result<Document, DomainError> {
        // Validate page
        if page < 1 {
            return Err(DomainError::validation("Page must be positive"));
        }

        // Validate scroll
        if let Some(s) = scroll {
            if !(0.0..=1.0).contains(&s) {
                return Err(DomainError::validation("Scroll must be between 0 and 1"));
            }
        }

        self.repository
            .update_progress(id, page, scroll, tts_chunk)
            .await
    }

    /// Update document title.
    pub async fn update_title(&self, id: String, title: String) -> Result<Document, DomainError> {
        self.repository.update_title(id, title).await
    }

    /// Relocate a document to a new file path.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if the new path is empty.
    pub async fn relocate_document(
        &self,
        id: String,
        new_path: String,
    ) -> Result<Document, DomainError> {
        if new_path.trim().is_empty() {
            return Err(DomainError::validation("File path required"));
        }

        self.repository.relocate(id, new_path).await
    }

    /// Remove a document from the library.
    pub async fn remove_document(&self, id: String) -> Result<(), DomainError> {
        self.repository.remove(id).await
    }

    /// Check if a document's file exists.
    pub async fn check_file_exists(&self, path: String) -> Result<FileExistsResponse, DomainError> {
        self.repository.check_file_exists(path).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ports::MockDocumentRepository;
    use mockall::predicate::*;

    // ==========================================================================
    // Add Document Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_add_document_success() {
        let mut mock = MockDocumentRepository::new();
        mock.expect_add()
            .with(
                eq("/path/to/doc.pdf".to_string()),
                eq(Some("Test Doc".to_string())),
                eq(Some(100)),
            )
            .times(1)
            .returning(|path, title, count| {
                Ok(Document {
                    id: "doc-123".to_string(),
                    file_path: path,
                    title,
                    page_count: count,
                    current_page: 1,
                    scroll_position: 0.0,
                    last_tts_chunk_id: None,
                    last_opened_at: None,
                    file_hash: None,
                    created_at: "2026-01-13T00:00:00Z".to_string(),
                })
            });

        let service = LibraryService::new(mock);
        let result = service
            .add_document(
                "/path/to/doc.pdf".to_string(),
                Some("Test Doc".to_string()),
                Some(100),
            )
            .await;

        assert!(result.is_ok());
        let doc = result.unwrap();
        assert_eq!(doc.id, "doc-123");
        assert_eq!(doc.file_path, "/path/to/doc.pdf");
    }

    #[tokio::test]
    async fn test_add_document_empty_path_rejected() {
        let mock = MockDocumentRepository::new();
        // No expectations - should fail validation before calling repo

        let service = LibraryService::new(mock);
        let result = service.add_document("".to_string(), None, None).await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DomainError::Validation(_)));
    }

    #[tokio::test]
    async fn test_add_document_whitespace_path_rejected() {
        let mock = MockDocumentRepository::new();

        let service = LibraryService::new(mock);
        let result = service.add_document("   ".to_string(), None, None).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_add_document_zero_page_count_rejected() {
        let mock = MockDocumentRepository::new();

        let service = LibraryService::new(mock);
        let result = service
            .add_document("/path/to/doc.pdf".to_string(), None, Some(0))
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_add_document_negative_page_count_rejected() {
        let mock = MockDocumentRepository::new();

        let service = LibraryService::new(mock);
        let result = service
            .add_document("/path/to/doc.pdf".to_string(), None, Some(-1))
            .await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Get Document Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_get_document_found() {
        let mut mock = MockDocumentRepository::new();
        mock.expect_get_by_id()
            .with(eq("doc-123".to_string()))
            .times(1)
            .returning(|_| {
                Ok(Some(Document {
                    id: "doc-123".to_string(),
                    file_path: "/path/to/doc.pdf".to_string(),
                    title: Some("Test".to_string()),
                    page_count: Some(10),
                    current_page: 1,
                    scroll_position: 0.0,
                    last_tts_chunk_id: None,
                    last_opened_at: None,
                    file_hash: None,
                    created_at: "2026-01-13T00:00:00Z".to_string(),
                }))
            });

        let service = LibraryService::new(mock);
        let result = service.get_document("doc-123".to_string()).await;

        assert!(result.is_ok());
        assert!(result.unwrap().is_some());
    }

    #[tokio::test]
    async fn test_get_document_not_found() {
        let mut mock = MockDocumentRepository::new();
        mock.expect_get_by_id()
            .with(eq("nonexistent".to_string()))
            .times(1)
            .returning(|_| Ok(None));

        let service = LibraryService::new(mock);
        let result = service.get_document("nonexistent".to_string()).await;

        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    // ==========================================================================
    // List Documents Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_list_documents_success() {
        let mut mock = MockDocumentRepository::new();
        mock.expect_list()
            .with(eq(OrderBy::LastOpened), eq(Some(10)), eq(Some(0)))
            .times(1)
            .returning(|_, _, _| {
                Ok(vec![Document {
                    id: "doc-1".to_string(),
                    file_path: "/path/1.pdf".to_string(),
                    title: None,
                    page_count: None,
                    current_page: 1,
                    scroll_position: 0.0,
                    last_tts_chunk_id: None,
                    last_opened_at: None,
                    file_hash: None,
                    created_at: "2026-01-13T00:00:00Z".to_string(),
                }])
            });

        let service = LibraryService::new(mock);
        let result = service
            .list_documents(OrderBy::LastOpened, Some(10), Some(0))
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn test_list_documents_negative_limit_rejected() {
        let mock = MockDocumentRepository::new();

        let service = LibraryService::new(mock);
        let result = service
            .list_documents(OrderBy::LastOpened, Some(-1), None)
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_list_documents_negative_offset_rejected() {
        let mock = MockDocumentRepository::new();

        let service = LibraryService::new(mock);
        let result = service
            .list_documents(OrderBy::LastOpened, None, Some(-1))
            .await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Update Progress Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_update_progress_success() {
        let mut mock = MockDocumentRepository::new();
        mock.expect_update_progress()
            .with(
                eq("doc-123".to_string()),
                eq(5),
                eq(Some(0.5)),
                eq(Some("chunk-1".to_string())),
            )
            .times(1)
            .returning(|id, page, scroll, chunk| {
                Ok(Document {
                    id,
                    file_path: "/path.pdf".to_string(),
                    title: None,
                    page_count: Some(10),
                    current_page: page,
                    scroll_position: scroll.unwrap_or(0.0),
                    last_tts_chunk_id: chunk,
                    last_opened_at: None,
                    file_hash: None,
                    created_at: "2026-01-13T00:00:00Z".to_string(),
                })
            });

        let service = LibraryService::new(mock);
        let result = service
            .update_progress(
                "doc-123".to_string(),
                5,
                Some(0.5),
                Some("chunk-1".to_string()),
            )
            .await;

        assert!(result.is_ok());
        let doc = result.unwrap();
        assert_eq!(doc.current_page, 5);
        assert_eq!(doc.scroll_position, 0.5);
    }

    #[tokio::test]
    async fn test_update_progress_zero_page_rejected() {
        let mock = MockDocumentRepository::new();

        let service = LibraryService::new(mock);
        let result = service
            .update_progress("doc-123".to_string(), 0, None, None)
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_progress_negative_page_rejected() {
        let mock = MockDocumentRepository::new();

        let service = LibraryService::new(mock);
        let result = service
            .update_progress("doc-123".to_string(), -1, None, None)
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_progress_scroll_below_zero_rejected() {
        let mock = MockDocumentRepository::new();

        let service = LibraryService::new(mock);
        let result = service
            .update_progress("doc-123".to_string(), 1, Some(-0.1), None)
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_progress_scroll_above_one_rejected() {
        let mock = MockDocumentRepository::new();

        let service = LibraryService::new(mock);
        let result = service
            .update_progress("doc-123".to_string(), 1, Some(1.1), None)
            .await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Relocate Document Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_relocate_document_success() {
        let mut mock = MockDocumentRepository::new();
        mock.expect_relocate()
            .with(eq("doc-123".to_string()), eq("/new/path.pdf".to_string()))
            .times(1)
            .returning(|id, path| {
                Ok(Document {
                    id,
                    file_path: path,
                    title: None,
                    page_count: None,
                    current_page: 1,
                    scroll_position: 0.0,
                    last_tts_chunk_id: None,
                    last_opened_at: None,
                    file_hash: None,
                    created_at: "2026-01-13T00:00:00Z".to_string(),
                })
            });

        let service = LibraryService::new(mock);
        let result = service
            .relocate_document("doc-123".to_string(), "/new/path.pdf".to_string())
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().file_path, "/new/path.pdf");
    }

    #[tokio::test]
    async fn test_relocate_document_empty_path_rejected() {
        let mock = MockDocumentRepository::new();

        let service = LibraryService::new(mock);
        let result = service
            .relocate_document("doc-123".to_string(), "".to_string())
            .await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Remove Document Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_remove_document_success() {
        let mut mock = MockDocumentRepository::new();
        mock.expect_remove()
            .with(eq("doc-123".to_string()))
            .times(1)
            .returning(|_| Ok(()));

        let service = LibraryService::new(mock);
        let result = service.remove_document("doc-123".to_string()).await;

        assert!(result.is_ok());
    }

    // ==========================================================================
    // Check File Exists Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_check_file_exists() {
        let mut mock = MockDocumentRepository::new();
        mock.expect_check_file_exists()
            .with(eq("/path/to/doc.pdf".to_string()))
            .times(1)
            .returning(|path| {
                Ok(FileExistsResponse {
                    exists: true,
                    file_path: path,
                })
            });

        let service = LibraryService::new(mock);
        let result = service
            .check_file_exists("/path/to/doc.pdf".to_string())
            .await;

        assert!(result.is_ok());
        assert!(result.unwrap().exists);
    }
}
