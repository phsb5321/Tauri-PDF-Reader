use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Domain-level errors for the application.
/// These errors represent business logic failures, not infrastructure failures.
#[derive(Debug, Clone, Error, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", content = "message")]
pub enum DomainError {
    /// Resource not found (document, highlight, setting, etc.)
    #[error("Not found: {0}")]
    NotFound(String),

    /// Validation error (invalid input, business rule violation)
    #[error("Validation error: {0}")]
    Validation(String),

    /// Storage/persistence error (database, file system)
    #[error("Storage error: {0}")]
    Storage(String),

    /// Text-to-speech error
    #[error("TTS error: {0}")]
    Tts(String),

    /// File system operation error
    #[error("File system error: {0}")]
    FileSystem(String),
}

impl DomainError {
    pub fn not_found(msg: impl Into<String>) -> Self {
        DomainError::NotFound(msg.into())
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        DomainError::Validation(msg.into())
    }

    pub fn storage(msg: impl Into<String>) -> Self {
        DomainError::Storage(msg.into())
    }

    pub fn tts(msg: impl Into<String>) -> Self {
        DomainError::Tts(msg.into())
    }

    pub fn file_system(msg: impl Into<String>) -> Self {
        DomainError::FileSystem(msg.into())
    }
}

/// Convert DomainError to a string for Tauri command responses.
impl From<DomainError> for String {
    fn from(err: DomainError) -> Self {
        err.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_domain_error_display() {
        let err = DomainError::not_found("Document with id 123");
        assert_eq!(err.to_string(), "Not found: Document with id 123");
    }

    #[test]
    fn test_domain_error_serialization() {
        let err = DomainError::Validation("Invalid page number".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("Validation"));
        assert!(json.contains("Invalid page number"));
    }

    #[test]
    fn test_domain_error_into_string() {
        let err = DomainError::storage("Database connection failed");
        let s: String = err.into();
        assert_eq!(s, "Storage error: Database connection failed");
    }
}
