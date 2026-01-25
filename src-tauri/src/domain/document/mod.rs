//! Document Domain Module
//!
//! Contains the Document domain entity and validation logic.
//! This module defines:
//! - Document entity with invariants
//! - Validation rules for document fields
//! - Builder pattern for document creation

use crate::domain::DomainError;

/// Document entity representing a PDF in the user's library.
///
/// Invariants:
/// - `file_path` must be non-empty
/// - `current_page` must be >= 1
/// - `scroll_position` must be in [0.0, 1.0]
/// - `current_page` must be <= `page_count` when both are set
#[derive(Debug, Clone, PartialEq)]
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

impl Document {
    /// Create a new Document with validation.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if any invariant is violated.
    pub fn new(
        id: String,
        file_path: String,
        title: Option<String>,
        page_count: Option<i32>,
        current_page: i32,
        scroll_position: f64,
        last_tts_chunk_id: Option<String>,
        last_opened_at: Option<String>,
        file_hash: Option<String>,
        created_at: String,
    ) -> Result<Self, DomainError> {
        // Validate file_path is non-empty
        if file_path.trim().is_empty() {
            return Err(DomainError::validation("File path required"));
        }

        // Validate current_page >= 1
        if current_page < 1 {
            return Err(DomainError::validation("Page must be positive"));
        }

        // Validate scroll_position in [0, 1]
        if !(0.0..=1.0).contains(&scroll_position) {
            return Err(DomainError::validation("Scroll must be 0-1"));
        }

        // Validate current_page <= page_count when page_count is set
        if let Some(count) = page_count {
            if count < 1 {
                return Err(DomainError::validation("Page count must be positive"));
            }
            if current_page > count {
                return Err(DomainError::validation(format!(
                    "Current page {} exceeds page count {}",
                    current_page, count
                )));
            }
        }

        Ok(Self {
            id,
            file_path,
            title,
            page_count,
            current_page,
            scroll_position,
            last_tts_chunk_id,
            last_opened_at,
            file_hash,
            created_at,
        })
    }

    /// Update reading progress.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if the new values violate invariants.
    pub fn update_progress(
        &mut self,
        page: i32,
        scroll: Option<f64>,
        tts_chunk: Option<String>,
    ) -> Result<(), DomainError> {
        if page < 1 {
            return Err(DomainError::validation("Page must be positive"));
        }

        if let Some(count) = self.page_count {
            if page > count {
                return Err(DomainError::validation(format!(
                    "Page {} exceeds page count {}",
                    page, count
                )));
            }
        }

        if let Some(s) = scroll {
            if !(0.0..=1.0).contains(&s) {
                return Err(DomainError::validation("Scroll must be 0-1"));
            }
            self.scroll_position = s;
        }

        self.current_page = page;
        self.last_tts_chunk_id = tts_chunk;
        Ok(())
    }

    /// Update document title.
    pub fn update_title(&mut self, title: String) {
        self.title = Some(title);
    }

    /// Relocate document to a new file path.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if the new path is empty.
    pub fn relocate(&mut self, new_path: String) -> Result<(), DomainError> {
        if new_path.trim().is_empty() {
            return Err(DomainError::validation("File path required"));
        }
        self.file_path = new_path;
        Ok(())
    }
}

/// Builder for creating Document entities in tests.
#[derive(Default)]
pub struct DocumentBuilder {
    id: String,
    file_path: String,
    title: Option<String>,
    page_count: Option<i32>,
    current_page: i32,
    scroll_position: f64,
    last_tts_chunk_id: Option<String>,
    last_opened_at: Option<String>,
    file_hash: Option<String>,
    created_at: String,
}

impl DocumentBuilder {
    pub fn new() -> Self {
        Self {
            id: "test-id".to_string(),
            file_path: "/path/to/test.pdf".to_string(),
            title: None,
            page_count: None,
            current_page: 1,
            scroll_position: 0.0,
            last_tts_chunk_id: None,
            last_opened_at: None,
            file_hash: None,
            created_at: "2026-01-13T00:00:00Z".to_string(),
        }
    }

    pub fn id(mut self, id: impl Into<String>) -> Self {
        self.id = id.into();
        self
    }

    pub fn file_path(mut self, path: impl Into<String>) -> Self {
        self.file_path = path.into();
        self
    }

    pub fn title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }

    pub fn page_count(mut self, count: i32) -> Self {
        self.page_count = Some(count);
        self
    }

    pub fn current_page(mut self, page: i32) -> Self {
        self.current_page = page;
        self
    }

    pub fn scroll_position(mut self, scroll: f64) -> Self {
        self.scroll_position = scroll;
        self
    }

    pub fn build(self) -> Result<Document, DomainError> {
        Document::new(
            self.id,
            self.file_path,
            self.title,
            self.page_count,
            self.current_page,
            self.scroll_position,
            self.last_tts_chunk_id,
            self.last_opened_at,
            self.file_hash,
            self.created_at,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==========================================================================
    // Document Creation Tests
    // ==========================================================================

    #[test]
    fn test_create_valid_document() {
        let doc = DocumentBuilder::new()
            .id("abc123")
            .file_path("/home/user/document.pdf")
            .title("Test Document")
            .page_count(100)
            .current_page(1)
            .scroll_position(0.0)
            .build();

        assert!(doc.is_ok());
        let doc = doc.unwrap();
        assert_eq!(doc.id, "abc123");
        assert_eq!(doc.file_path, "/home/user/document.pdf");
        assert_eq!(doc.title, Some("Test Document".to_string()));
        assert_eq!(doc.page_count, Some(100));
        assert_eq!(doc.current_page, 1);
        assert_eq!(doc.scroll_position, 0.0);
    }

    #[test]
    fn test_create_document_without_optional_fields() {
        let doc = DocumentBuilder::new()
            .id("abc123")
            .file_path("/path/to/doc.pdf")
            .build();

        assert!(doc.is_ok());
        let doc = doc.unwrap();
        assert!(doc.title.is_none());
        assert!(doc.page_count.is_none());
    }

    // ==========================================================================
    // File Path Validation Tests
    // ==========================================================================

    #[test]
    fn test_empty_file_path_rejected() {
        let doc = DocumentBuilder::new().file_path("").build();

        assert!(doc.is_err());
        let err = doc.unwrap_err();
        assert!(matches!(err, DomainError::Validation(_)));
    }

    #[test]
    fn test_whitespace_file_path_rejected() {
        let doc = DocumentBuilder::new().file_path("   ").build();

        assert!(doc.is_err());
    }

    // ==========================================================================
    // Page Number Validation Tests
    // ==========================================================================

    #[test]
    fn test_zero_page_rejected() {
        let doc = DocumentBuilder::new().current_page(0).build();

        assert!(doc.is_err());
        let err = doc.unwrap_err();
        assert!(matches!(err, DomainError::Validation(_)));
    }

    #[test]
    fn test_negative_page_rejected() {
        let doc = DocumentBuilder::new().current_page(-1).build();

        assert!(doc.is_err());
    }

    #[test]
    fn test_page_one_accepted() {
        let doc = DocumentBuilder::new().current_page(1).build();

        assert!(doc.is_ok());
        assert_eq!(doc.unwrap().current_page, 1);
    }

    #[test]
    fn test_page_exceeds_count_rejected() {
        let doc = DocumentBuilder::new()
            .page_count(10)
            .current_page(11)
            .build();

        assert!(doc.is_err());
    }

    #[test]
    fn test_page_equals_count_accepted() {
        let doc = DocumentBuilder::new()
            .page_count(10)
            .current_page(10)
            .build();

        assert!(doc.is_ok());
    }

    #[test]
    fn test_page_without_count_accepted() {
        // When page_count is None, any positive page is valid
        let doc = DocumentBuilder::new().current_page(999).build();

        assert!(doc.is_ok());
    }

    // ==========================================================================
    // Scroll Position Validation Tests
    // ==========================================================================

    #[test]
    fn test_scroll_zero_accepted() {
        let doc = DocumentBuilder::new().scroll_position(0.0).build();

        assert!(doc.is_ok());
        assert_eq!(doc.unwrap().scroll_position, 0.0);
    }

    #[test]
    fn test_scroll_one_accepted() {
        let doc = DocumentBuilder::new().scroll_position(1.0).build();

        assert!(doc.is_ok());
        assert_eq!(doc.unwrap().scroll_position, 1.0);
    }

    #[test]
    fn test_scroll_middle_accepted() {
        let doc = DocumentBuilder::new().scroll_position(0.5).build();

        assert!(doc.is_ok());
    }

    #[test]
    fn test_scroll_negative_rejected() {
        let doc = DocumentBuilder::new().scroll_position(-0.1).build();

        assert!(doc.is_err());
    }

    #[test]
    fn test_scroll_above_one_rejected() {
        let doc = DocumentBuilder::new().scroll_position(1.1).build();

        assert!(doc.is_err());
    }

    // ==========================================================================
    // Update Progress Tests
    // ==========================================================================

    #[test]
    fn test_update_progress_valid() {
        let mut doc = DocumentBuilder::new()
            .page_count(100)
            .current_page(1)
            .build()
            .unwrap();

        let result = doc.update_progress(50, Some(0.5), Some("chunk-1".to_string()));

        assert!(result.is_ok());
        assert_eq!(doc.current_page, 50);
        assert_eq!(doc.scroll_position, 0.5);
        assert_eq!(doc.last_tts_chunk_id, Some("chunk-1".to_string()));
    }

    #[test]
    fn test_update_progress_invalid_page() {
        let mut doc = DocumentBuilder::new()
            .page_count(10)
            .current_page(1)
            .build()
            .unwrap();

        let result = doc.update_progress(11, None, None);

        assert!(result.is_err());
        // Original values should be unchanged
        assert_eq!(doc.current_page, 1);
    }

    #[test]
    fn test_update_progress_invalid_scroll() {
        let mut doc = DocumentBuilder::new().build().unwrap();

        let result = doc.update_progress(1, Some(1.5), None);

        assert!(result.is_err());
    }

    #[test]
    fn test_update_progress_preserves_scroll_when_none() {
        let mut doc = DocumentBuilder::new()
            .scroll_position(0.75)
            .build()
            .unwrap();

        let result = doc.update_progress(2, None, None);

        assert!(result.is_ok());
        assert_eq!(doc.current_page, 2);
        assert_eq!(doc.scroll_position, 0.75); // Unchanged
    }

    // ==========================================================================
    // Update Title Tests
    // ==========================================================================

    #[test]
    fn test_update_title() {
        let mut doc = DocumentBuilder::new().build().unwrap();

        doc.update_title("New Title".to_string());

        assert_eq!(doc.title, Some("New Title".to_string()));
    }

    #[test]
    fn test_update_title_overwrites() {
        let mut doc = DocumentBuilder::new().title("Old Title").build().unwrap();

        doc.update_title("New Title".to_string());

        assert_eq!(doc.title, Some("New Title".to_string()));
    }

    // ==========================================================================
    // Relocate Tests
    // ==========================================================================

    #[test]
    fn test_relocate_valid() {
        let mut doc = DocumentBuilder::new()
            .file_path("/old/path.pdf")
            .build()
            .unwrap();

        let result = doc.relocate("/new/path.pdf".to_string());

        assert!(result.is_ok());
        assert_eq!(doc.file_path, "/new/path.pdf");
    }

    #[test]
    fn test_relocate_empty_path_rejected() {
        let mut doc = DocumentBuilder::new().build().unwrap();

        let result = doc.relocate("".to_string());

        assert!(result.is_err());
    }

    // ==========================================================================
    // Page Count Validation Tests
    // ==========================================================================

    #[test]
    fn test_zero_page_count_rejected() {
        let doc = DocumentBuilder::new().page_count(0).build();

        assert!(doc.is_err());
    }

    #[test]
    fn test_negative_page_count_rejected() {
        let doc = DocumentBuilder::new().page_count(-1).build();

        assert!(doc.is_err());
    }
}
