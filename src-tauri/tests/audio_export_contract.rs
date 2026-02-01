//! Audio Export Contract Tests
//!
//! These tests verify that the AudioExportService contracts are stable
//! across the hexagonal architecture layers. They ensure:
//! 1. Readiness checking returns correct status
//! 2. Export validation works correctly
//! 3. Cancellation works properly
//! 4. Serialization is consistent for IPC

use std::sync::Arc;

use tauri_pdf_reader_lib::{
    application::AudioExportServiceImpl,
    domain::cache::{AudioCacheEntry, CoverageStats, PageCoverageStats},
    domain::errors::ExportError,
    domain::export::{
        ExportOptions, ExportProgress, ExportReadiness, ExportResult, MissingChunkInfo,
    },
    ports::{audio_export_service::AudioExportService, MockAudioCacheRepository},
};

fn make_test_entry(doc_id: &str, page: i32, chunk: i32, duration_ms: i64) -> AudioCacheEntry {
    AudioCacheEntry::new(
        format!("cache-{}-{}-{}", doc_id, page, chunk),
        Some(doc_id.to_string()),
        Some(page),
        Some(chunk),
        Some(5),
        format!("hash-{}-{}", page, chunk),
        "voice-123".to_string(),
        "settings-hash".to_string(),
        format!("/cache/{}-{}-{}.mp3", doc_id, page, chunk),
        1024,
        duration_ms,
    )
}

/// Contract: audio_export_check_ready returns readiness status
#[tokio::test]
async fn contract_check_ready_returns_readiness() {
    let mut mock = MockAudioCacheRepository::new();

    // Full coverage
    mock.expect_get_coverage().returning(|_, _| {
        let mut stats = CoverageStats::empty("doc-1".to_string());
        stats.update(10, 10, 60000, 10240);
        Ok(stats)
    });

    mock.expect_list_for_document().returning(|_| {
        Ok(vec![
            make_test_entry("doc-1", 1, 0, 5000),
            make_test_entry("doc-1", 1, 1, 5000),
            make_test_entry("doc-1", 2, 0, 5000),
        ])
    });

    let service = AudioExportServiceImpl::new(Arc::new(mock));
    let result = service.check_readiness("doc-1", None).await.unwrap();

    assert!(result.ready);
    assert_eq!(result.coverage_percent, 100.0);
    assert!(result.estimated_duration_ms > 0);
    assert!(result.estimated_file_size_bytes > 0);
}

/// Contract: audio_export_check_ready reports missing chunks when not ready
#[tokio::test]
async fn contract_check_ready_reports_missing_chunks() {
    let mut mock = MockAudioCacheRepository::new();

    // Partial coverage with page stats
    mock.expect_get_coverage().returning(|doc_id, _| {
        let mut stats = CoverageStats::empty(doc_id.to_string());
        stats.total_chunks = 10;
        stats.cached_chunks = 5;
        stats.coverage_percent = 50.0;
        stats.page_stats = Some(vec![
            PageCoverageStats::new(1, 5, 3, 15000), // Missing chunks 3, 4
            PageCoverageStats::new(2, 5, 2, 10000), // Missing chunks 2, 3, 4
        ]);
        Ok(stats)
    });

    mock.expect_list_for_document().returning(|_| {
        Ok(vec![
            make_test_entry("doc-1", 1, 0, 5000),
            make_test_entry("doc-1", 1, 1, 5000),
            make_test_entry("doc-1", 1, 2, 5000),
            make_test_entry("doc-1", 2, 0, 5000),
            make_test_entry("doc-1", 2, 1, 5000),
        ])
    });

    let service = AudioExportServiceImpl::new(Arc::new(mock));
    let result = service.check_readiness("doc-1", None).await.unwrap();

    assert!(!result.ready);
    assert!(result.coverage_percent < 100.0);
    assert!(!result.missing_chunks.is_empty());
}

/// Contract: audio_export_document fails when no cache entries exist
#[tokio::test]
async fn contract_export_fails_when_no_entries() {
    let mut mock = MockAudioCacheRepository::new();
    mock.expect_list_for_document().returning(|_| Ok(vec![]));

    let service = AudioExportServiceImpl::new(Arc::new(mock));
    let options = ExportOptions::new(
        "doc-1".to_string(),
        "mp3".to_string(),
        "/tmp/test-export.mp3".to_string(),
    );

    let result = service.export(options, None).await;

    assert!(result.is_err());
    match result.unwrap_err() {
        ExportError::NotReady(msg) => assert!(msg.contains("No cached audio")),
        _ => panic!("Expected NotReady error"),
    }
}

/// Contract: audio_export_cancel signals cancellation
#[tokio::test]
async fn contract_cancel_returns_status() {
    let mock = MockAudioCacheRepository::new();
    let service = AudioExportServiceImpl::new(Arc::new(mock));

    // First cancel returns true (was running/not cancelled)
    let result1 = service.cancel();
    assert!(result1);

    // Second cancel returns false (already cancelled)
    let result2 = service.cancel();
    assert!(!result2);
}

/// Contract: ExportOptions validation rejects empty document_id
#[test]
fn contract_export_options_validates_document_id() {
    let options = ExportOptions::new(
        "".to_string(), // Empty document ID
        "mp3".to_string(),
        "/tmp/test.mp3".to_string(),
    );

    let result = options.validate();
    assert!(result.is_err());
}

/// Contract: ExportOptions validation rejects empty output_path
#[test]
fn contract_export_options_validates_output_path() {
    let options = ExportOptions::new(
        "doc-1".to_string(),
        "mp3".to_string(),
        "".to_string(), // Empty path
    );

    let result = options.validate();
    assert!(result.is_err());
}

/// Contract: ExportReadiness serialization is camelCase for IPC
#[test]
fn contract_export_readiness_serialization() {
    let readiness = ExportReadiness {
        ready: true,
        coverage_percent: 100.0,
        missing_chunks: vec![],
        estimated_duration_ms: 60000,
        estimated_file_size_bytes: 1024000,
    };

    let json = serde_json::to_string(&readiness).unwrap();

    assert!(json.contains("\"ready\""));
    assert!(json.contains("\"coveragePercent\""));
    assert!(json.contains("\"missingChunks\""));
    assert!(json.contains("\"estimatedDurationMs\""));
    assert!(json.contains("\"estimatedFileSizeBytes\""));
}

/// Contract: MissingChunkInfo serialization is camelCase for IPC
#[test]
fn contract_missing_chunk_info_serialization() {
    let info = MissingChunkInfo {
        page_number: 5,
        chunk_index: 2,
        text_preview: "Sample text preview...".to_string(),
    };

    let json = serde_json::to_string(&info).unwrap();

    assert!(json.contains("\"pageNumber\""));
    assert!(json.contains("\"chunkIndex\""));
    assert!(json.contains("\"textPreview\""));
}

/// Contract: ExportProgress serialization is camelCase for IPC
#[test]
fn contract_export_progress_serialization() {
    let progress = ExportProgress::new(ExportProgress::PHASE_CONCATENATING, 50, 100, 30000);

    let json = serde_json::to_string(&progress).unwrap();

    assert!(json.contains("\"phase\""));
    assert!(json.contains("\"currentChunk\""));
    assert!(json.contains("\"totalChunks\""));
    assert!(json.contains("\"estimatedRemainingMs\""));
    assert!(json.contains("\"percent\"")); // Field is 'percent', not 'percentComplete'
}

/// Contract: ExportResult serialization is camelCase for IPC
#[test]
fn contract_export_result_serialization() {
    let result = ExportResult::success(
        "/tmp/output.mp3".to_string(),
        "mp3".to_string(),
        60000,
        10,
        1024000,
    );

    let json = serde_json::to_string(&result).unwrap();

    assert!(json.contains("\"success\""));
    assert!(json.contains("\"outputPath\""));
    assert!(json.contains("\"format\""));
    assert!(json.contains("\"totalDurationMs\"")); // Field is 'totalDurationMs'
    assert!(json.contains("\"chapterCount\""));
    assert!(json.contains("\"fileSizeBytes\""));
}

/// Contract: ExportOptions chapter strategies are valid constants
#[test]
fn contract_export_options_chapter_strategies() {
    // These should be valid strategies
    assert_eq!(ExportOptions::CHAPTER_STRATEGY_PAGE, "page");
    assert_eq!(ExportOptions::CHAPTER_STRATEGY_DOCUMENT, "document");

    // Default options should have valid strategy
    let options = ExportOptions::new(
        "doc-1".to_string(),
        "mp3".to_string(),
        "/tmp/test.mp3".to_string(),
    );
    assert!(
        options.chapter_strategy == ExportOptions::CHAPTER_STRATEGY_PAGE
            || options.chapter_strategy == ExportOptions::CHAPTER_STRATEGY_DOCUMENT
    );
}

/// Contract: ExportReadiness::ready creates proper ready state
#[test]
fn contract_export_readiness_ready_constructor() {
    let readiness = ExportReadiness::ready(60000, 1024000);

    assert!(readiness.ready);
    assert_eq!(readiness.coverage_percent, 100.0);
    assert!(readiness.missing_chunks.is_empty());
    assert_eq!(readiness.estimated_duration_ms, 60000);
    assert_eq!(readiness.estimated_file_size_bytes, 1024000);
}

/// Contract: ExportReadiness::not_ready creates proper not-ready state
#[test]
fn contract_export_readiness_not_ready_constructor() {
    let missing = vec![MissingChunkInfo {
        page_number: 1,
        chunk_index: 2,
        text_preview: "preview".to_string(),
    }];

    let readiness = ExportReadiness::not_ready(50.0, missing.clone(), 30000, 512000);

    assert!(!readiness.ready);
    assert_eq!(readiness.coverage_percent, 50.0);
    assert_eq!(readiness.missing_chunks.len(), 1);
    assert_eq!(readiness.estimated_duration_ms, 30000);
    assert_eq!(readiness.estimated_file_size_bytes, 512000);
}
