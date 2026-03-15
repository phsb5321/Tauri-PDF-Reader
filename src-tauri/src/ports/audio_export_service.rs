//! Audio Export Service Port
//!
//! Defines the contract for audio export operations.

use crate::domain::errors::ExportError;
use crate::domain::export::{ExportOptions, ExportProgress, ExportReadiness, ExportResult};
use async_trait::async_trait;
#[cfg(any(test, feature = "test-mocks"))]
use mockall::automock;
use std::sync::Arc;

/// Progress callback type
pub type ProgressCallback = Arc<dyn Fn(ExportProgress) + Send + Sync>;

/// Service trait for audio export functionality
#[cfg_attr(any(test, feature = "test-mocks"), automock)]
#[async_trait]
pub trait AudioExportService: Send + Sync {
    /// Check if document is ready for export
    async fn check_readiness(
        &self,
        document_id: &str,
        voice_id: Option<String>,
    ) -> Result<ExportReadiness, ExportError>;

    /// Export document audio to file
    async fn export(
        &self,
        options: ExportOptions,
        progress_callback: Option<ProgressCallback>,
    ) -> Result<ExportResult, ExportError>;

    /// Cancel in-progress export
    fn cancel(&self) -> bool;
}
