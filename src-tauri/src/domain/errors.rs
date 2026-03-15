//! Domain error types for reading sessions and audio cache
//!
//! These errors are used across the domain, ports, and adapters layers.

use serde::{Deserialize, Serialize};
use std::fmt;

/// Repository errors for data persistence operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RepositoryError {
    /// Resource not found
    NotFound(String),
    /// Database operation failed
    DatabaseError(String),
    /// Validation failed
    ValidationError(String),
    /// I/O operation failed
    IoError(String),
}

impl fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RepositoryError::NotFound(msg) => write!(f, "NOT_FOUND: {}", msg),
            RepositoryError::DatabaseError(msg) => write!(f, "DATABASE_ERROR: {}", msg),
            RepositoryError::ValidationError(msg) => write!(f, "VALIDATION_ERROR: {}", msg),
            RepositoryError::IoError(msg) => write!(f, "IO_ERROR: {}", msg),
        }
    }
}

impl std::error::Error for RepositoryError {}

impl From<sqlx::Error> for RepositoryError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => RepositoryError::NotFound("Row not found".into()),
            _ => RepositoryError::DatabaseError(err.to_string()),
        }
    }
}

impl From<std::io::Error> for RepositoryError {
    fn from(err: std::io::Error) -> Self {
        RepositoryError::IoError(err.to_string())
    }
}

/// Export errors for audio export operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportError {
    /// Document not ready for export (missing cached chunks)
    NotReady(String),
    /// Export was cancelled by user
    Cancelled,
    /// Failed to write output file
    WriteError(String),
    /// Invalid output path
    PathInvalid(String),
    /// Cache read error during export
    CacheError(String),
}

impl fmt::Display for ExportError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ExportError::NotReady(msg) => write!(f, "EXPORT_NOT_READY: {}", msg),
            ExportError::Cancelled => write!(f, "EXPORT_CANCELLED"),
            ExportError::WriteError(msg) => write!(f, "EXPORT_WRITE_ERROR: {}", msg),
            ExportError::PathInvalid(msg) => write!(f, "EXPORT_PATH_INVALID: {}", msg),
            ExportError::CacheError(msg) => write!(f, "CACHE_ERROR: {}", msg),
        }
    }
}

impl std::error::Error for ExportError {}

impl From<std::io::Error> for ExportError {
    fn from(err: std::io::Error) -> Self {
        ExportError::WriteError(err.to_string())
    }
}

impl From<RepositoryError> for ExportError {
    fn from(err: RepositoryError) -> Self {
        ExportError::CacheError(err.to_string())
    }
}

/// Convert domain errors to Tauri-compatible string errors
pub trait IntoTauriError {
    fn into_tauri_error(self) -> String;
}

impl IntoTauriError for RepositoryError {
    fn into_tauri_error(self) -> String {
        self.to_string()
    }
}

impl IntoTauriError for ExportError {
    fn into_tauri_error(self) -> String {
        self.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_repository_error_display() {
        let err = RepositoryError::NotFound("Session xyz".into());
        assert_eq!(err.to_string(), "NOT_FOUND: Session xyz");

        let err = RepositoryError::DatabaseError("Connection failed".into());
        assert_eq!(err.to_string(), "DATABASE_ERROR: Connection failed");

        let err = RepositoryError::ValidationError("Name too long".into());
        assert_eq!(err.to_string(), "VALIDATION_ERROR: Name too long");

        let err = RepositoryError::IoError("File not found".into());
        assert_eq!(err.to_string(), "IO_ERROR: File not found");
    }

    #[test]
    fn test_export_error_display() {
        let err = ExportError::NotReady("Missing 5 chunks".into());
        assert_eq!(err.to_string(), "EXPORT_NOT_READY: Missing 5 chunks");

        let err = ExportError::Cancelled;
        assert_eq!(err.to_string(), "EXPORT_CANCELLED");

        let err = ExportError::WriteError("Disk full".into());
        assert_eq!(err.to_string(), "EXPORT_WRITE_ERROR: Disk full");

        let err = ExportError::PathInvalid("/invalid/path".into());
        assert_eq!(err.to_string(), "EXPORT_PATH_INVALID: /invalid/path");

        let err = ExportError::CacheError("Cache corrupted".into());
        assert_eq!(err.to_string(), "CACHE_ERROR: Cache corrupted");
    }

    #[test]
    fn test_into_tauri_error() {
        let repo_err = RepositoryError::NotFound("Test".into());
        assert_eq!(repo_err.into_tauri_error(), "NOT_FOUND: Test");

        let export_err = ExportError::Cancelled;
        assert_eq!(export_err.into_tauri_error(), "EXPORT_CANCELLED");
    }
}
