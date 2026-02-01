//! Reading session domain entities
//!
//! Defines the core domain entities for managing reading sessions.

use serde::{Deserialize, Serialize};

/// Validation constants for sessions
pub const SESSION_NAME_MIN_LENGTH: usize = 1;
pub const SESSION_NAME_MAX_LENGTH: usize = 100;
pub const MAX_DOCUMENTS_PER_SESSION: usize = 50;

/// A reading session containing multiple documents with saved positions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReadingSession {
    pub id: String,
    pub name: String,
    pub documents: Vec<SessionDocument>,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed_at: String,
}

impl ReadingSession {
    /// Create a new reading session
    pub fn new(id: String, name: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id,
            name,
            documents: Vec::new(),
            created_at: now.clone(),
            updated_at: now.clone(),
            last_accessed_at: now,
        }
    }

    /// Validate the session
    pub fn validate(&self) -> Result<(), String> {
        let trimmed_name = self.name.trim();
        if trimmed_name.is_empty() {
            return Err("Session name cannot be empty".into());
        }
        if trimmed_name.len() > SESSION_NAME_MAX_LENGTH {
            return Err(format!(
                "Session name must be {} characters or less",
                SESSION_NAME_MAX_LENGTH
            ));
        }
        if self.documents.len() > MAX_DOCUMENTS_PER_SESSION {
            return Err(format!(
                "Session cannot contain more than {} documents",
                MAX_DOCUMENTS_PER_SESSION
            ));
        }
        Ok(())
    }

    /// Add a document to the session
    pub fn add_document(&mut self, document_id: String, position: Option<i32>) {
        let pos = position.unwrap_or(self.documents.len() as i32);
        let now = chrono::Utc::now().to_rfc3339();

        let doc = SessionDocument {
            document_id,
            position: pos,
            current_page: 1,
            scroll_position: 0.0,
            created_at: now.clone(),
            title: None,
            page_count: None,
        };

        // Insert at the correct position, shifting others
        let insert_idx = self.documents.iter().position(|d| d.position >= pos);
        match insert_idx {
            Some(idx) => {
                // Shift positions of documents after insertion point
                for d in self.documents.iter_mut().skip(idx) {
                    d.position += 1;
                }
                self.documents.insert(idx, doc);
            }
            None => {
                self.documents.push(doc);
            }
        }

        self.updated_at = now;
    }

    /// Remove a document from the session
    pub fn remove_document(&mut self, document_id: &str) -> bool {
        let initial_len = self.documents.len();
        self.documents.retain(|d| d.document_id != document_id);

        if self.documents.len() != initial_len {
            // Recompute positions to be contiguous
            for (i, doc) in self.documents.iter_mut().enumerate() {
                doc.position = i as i32;
            }
            self.updated_at = chrono::Utc::now().to_rfc3339();
            true
        } else {
            false
        }
    }

    /// Update the last accessed timestamp
    pub fn touch(&mut self) {
        let now = chrono::Utc::now().to_rfc3339();
        self.last_accessed_at = now;
    }
}

/// A document within a reading session with saved position
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionDocument {
    pub document_id: String,
    pub position: i32,
    pub current_page: i32,
    pub scroll_position: f64,
    pub created_at: String,
    /// Denormalized for display
    pub title: Option<String>,
    pub page_count: Option<i32>,
}

impl SessionDocument {
    /// Update the reading position
    pub fn update_position(&mut self, current_page: Option<i32>, scroll_position: Option<f64>) {
        if let Some(page) = current_page {
            self.current_page = page;
        }
        if let Some(scroll) = scroll_position {
            self.scroll_position = scroll;
        }
    }
}

/// Summary of a session for list display
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub name: String,
    pub document_count: i32,
    pub last_accessed_at: String,
    pub created_at: String,
}

impl From<&ReadingSession> for SessionSummary {
    fn from(session: &ReadingSession) -> Self {
        Self {
            id: session.id.clone(),
            name: session.name.clone(),
            document_count: session.documents.len() as i32,
            last_accessed_at: session.last_accessed_at.clone(),
            created_at: session.created_at.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_session() {
        let session = ReadingSession::new("test-id".to_string(), "My Session".to_string());
        assert_eq!(session.id, "test-id");
        assert_eq!(session.name, "My Session");
        assert!(session.documents.is_empty());
    }

    #[test]
    fn test_validate_empty_name() {
        let session = ReadingSession::new("id".to_string(), "".to_string());
        assert!(session.validate().is_err());
    }

    #[test]
    fn test_validate_whitespace_name() {
        let session = ReadingSession::new("id".to_string(), "   ".to_string());
        assert!(session.validate().is_err());
    }

    #[test]
    fn test_validate_name_too_long() {
        let long_name = "a".repeat(SESSION_NAME_MAX_LENGTH + 1);
        let session = ReadingSession::new("id".to_string(), long_name);
        assert!(session.validate().is_err());
    }

    #[test]
    fn test_validate_valid_session() {
        let session = ReadingSession::new("id".to_string(), "Valid Name".to_string());
        assert!(session.validate().is_ok());
    }

    #[test]
    fn test_add_document() {
        let mut session = ReadingSession::new("id".to_string(), "Test".to_string());
        session.add_document("doc1".to_string(), None);
        session.add_document("doc2".to_string(), None);

        assert_eq!(session.documents.len(), 2);
        assert_eq!(session.documents[0].document_id, "doc1");
        assert_eq!(session.documents[0].position, 0);
        assert_eq!(session.documents[1].document_id, "doc2");
        assert_eq!(session.documents[1].position, 1);
    }

    #[test]
    fn test_add_document_at_position() {
        let mut session = ReadingSession::new("id".to_string(), "Test".to_string());
        session.add_document("doc1".to_string(), None);
        session.add_document("doc2".to_string(), None);
        session.add_document("doc3".to_string(), Some(1)); // Insert at position 1

        assert_eq!(session.documents.len(), 3);
        assert_eq!(session.documents[0].document_id, "doc1");
        assert_eq!(session.documents[1].document_id, "doc3");
        assert_eq!(session.documents[2].document_id, "doc2");
    }

    #[test]
    fn test_remove_document() {
        let mut session = ReadingSession::new("id".to_string(), "Test".to_string());
        session.add_document("doc1".to_string(), None);
        session.add_document("doc2".to_string(), None);
        session.add_document("doc3".to_string(), None);

        let removed = session.remove_document("doc2");
        assert!(removed);
        assert_eq!(session.documents.len(), 2);
        assert_eq!(session.documents[0].document_id, "doc1");
        assert_eq!(session.documents[0].position, 0);
        assert_eq!(session.documents[1].document_id, "doc3");
        assert_eq!(session.documents[1].position, 1);
    }

    #[test]
    fn test_remove_nonexistent_document() {
        let mut session = ReadingSession::new("id".to_string(), "Test".to_string());
        session.add_document("doc1".to_string(), None);

        let removed = session.remove_document("nonexistent");
        assert!(!removed);
        assert_eq!(session.documents.len(), 1);
    }

    #[test]
    fn test_session_summary() {
        let mut session = ReadingSession::new("id".to_string(), "Test".to_string());
        session.add_document("doc1".to_string(), None);
        session.add_document("doc2".to_string(), None);

        let summary = SessionSummary::from(&session);
        assert_eq!(summary.id, "id");
        assert_eq!(summary.name, "Test");
        assert_eq!(summary.document_count, 2);
    }

    #[test]
    fn test_validate_too_many_documents() {
        let mut session = ReadingSession::new("id".to_string(), "Test".to_string());
        for i in 0..=MAX_DOCUMENTS_PER_SESSION {
            session.documents.push(SessionDocument {
                document_id: format!("doc{}", i),
                position: i as i32,
                current_page: 1,
                scroll_position: 0.0,
                created_at: "2024-01-01T00:00:00Z".to_string(),
                title: None,
                page_count: None,
            });
        }
        assert!(session.validate().is_err());
    }
}
