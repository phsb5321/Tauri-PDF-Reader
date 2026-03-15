//! Audio Cache Contract Tests
//!
//! These tests verify that the AudioCacheService contracts are stable
//! across the hexagonal architecture layers. They ensure:
//! 1. Service behavior matches expected API contracts
//! 2. Error handling is consistent
//! 3. Auto-eviction triggers correctly

use tauri_pdf_reader_lib::{
    application::AudioCacheService,
    domain::cache::{AudioCacheEntry, CoverageStats},
    domain::errors::RepositoryError,
    ports::{
        audio_cache_repository::{CacheStats, EvictionResult},
        MockAudioCacheRepository,
    },
};

fn make_test_entry(cache_key: &str, document_id: &str) -> AudioCacheEntry {
    AudioCacheEntry::new(
        cache_key.to_string(),
        Some(document_id.to_string()),
        Some(1),
        Some(0),
        Some(10),
        "text-hash".to_string(),
        "voice-123".to_string(),
        "settings-hash".to_string(),
        format!("/cache/{}.mp3", cache_key),
        1024,
        5000,
    )
}

/// Contract: get_coverage returns CoverageStats for a document
#[tokio::test]
async fn contract_get_coverage_returns_stats() {
    use mockall::predicate::*;

    let mut mock = MockAudioCacheRepository::new();
    mock.expect_get_coverage()
        .with(eq("doc-123"), eq(false))
        .times(1)
        .returning(|doc_id, _| {
            let mut stats = CoverageStats::empty(doc_id.to_string());
            stats.update(100, 75, 300000, 1024000);
            Ok(stats)
        });

    let service = AudioCacheService::new(mock);
    let result = service.get_coverage("doc-123", false).await.unwrap();

    assert_eq!(result.document_id, "doc-123");
    assert_eq!(result.total_chunks, 100);
    assert_eq!(result.cached_chunks, 75);
    assert_eq!(result.coverage_percent, 75.0);
}

/// Contract: clear_document removes all entries and returns count
#[tokio::test]
async fn contract_clear_document_returns_count() {
    use mockall::predicate::*;

    let mut mock = MockAudioCacheRepository::new();
    mock.expect_delete_for_document()
        .with(eq("doc-456"))
        .times(1)
        .returning(|_| Ok(15));

    let service = AudioCacheService::new(mock);
    let result = service.clear_document("doc-456").await.unwrap();

    assert_eq!(result, 15);
}

/// Contract: get_stats returns overall cache statistics
#[tokio::test]
async fn contract_get_stats_returns_cache_overview() {
    let mut mock = MockAudioCacheRepository::new();
    mock.expect_get_stats().times(1).returning(|| {
        Ok(CacheStats {
            total_size_bytes: 500_000_000,
            entry_count: 150,
            max_size_bytes: 1_000_000_000,
            oldest_entry_at: Some("2024-01-01T00:00:00Z".to_string()),
            newest_entry_at: Some("2024-06-15T12:30:00Z".to_string()),
            document_count: 10,
        })
    });

    let service = AudioCacheService::new(mock);
    let result = service.get_stats().await.unwrap();

    assert_eq!(result.total_size_bytes, 500_000_000);
    assert_eq!(result.entry_count, 150);
    assert_eq!(result.max_size_bytes, 1_000_000_000);
    assert_eq!(result.document_count, 10);
}

/// Contract: set_size_limit persists limit and triggers eviction if over
#[tokio::test]
async fn contract_set_limit_triggers_eviction_when_over() {
    use mockall::predicate::*;

    let mut mock = MockAudioCacheRepository::new();

    // First: set the limit
    mock.expect_set_size_limit()
        .with(eq(500_000_000i64))
        .times(1)
        .returning(|_| Ok(()));

    // Second: check stats (returns over limit)
    mock.expect_get_stats().times(1).returning(|| {
        Ok(CacheStats {
            total_size_bytes: 800_000_000, // Over the new 500MB limit
            entry_count: 200,
            max_size_bytes: 500_000_000,
            oldest_entry_at: None,
            newest_entry_at: None,
            document_count: 15,
        })
    });

    // Third: eviction should be triggered (target = 90% of limit = 450MB)
    mock.expect_evict_lru()
        .with(eq(450_000_000i64))
        .times(1)
        .returning(|_| {
            Ok(EvictionResult {
                evicted_count: 50,
                bytes_freed: 350_000_000,
            })
        });

    let service = AudioCacheService::new(mock);
    let result = service.set_size_limit(500_000_000).await;

    assert!(result.is_ok());
}

/// Contract: set_size_limit does not evict when under limit
#[tokio::test]
async fn contract_set_limit_no_eviction_when_under() {
    use mockall::predicate::*;

    let mut mock = MockAudioCacheRepository::new();

    mock.expect_set_size_limit()
        .with(eq(1_000_000_000i64))
        .times(1)
        .returning(|_| Ok(()));

    mock.expect_get_stats().times(1).returning(|| {
        Ok(CacheStats {
            total_size_bytes: 500_000_000, // Under the 1GB limit
            entry_count: 100,
            max_size_bytes: 1_000_000_000,
            oldest_entry_at: None,
            newest_entry_at: None,
            document_count: 5,
        })
    });

    // No eviction expected - test will fail if evict_lru is called

    let service = AudioCacheService::new(mock);
    let result = service.set_size_limit(1_000_000_000).await;

    assert!(result.is_ok());
}

/// Contract: evict removes entries and returns freed bytes
#[tokio::test]
async fn contract_evict_returns_result() {
    use mockall::predicate::*;

    let mut mock = MockAudioCacheRepository::new();
    mock.expect_evict_lru()
        .with(eq(500_000_000i64))
        .times(1)
        .returning(|_| {
            Ok(EvictionResult {
                evicted_count: 25,
                bytes_freed: 250_000_000,
            })
        });

    let service = AudioCacheService::new(mock);
    let result = service.evict(500_000_000).await.unwrap();

    assert_eq!(result.evicted_count, 25);
    assert_eq!(result.bytes_freed, 250_000_000);
}

/// Contract: store auto-evicts when over limit after storage
#[tokio::test]
async fn contract_store_auto_evicts_when_over_limit() {
    let mut mock = MockAudioCacheRepository::new();
    let entry = make_test_entry("test-key", "doc-1");

    // Store succeeds
    mock.expect_store().times(1).returning(|_, _| Ok(()));

    // Stats show we're over limit after store
    mock.expect_get_stats().times(1).returning(|| {
        Ok(CacheStats {
            total_size_bytes: 1_100_000_000, // 100MB over 1GB limit
            entry_count: 100,
            max_size_bytes: 1_000_000_000,
            oldest_entry_at: None,
            newest_entry_at: None,
            document_count: 5,
        })
    });

    // Auto-eviction to 90% of limit = 900MB
    mock.expect_evict_lru().times(1).returning(|_| {
        Ok(EvictionResult {
            evicted_count: 10,
            bytes_freed: 200_000_000,
        })
    });

    let service = AudioCacheService::new(mock);
    let result = service.store(entry, vec![1, 2, 3, 4]).await;

    assert!(result.is_ok());
}

/// Contract: get_size_limit returns current limit from repository
#[tokio::test]
async fn contract_get_size_limit_returns_current() {
    let mut mock = MockAudioCacheRepository::new();
    mock.expect_get_size_limit()
        .times(1)
        .returning(|| Ok(2_000_000_000));

    let service = AudioCacheService::new(mock);
    let result = service.get_size_limit().await.unwrap();

    assert_eq!(result, 2_000_000_000);
}

/// Contract: Repository errors propagate correctly
#[tokio::test]
async fn contract_repository_errors_propagate() {
    let mut mock = MockAudioCacheRepository::new();
    mock.expect_get_coverage()
        .times(1)
        .returning(|_, _| Err(RepositoryError::NotFound("Document not found".to_string())));

    let service = AudioCacheService::new(mock);
    let result = service.get_coverage("missing-doc", false).await;

    assert!(result.is_err());
    match result.unwrap_err() {
        RepositoryError::NotFound(msg) => assert!(msg.contains("not found")),
        _ => panic!("Expected NotFound error"),
    }
}

/// Contract: CoverageStats serialization is camelCase for IPC
#[test]
fn contract_coverage_stats_serialization() {
    let mut stats = CoverageStats::empty("doc-1".to_string());
    stats.update(100, 50, 60000, 1024);

    let json = serde_json::to_string(&stats).unwrap();

    // Verify camelCase field names
    assert!(json.contains("\"documentId\""));
    assert!(json.contains("\"totalChunks\""));
    assert!(json.contains("\"cachedChunks\""));
    assert!(json.contains("\"coveragePercent\""));
    assert!(json.contains("\"totalDurationMs\""));
    assert!(json.contains("\"cachedSizeBytes\""));
    assert!(json.contains("\"lastUpdated\""));
}

/// Contract: CacheStats serialization is camelCase for IPC
#[test]
fn contract_cache_stats_serialization() {
    let stats = CacheStats {
        total_size_bytes: 1000,
        entry_count: 10,
        max_size_bytes: 2000,
        oldest_entry_at: Some("2024-01-01".to_string()),
        newest_entry_at: Some("2024-06-01".to_string()),
        document_count: 5,
    };

    let json = serde_json::to_string(&stats).unwrap();

    // Verify camelCase field names
    assert!(json.contains("\"totalSizeBytes\""));
    assert!(json.contains("\"entryCount\""));
    assert!(json.contains("\"maxSizeBytes\""));
    assert!(json.contains("\"oldestEntryAt\""));
    assert!(json.contains("\"newestEntryAt\""));
    assert!(json.contains("\"documentCount\""));
}

/// Contract: EvictionResult serialization is camelCase for IPC
#[test]
fn contract_eviction_result_serialization() {
    let result = EvictionResult {
        evicted_count: 10,
        bytes_freed: 1000000,
    };

    let json = serde_json::to_string(&result).unwrap();

    assert!(json.contains("\"evictedCount\""));
    assert!(json.contains("\"bytesFreed\""));
}
