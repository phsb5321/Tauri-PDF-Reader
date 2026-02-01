//! Session Contract Tests
//!
//! These tests verify that the SessionService contracts are stable
//! across the hexagonal architecture layers. They ensure:
//! 1. Session CRUD operations work correctly
//! 2. Validation rules are enforced
//! 3. Serialization is consistent for IPC

use tauri_pdf_reader_lib::{
    application::SessionService,
    domain::errors::RepositoryError,
    domain::sessions::{ReadingSession, SessionDocument},
    ports::{
        session_repository::{
            CreateSessionInput, SessionRestoreResponse, SessionSummary, UpdateSessionInput,
        },
        MockSessionRepository,
    },
};

fn make_test_session(id: &str, name: &str) -> ReadingSession {
    ReadingSession {
        id: id.to_string(),
        name: name.to_string(),
        documents: vec![
            SessionDocument {
                document_id: "doc-1".to_string(),
                position: 0,
                current_page: 5,
                scroll_position: 0.25,
                created_at: "2024-01-01T00:00:00Z".to_string(),
                title: Some("First Document".to_string()),
                page_count: Some(100),
            },
            SessionDocument {
                document_id: "doc-2".to_string(),
                position: 1,
                current_page: 1,
                scroll_position: 0.0,
                created_at: "2024-01-01T00:00:00Z".to_string(),
                title: Some("Second Document".to_string()),
                page_count: Some(50),
            },
        ],
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-15T12:00:00Z".to_string(),
        last_accessed_at: "2024-01-15T12:00:00Z".to_string(),
    }
}

/// Contract: session_create validates name and returns session
#[tokio::test]
async fn contract_create_returns_session() {
    use mockall::predicate::*;

    let mut mock = MockSessionRepository::new();
    mock.expect_create().times(1).returning(|input| {
        Ok(ReadingSession {
            id: "new-session-id".to_string(),
            name: input.name,
            documents: vec![],
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            last_accessed_at: "2024-01-01T00:00:00Z".to_string(),
        })
    });

    let service = SessionService::new(mock);
    let input = CreateSessionInput {
        name: "My Reading List".to_string(),
        document_ids: vec!["doc-1".to_string()],
    };

    let result = service.create(input).await.unwrap();

    assert_eq!(result.name, "My Reading List");
    assert!(!result.id.is_empty());
}

/// Contract: session_create rejects empty name
#[tokio::test]
async fn contract_create_rejects_empty_name() {
    let mock = MockSessionRepository::new();
    // No expectations - repository should never be called

    let service = SessionService::new(mock);
    let input = CreateSessionInput {
        name: "".to_string(),
        document_ids: vec![],
    };

    let result = service.create(input).await;

    assert!(result.is_err());
    match result.unwrap_err() {
        RepositoryError::ValidationError(msg) => assert!(msg.contains("empty")),
        _ => panic!("Expected ValidationError"),
    }
}

/// Contract: session_create rejects whitespace-only name
#[tokio::test]
async fn contract_create_rejects_whitespace_name() {
    let mock = MockSessionRepository::new();

    let service = SessionService::new(mock);
    let input = CreateSessionInput {
        name: "   \t\n  ".to_string(),
        document_ids: vec![],
    };

    let result = service.create(input).await;

    assert!(result.is_err());
}

/// Contract: session_get returns session or None
#[tokio::test]
async fn contract_get_returns_session() {
    use mockall::predicate::*;

    let mut mock = MockSessionRepository::new();
    let session = make_test_session("session-123", "Test Session");
    let session_clone = session.clone();

    mock.expect_get()
        .with(eq("session-123"))
        .times(1)
        .returning(move |_| Ok(Some(session_clone.clone())));

    let service = SessionService::new(mock);
    let result = service.get("session-123").await.unwrap();

    assert!(result.is_some());
    let session = result.unwrap();
    assert_eq!(session.id, "session-123");
    assert_eq!(session.documents.len(), 2);
}

/// Contract: session_get returns None for missing session
#[tokio::test]
async fn contract_get_returns_none_for_missing() {
    use mockall::predicate::*;

    let mut mock = MockSessionRepository::new();
    mock.expect_get()
        .with(eq("missing-id"))
        .times(1)
        .returning(|_| Ok(None));

    let service = SessionService::new(mock);
    let result = service.get("missing-id").await.unwrap();

    assert!(result.is_none());
}

/// Contract: session_list returns all sessions
#[tokio::test]
async fn contract_list_returns_summaries() {
    let mut mock = MockSessionRepository::new();
    mock.expect_list().times(1).returning(|| {
        Ok(vec![
            SessionSummary {
                id: "session-1".to_string(),
                name: "First".to_string(),
                document_count: 3,
                last_accessed_at: "2024-01-15".to_string(),
                created_at: "2024-01-01".to_string(),
            },
            SessionSummary {
                id: "session-2".to_string(),
                name: "Second".to_string(),
                document_count: 1,
                last_accessed_at: "2024-01-10".to_string(),
                created_at: "2024-01-05".to_string(),
            },
        ])
    });

    let service = SessionService::new(mock);
    let result = service.list().await.unwrap();

    assert_eq!(result.len(), 2);
    assert_eq!(result[0].name, "First");
    assert_eq!(result[0].document_count, 3);
}

/// Contract: session_update validates name and returns updated session
#[tokio::test]
async fn contract_update_returns_session() {
    use mockall::predicate::*;

    let mut mock = MockSessionRepository::new();
    mock.expect_update()
        .with(eq("session-1"), always())
        .times(1)
        .returning(|_, input| {
            Ok(ReadingSession {
                id: "session-1".to_string(),
                name: input.name.unwrap_or_else(|| "Original".to_string()),
                documents: vec![],
                created_at: "2024-01-01".to_string(),
                updated_at: "2024-01-15".to_string(),
                last_accessed_at: "2024-01-15".to_string(),
            })
        });

    let service = SessionService::new(mock);
    let input = UpdateSessionInput {
        name: Some("Updated Name".to_string()),
        document_ids: None,
    };

    let result = service.update("session-1", input).await.unwrap();

    assert_eq!(result.name, "Updated Name");
}

/// Contract: session_update rejects empty name
#[tokio::test]
async fn contract_update_rejects_empty_name() {
    let mock = MockSessionRepository::new();

    let service = SessionService::new(mock);
    let input = UpdateSessionInput {
        name: Some("".to_string()),
        document_ids: None,
    };

    let result = service.update("session-1", input).await;

    assert!(result.is_err());
}

/// Contract: session_delete removes session
#[tokio::test]
async fn contract_delete_removes_session() {
    use mockall::predicate::*;

    let mut mock = MockSessionRepository::new();
    mock.expect_delete()
        .with(eq("session-to-delete"))
        .times(1)
        .returning(|_| Ok(()));

    let service = SessionService::new(mock);
    let result = service.delete("session-to-delete").await;

    assert!(result.is_ok());
}

/// Contract: session_restore returns session with missing docs info
#[tokio::test]
async fn contract_restore_returns_response() {
    use mockall::predicate::*;

    let mut mock = MockSessionRepository::new();
    let session = make_test_session("session-1", "Restore Me");
    let session_clone = session.clone();

    mock.expect_get()
        .with(eq("session-1"))
        .times(1)
        .returning(move |_| Ok(Some(session_clone.clone())));

    mock.expect_touch()
        .with(eq("session-1"))
        .times(1)
        .returning(|_| Ok(()));

    let service = SessionService::new(mock);
    let result = service.restore("session-1").await.unwrap();

    assert!(result.success);
    assert_eq!(result.session.name, "Restore Me");
    assert_eq!(result.session.documents.len(), 2);
}

/// Contract: session_restore fails for missing session
#[tokio::test]
async fn contract_restore_fails_for_missing() {
    use mockall::predicate::*;

    let mut mock = MockSessionRepository::new();
    mock.expect_get()
        .with(eq("missing-session"))
        .times(1)
        .returning(|_| Ok(None));

    let service = SessionService::new(mock);
    let result = service.restore("missing-session").await;

    assert!(result.is_err());
    match result.unwrap_err() {
        RepositoryError::NotFound(msg) => assert!(msg.contains("not found")),
        _ => panic!("Expected NotFound error"),
    }
}

/// Contract: ReadingSession serialization is camelCase for IPC
#[test]
fn contract_reading_session_serialization() {
    let session = make_test_session("test-id", "Test");

    let json = serde_json::to_string(&session).unwrap();

    // Verify camelCase field names
    assert!(json.contains("\"createdAt\""));
    assert!(json.contains("\"updatedAt\""));
    assert!(json.contains("\"lastAccessedAt\""));
    assert!(json.contains("\"documentId\""));
    assert!(json.contains("\"currentPage\""));
    assert!(json.contains("\"scrollPosition\""));
    assert!(json.contains("\"pageCount\""));
}

/// Contract: SessionSummary serialization is camelCase for IPC
#[test]
fn contract_session_summary_serialization() {
    let summary = SessionSummary {
        id: "id-1".to_string(),
        name: "Test".to_string(),
        document_count: 5,
        last_accessed_at: "2024-01-01".to_string(),
        created_at: "2024-01-01".to_string(),
    };

    let json = serde_json::to_string(&summary).unwrap();

    assert!(json.contains("\"documentCount\""));
    assert!(json.contains("\"lastAccessedAt\""));
    assert!(json.contains("\"createdAt\""));
}

/// Contract: SessionRestoreResponse serialization is camelCase for IPC
#[test]
fn contract_restore_response_serialization() {
    let response = SessionRestoreResponse {
        success: true,
        session: make_test_session("id", "Test"),
        missing_documents: vec!["doc-missing".to_string()],
    };

    let json = serde_json::to_string(&response).unwrap();

    assert!(json.contains("\"success\""));
    assert!(json.contains("\"session\""));
    assert!(json.contains("\"missingDocuments\""));
}
