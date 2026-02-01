//! Export result domain entities
//!
//! Defines entities for audio export operations.

use serde::{Deserialize, Serialize};

/// Result of an audio export operation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub success: bool,
    pub output_path: String,
    pub format: String,
    pub total_duration_ms: i64,
    pub chapter_count: i32,
    pub file_size_bytes: i64,
    pub exported_at: String,
}

impl ExportResult {
    /// Create a successful export result
    pub fn success(
        output_path: String,
        format: String,
        total_duration_ms: i64,
        chapter_count: i32,
        file_size_bytes: i64,
    ) -> Self {
        Self {
            success: true,
            output_path,
            format,
            total_duration_ms,
            chapter_count,
            file_size_bytes,
            exported_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Create a failed export result
    pub fn failed(output_path: String, format: String) -> Self {
        Self {
            success: false,
            output_path,
            format,
            total_duration_ms: 0,
            chapter_count: 0,
            file_size_bytes: 0,
            exported_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

/// Progress update during export
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub phase: String,
    pub current_chunk: i32,
    pub total_chunks: i32,
    pub percent: f64,
    pub estimated_remaining_ms: i64,
}

impl ExportProgress {
    /// Export phase constants
    pub const PHASE_LOADING: &'static str = "loading";
    pub const PHASE_CONCATENATING: &'static str = "concatenating";
    pub const PHASE_EMBEDDING: &'static str = "embedding";
    pub const PHASE_WRITING: &'static str = "writing";
    pub const PHASE_COMPLETE: &'static str = "complete";
    pub const PHASE_ERROR: &'static str = "error";

    /// Create a new progress update
    pub fn new(
        phase: impl Into<String>,
        current_chunk: i32,
        total_chunks: i32,
        estimated_remaining_ms: i64,
    ) -> Self {
        let percent = if total_chunks > 0 {
            ((current_chunk as f64 / total_chunks as f64) * 100.0).round()
        } else {
            0.0
        };

        Self {
            phase: phase.into(),
            current_chunk,
            total_chunks,
            percent,
            estimated_remaining_ms,
        }
    }

    /// Create a completed progress
    pub fn complete(total_chunks: i32) -> Self {
        Self {
            phase: Self::PHASE_COMPLETE.to_string(),
            current_chunk: total_chunks,
            total_chunks,
            percent: 100.0,
            estimated_remaining_ms: 0,
        }
    }

    /// Create an error progress
    pub fn error(current_chunk: i32, total_chunks: i32) -> Self {
        let percent = if total_chunks > 0 {
            ((current_chunk as f64 / total_chunks as f64) * 100.0).round()
        } else {
            0.0
        };

        Self {
            phase: Self::PHASE_ERROR.to_string(),
            current_chunk,
            total_chunks,
            percent,
            estimated_remaining_ms: 0,
        }
    }
}

/// Options for exporting audio
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub document_id: String,
    pub format: String,
    pub output_path: String,
    pub include_chapters: bool,
    pub chapter_strategy: String,
    pub voice_id: Option<String>,
}

impl ExportOptions {
    /// Chapter strategy: one chapter per page
    pub const CHAPTER_STRATEGY_PAGE: &'static str = "page";
    /// Chapter strategy: entire document as one chapter
    pub const CHAPTER_STRATEGY_DOCUMENT: &'static str = "document";

    /// Create new export options with defaults
    pub fn new(document_id: String, format: String, output_path: String) -> Self {
        Self {
            document_id,
            format,
            output_path,
            include_chapters: true,
            chapter_strategy: Self::CHAPTER_STRATEGY_PAGE.to_string(),
            voice_id: None,
        }
    }

    /// Validate export options
    pub fn validate(&self) -> Result<(), String> {
        if self.document_id.is_empty() {
            return Err("Document ID cannot be empty".into());
        }
        if self.output_path.is_empty() {
            return Err("Output path cannot be empty".into());
        }
        if self.format != "mp3" && self.format != "m4b" {
            return Err("Format must be 'mp3' or 'm4b'".into());
        }
        if self.chapter_strategy != Self::CHAPTER_STRATEGY_PAGE
            && self.chapter_strategy != Self::CHAPTER_STRATEGY_DOCUMENT
        {
            return Err("Chapter strategy must be 'page' or 'document'".into());
        }
        Ok(())
    }
}

/// Readiness check result for export
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportReadiness {
    pub ready: bool,
    pub coverage_percent: f64,
    pub missing_chunks: Vec<MissingChunkInfo>,
    pub estimated_duration_ms: i64,
    pub estimated_file_size_bytes: i64,
}

impl ExportReadiness {
    /// Create a ready-to-export result
    pub fn ready(estimated_duration_ms: i64, estimated_file_size_bytes: i64) -> Self {
        Self {
            ready: true,
            coverage_percent: 100.0,
            missing_chunks: Vec::new(),
            estimated_duration_ms,
            estimated_file_size_bytes,
        }
    }

    /// Create a not-ready result with missing chunks
    pub fn not_ready(
        coverage_percent: f64,
        missing_chunks: Vec<MissingChunkInfo>,
        estimated_duration_ms: i64,
        estimated_file_size_bytes: i64,
    ) -> Self {
        Self {
            ready: false,
            coverage_percent,
            missing_chunks,
            estimated_duration_ms,
            estimated_file_size_bytes,
        }
    }
}

/// Information about a missing cache chunk
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MissingChunkInfo {
    pub page_number: i32,
    pub chunk_index: i32,
    pub text_preview: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_result_success() {
        let result = ExportResult::success(
            "/path/to/output.mp3".to_string(),
            "mp3".to_string(),
            300000,
            10,
            5242880,
        );
        assert!(result.success);
        assert_eq!(result.total_duration_ms, 300000);
        assert_eq!(result.chapter_count, 10);
    }

    #[test]
    fn test_export_result_failed() {
        let result = ExportResult::failed("/path/to/output.mp3".to_string(), "mp3".to_string());
        assert!(!result.success);
        assert_eq!(result.total_duration_ms, 0);
    }

    #[test]
    fn test_export_progress_new() {
        let progress = ExportProgress::new(ExportProgress::PHASE_LOADING, 25, 100, 5000);
        assert_eq!(progress.phase, "loading");
        assert_eq!(progress.current_chunk, 25);
        assert_eq!(progress.percent, 25.0);
    }

    #[test]
    fn test_export_progress_complete() {
        let progress = ExportProgress::complete(100);
        assert_eq!(progress.phase, "complete");
        assert_eq!(progress.percent, 100.0);
        assert_eq!(progress.estimated_remaining_ms, 0);
    }

    #[test]
    fn test_export_options_new() {
        let options = ExportOptions::new(
            "doc-1".to_string(),
            "mp3".to_string(),
            "/path/to/output.mp3".to_string(),
        );
        assert!(options.include_chapters);
        assert_eq!(options.chapter_strategy, "page");
    }

    #[test]
    fn test_export_options_validate() {
        let options = ExportOptions::new(
            "doc-1".to_string(),
            "mp3".to_string(),
            "/path/to/output.mp3".to_string(),
        );
        assert!(options.validate().is_ok());
    }

    #[test]
    fn test_export_options_validate_invalid_format() {
        let mut options = ExportOptions::new(
            "doc-1".to_string(),
            "wav".to_string(),
            "/path/to/output.wav".to_string(),
        );
        assert!(options.validate().is_err());

        options.format = "m4b".to_string();
        assert!(options.validate().is_ok());
    }

    #[test]
    fn test_export_options_validate_empty_document_id() {
        let options = ExportOptions::new(
            "".to_string(),
            "mp3".to_string(),
            "/path/to/output.mp3".to_string(),
        );
        assert!(options.validate().is_err());
    }

    #[test]
    fn test_export_readiness_ready() {
        let readiness = ExportReadiness::ready(300000, 5242880);
        assert!(readiness.ready);
        assert_eq!(readiness.coverage_percent, 100.0);
        assert!(readiness.missing_chunks.is_empty());
    }

    #[test]
    fn test_export_readiness_not_ready() {
        let missing = vec![MissingChunkInfo {
            page_number: 5,
            chunk_index: 2,
            text_preview: "Some text...".to_string(),
        }];
        let readiness = ExportReadiness::not_ready(75.0, missing, 225000, 3932160);
        assert!(!readiness.ready);
        assert_eq!(readiness.coverage_percent, 75.0);
        assert_eq!(readiness.missing_chunks.len(), 1);
    }
}
