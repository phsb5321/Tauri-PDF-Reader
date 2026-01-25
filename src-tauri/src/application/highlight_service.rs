//! Highlight Application Service
//!
//! Provides use cases for managing document highlights.
//! Uses generic trait bounds to allow dependency injection of the repository.

use crate::domain::DomainError;
use crate::ports::{
    BatchCreateResponse, DeleteResponse, ExportFormat, ExportResponse, Highlight, HighlightCreate,
    HighlightRepository, HighlightUpdate,
};

/// Application service for managing highlights.
///
/// This service:
/// - Validates highlight operations
/// - Delegates persistence to the injected repository
/// - Orchestrates complex highlight operations
pub struct HighlightService<R: HighlightRepository> {
    repository: R,
}

/// Regex-free hex color validation
fn is_valid_hex_color(color: &str) -> bool {
    if !color.starts_with('#') || color.len() != 7 {
        return false;
    }
    color[1..].chars().all(|c| c.is_ascii_hexdigit())
}

impl<R: HighlightRepository> HighlightService<R> {
    /// Create a new HighlightService with the given repository.
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    /// Create a new highlight.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if any validation fails.
    pub async fn create(&self, input: HighlightCreate) -> Result<Highlight, DomainError> {
        // Validate rects non-empty
        if input.rects.is_empty() {
            return Err(DomainError::validation("At least one rect required"));
        }

        // Validate page_number >= 1
        if input.page_number < 1 {
            return Err(DomainError::validation("Page must be positive"));
        }

        // Validate color format
        if !is_valid_hex_color(&input.color) {
            return Err(DomainError::validation("Invalid color format"));
        }

        self.repository.create(input).await
    }

    /// Create multiple highlights in a batch.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if any highlight fails validation.
    pub async fn batch_create(
        &self,
        inputs: Vec<HighlightCreate>,
    ) -> Result<BatchCreateResponse, DomainError> {
        // Validate all inputs first
        for (i, input) in inputs.iter().enumerate() {
            if input.rects.is_empty() {
                return Err(DomainError::validation(format!(
                    "Highlight {} must have at least one rect",
                    i
                )));
            }
            if input.page_number < 1 {
                return Err(DomainError::validation(format!(
                    "Highlight {} page must be positive",
                    i
                )));
            }
            if !is_valid_hex_color(&input.color) {
                return Err(DomainError::validation(format!(
                    "Highlight {} has invalid color format",
                    i
                )));
            }
        }

        self.repository.batch_create(inputs).await
    }

    /// Get a highlight by ID.
    pub async fn get(&self, id: String) -> Result<Option<Highlight>, DomainError> {
        self.repository.get_by_id(id).await
    }

    /// List highlights for a specific page.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if page_number < 1.
    pub async fn list_for_page(
        &self,
        document_id: String,
        page_number: i32,
    ) -> Result<Vec<Highlight>, DomainError> {
        if page_number < 1 {
            return Err(DomainError::validation("Page must be positive"));
        }

        self.repository
            .list_for_page(document_id, page_number)
            .await
    }

    /// List all highlights for a document.
    pub async fn list_for_document(
        &self,
        document_id: String,
    ) -> Result<Vec<Highlight>, DomainError> {
        self.repository.list_for_document(document_id).await
    }

    /// Update a highlight's color or note.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if color is invalid.
    pub async fn update(
        &self,
        id: String,
        input: HighlightUpdate,
    ) -> Result<Highlight, DomainError> {
        // Validate color if provided
        if let Some(ref color) = input.color {
            if !is_valid_hex_color(color) {
                return Err(DomainError::validation("Invalid color format"));
            }
        }

        self.repository.update(id, input).await
    }

    /// Delete a highlight.
    pub async fn delete(&self, id: String) -> Result<(), DomainError> {
        self.repository.delete(id).await
    }

    /// Delete all highlights for a document.
    pub async fn delete_for_document(
        &self,
        document_id: String,
    ) -> Result<DeleteResponse, DomainError> {
        self.repository.delete_for_document(document_id).await
    }

    /// Export highlights in various formats.
    pub async fn export(
        &self,
        document_id: String,
        format: ExportFormat,
    ) -> Result<ExportResponse, DomainError> {
        self.repository.export(document_id, format).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ports::{MockHighlightRepository, Rect};
    use mockall::predicate::*;

    fn create_test_rect() -> Rect {
        Rect {
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 20.0,
        }
    }

    fn create_test_highlight_input() -> HighlightCreate {
        HighlightCreate {
            document_id: "doc-123".to_string(),
            page_number: 1,
            rects: vec![create_test_rect()],
            color: "#FFEB3B".to_string(),
            text_content: Some("Test text".to_string()),
        }
    }

    fn create_test_highlight() -> Highlight {
        Highlight {
            id: "hl-123".to_string(),
            document_id: "doc-123".to_string(),
            page_number: 1,
            rects: vec![create_test_rect()],
            color: "#FFEB3B".to_string(),
            text_content: Some("Test text".to_string()),
            note: None,
            created_at: "2026-01-13T00:00:00Z".to_string(),
            updated_at: None,
        }
    }

    // ==========================================================================
    // Create Highlight Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_create_highlight_success() {
        let mut mock = MockHighlightRepository::new();
        mock.expect_create().times(1).returning(|_| {
            Ok(Highlight {
                id: "hl-123".to_string(),
                document_id: "doc-123".to_string(),
                page_number: 1,
                rects: vec![Rect {
                    x: 0.0,
                    y: 0.0,
                    width: 100.0,
                    height: 20.0,
                }],
                color: "#FFEB3B".to_string(),
                text_content: Some("Test text".to_string()),
                note: None,
                created_at: "2026-01-13T00:00:00Z".to_string(),
                updated_at: None,
            })
        });

        let service = HighlightService::new(mock);
        let result = service.create(create_test_highlight_input()).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().id, "hl-123");
    }

    #[tokio::test]
    async fn test_create_highlight_empty_rects_rejected() {
        let mock = MockHighlightRepository::new();

        let service = HighlightService::new(mock);
        let mut input = create_test_highlight_input();
        input.rects = vec![];

        let result = service.create(input).await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DomainError::Validation(_)));
    }

    #[tokio::test]
    async fn test_create_highlight_zero_page_rejected() {
        let mock = MockHighlightRepository::new();

        let service = HighlightService::new(mock);
        let mut input = create_test_highlight_input();
        input.page_number = 0;

        let result = service.create(input).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_create_highlight_negative_page_rejected() {
        let mock = MockHighlightRepository::new();

        let service = HighlightService::new(mock);
        let mut input = create_test_highlight_input();
        input.page_number = -1;

        let result = service.create(input).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_create_highlight_invalid_color_rejected() {
        let mock = MockHighlightRepository::new();

        let service = HighlightService::new(mock);
        let mut input = create_test_highlight_input();
        input.color = "invalid".to_string();

        let result = service.create(input).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_create_highlight_color_no_hash_rejected() {
        let mock = MockHighlightRepository::new();

        let service = HighlightService::new(mock);
        let mut input = create_test_highlight_input();
        input.color = "FFEB3B".to_string();

        let result = service.create(input).await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Batch Create Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_batch_create_success() {
        let mut mock = MockHighlightRepository::new();
        mock.expect_batch_create().times(1).returning(|inputs| {
            Ok(BatchCreateResponse {
                highlights: inputs
                    .into_iter()
                    .enumerate()
                    .map(|(i, input)| Highlight {
                        id: format!("hl-{}", i),
                        document_id: input.document_id,
                        page_number: input.page_number,
                        rects: input.rects,
                        color: input.color,
                        text_content: input.text_content,
                        note: None,
                        created_at: "2026-01-13T00:00:00Z".to_string(),
                        updated_at: None,
                    })
                    .collect(),
                created: 2,
            })
        });

        let service = HighlightService::new(mock);
        let inputs = vec![create_test_highlight_input(), create_test_highlight_input()];
        let result = service.batch_create(inputs).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().created, 2);
    }

    #[tokio::test]
    async fn test_batch_create_one_invalid_rejected() {
        let mock = MockHighlightRepository::new();

        let service = HighlightService::new(mock);
        let mut input1 = create_test_highlight_input();
        let mut input2 = create_test_highlight_input();
        input2.color = "invalid".to_string(); // Second highlight has invalid color

        let result = service.batch_create(vec![input1, input2]).await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Get Highlight Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_get_highlight_found() {
        let mut mock = MockHighlightRepository::new();
        mock.expect_get_by_id()
            .with(eq("hl-123".to_string()))
            .times(1)
            .returning(|_| Ok(Some(create_test_highlight())));

        let service = HighlightService::new(mock);
        let result = service.get("hl-123".to_string()).await;

        assert!(result.is_ok());
        assert!(result.unwrap().is_some());
    }

    #[tokio::test]
    async fn test_get_highlight_not_found() {
        let mut mock = MockHighlightRepository::new();
        mock.expect_get_by_id()
            .with(eq("nonexistent".to_string()))
            .times(1)
            .returning(|_| Ok(None));

        let service = HighlightService::new(mock);
        let result = service.get("nonexistent".to_string()).await;

        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    // ==========================================================================
    // List for Page Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_list_for_page_success() {
        let mut mock = MockHighlightRepository::new();
        mock.expect_list_for_page()
            .with(eq("doc-123".to_string()), eq(1))
            .times(1)
            .returning(|_, _| Ok(vec![create_test_highlight()]));

        let service = HighlightService::new(mock);
        let result = service.list_for_page("doc-123".to_string(), 1).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn test_list_for_page_zero_page_rejected() {
        let mock = MockHighlightRepository::new();

        let service = HighlightService::new(mock);
        let result = service.list_for_page("doc-123".to_string(), 0).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_list_for_page_negative_page_rejected() {
        let mock = MockHighlightRepository::new();

        let service = HighlightService::new(mock);
        let result = service.list_for_page("doc-123".to_string(), -1).await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Update Highlight Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_update_highlight_color() {
        let mut mock = MockHighlightRepository::new();
        mock.expect_update().times(1).returning(|_, _| {
            let mut hl = create_test_highlight();
            hl.color = "#FF0000".to_string();
            Ok(hl)
        });

        let service = HighlightService::new(mock);
        let result = service
            .update(
                "hl-123".to_string(),
                HighlightUpdate {
                    color: Some("#FF0000".to_string()),
                    note: None,
                },
            )
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().color, "#FF0000");
    }

    #[tokio::test]
    async fn test_update_highlight_note() {
        let mut mock = MockHighlightRepository::new();
        mock.expect_update().times(1).returning(|_, _| {
            let mut hl = create_test_highlight();
            hl.note = Some("My note".to_string());
            Ok(hl)
        });

        let service = HighlightService::new(mock);
        let result = service
            .update(
                "hl-123".to_string(),
                HighlightUpdate {
                    color: None,
                    note: Some("My note".to_string()),
                },
            )
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().note, Some("My note".to_string()));
    }

    #[tokio::test]
    async fn test_update_highlight_invalid_color_rejected() {
        let mock = MockHighlightRepository::new();

        let service = HighlightService::new(mock);
        let result = service
            .update(
                "hl-123".to_string(),
                HighlightUpdate {
                    color: Some("invalid".to_string()),
                    note: None,
                },
            )
            .await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Delete Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_delete_highlight() {
        let mut mock = MockHighlightRepository::new();
        mock.expect_delete()
            .with(eq("hl-123".to_string()))
            .times(1)
            .returning(|_| Ok(()));

        let service = HighlightService::new(mock);
        let result = service.delete("hl-123".to_string()).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_delete_for_document() {
        let mut mock = MockHighlightRepository::new();
        mock.expect_delete_for_document()
            .with(eq("doc-123".to_string()))
            .times(1)
            .returning(|_| {
                Ok(DeleteResponse {
                    success: true,
                    deleted: Some(5),
                })
            });

        let service = HighlightService::new(mock);
        let result = service.delete_for_document("doc-123".to_string()).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().deleted, Some(5));
    }

    // ==========================================================================
    // Export Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_export_markdown() {
        let mut mock = MockHighlightRepository::new();
        mock.expect_export()
            .with(eq("doc-123".to_string()), eq(ExportFormat::Markdown))
            .times(1)
            .returning(|_, _| {
                Ok(ExportResponse {
                    content: "# Highlights\n\n- Test".to_string(),
                    filename: "highlights.md".to_string(),
                })
            });

        let service = HighlightService::new(mock);
        let result = service
            .export("doc-123".to_string(), ExportFormat::Markdown)
            .await;

        assert!(result.is_ok());
        assert!(result.unwrap().content.contains("Highlights"));
    }
}
