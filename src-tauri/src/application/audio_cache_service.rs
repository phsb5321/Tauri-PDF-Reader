//! Audio Cache Application Service
//!
//! Provides use cases for managing TTS audio cache.
//! Orchestrates cache operations with automatic eviction on size limit.

use crate::domain::cache::{AudioCacheEntry, CoverageStats};
use crate::domain::errors::RepositoryError;
use crate::ports::audio_cache_repository::{
    AudioCacheRepository, CacheStats, CachedAudioData, EvictionResult,
};

/// Application service for managing audio cache.
///
/// This service:
/// - Checks cache before TTS API calls
/// - Stores audio with automatic eviction on limit exceeded
/// - Provides coverage statistics for documents
/// - Manages cache size limits
pub struct AudioCacheService<R: AudioCacheRepository> {
    repository: R,
}

impl<R: AudioCacheRepository> AudioCacheService<R> {
    /// Create a new AudioCacheService with the given repository.
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    /// Check if audio is cached and return it if available.
    /// Updates last_accessed_at on cache hit.
    pub async fn get(&self, cache_key: &str) -> Result<Option<CachedAudioData>, RepositoryError> {
        self.repository.get(cache_key).await
    }

    /// Check if audio is cached and return it if available, with text hash validation.
    ///
    /// If the cached entry's text_hash doesn't match the expected hash, the entry
    /// is considered stale (the underlying text has changed) and will be invalidated
    /// (deleted). Returns None in this case, treating it as a cache miss.
    ///
    /// This implements FR-005: hash-based cache invalidation.
    pub async fn get_with_validation(
        &self,
        cache_key: &str,
        expected_text_hash: &str,
    ) -> Result<Option<CachedAudioData>, RepositoryError> {
        match self.repository.get(cache_key).await? {
            Some(cached) => {
                if cached.entry.text_hash == expected_text_hash {
                    Ok(Some(cached))
                } else {
                    // Text changed - invalidate cache entry
                    tracing::info!(
                        "Cache invalidation: text hash mismatch for key {} (expected: {}, got: {})",
                        cache_key,
                        expected_text_hash,
                        cached.entry.text_hash
                    );
                    self.repository.delete(cache_key).await?;
                    Ok(None)
                }
            }
            None => Ok(None),
        }
    }

    /// Check if a cache entry exists without retrieving the data.
    pub async fn exists(&self, cache_key: &str) -> Result<bool, RepositoryError> {
        self.repository.exists(cache_key).await
    }

    /// Store audio data with metadata.
    /// Automatically triggers eviction if cache exceeds size limit.
    pub async fn store(
        &self,
        entry: AudioCacheEntry,
        audio_data: Vec<u8>,
    ) -> Result<(), RepositoryError> {
        // Store the entry first
        self.repository.store(entry, audio_data).await?;

        // Check if we need to evict
        let stats = self.repository.get_stats().await?;
        if stats.total_size_bytes > stats.max_size_bytes {
            let target = (stats.max_size_bytes as f64 * 0.9) as i64; // Evict to 90% of limit
            let _ = self.repository.evict_lru(target).await;
            tracing::info!(
                "Auto-eviction triggered: {} bytes over limit",
                stats.total_size_bytes - stats.max_size_bytes
            );
        }

        Ok(())
    }

    /// Delete a specific cache entry.
    pub async fn delete(&self, cache_key: &str) -> Result<(), RepositoryError> {
        self.repository.delete(cache_key).await
    }

    /// Get coverage statistics for a document.
    pub async fn get_coverage(
        &self,
        document_id: &str,
        include_page_stats: bool,
    ) -> Result<CoverageStats, RepositoryError> {
        self.repository
            .get_coverage(document_id, include_page_stats)
            .await
    }

    /// List all cache entries for a document.
    pub async fn list_for_document(
        &self,
        document_id: &str,
    ) -> Result<Vec<AudioCacheEntry>, RepositoryError> {
        self.repository.list_for_document(document_id).await
    }

    /// Clear all cache entries for a document.
    pub async fn clear_document(&self, document_id: &str) -> Result<i64, RepositoryError> {
        self.repository.delete_for_document(document_id).await
    }

    /// Get overall cache statistics.
    pub async fn get_stats(&self) -> Result<CacheStats, RepositoryError> {
        self.repository.get_stats().await
    }

    /// Manually trigger LRU eviction to target size.
    pub async fn evict(&self, target_size_bytes: i64) -> Result<EvictionResult, RepositoryError> {
        self.repository.evict_lru(target_size_bytes).await
    }

    /// Get current cache size limit.
    pub async fn get_size_limit(&self) -> Result<i64, RepositoryError> {
        self.repository.get_size_limit().await
    }

    /// Set cache size limit.
    /// Triggers eviction if current size exceeds new limit.
    pub async fn set_size_limit(&self, max_size_bytes: i64) -> Result<(), RepositoryError> {
        self.repository.set_size_limit(max_size_bytes).await?;

        // Check if we need to evict after setting new limit
        let stats = self.repository.get_stats().await?;
        if stats.total_size_bytes > max_size_bytes {
            let target = (max_size_bytes as f64 * 0.9) as i64;
            let result = self.repository.evict_lru(target).await?;
            tracing::info!(
                "Eviction after limit change: freed {} bytes, {} entries",
                result.bytes_freed,
                result.evicted_count
            );
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ports::MockAudioCacheRepository;
    use mockall::predicate::*;

    fn make_test_entry() -> AudioCacheEntry {
        AudioCacheEntry::new(
            "a".repeat(64),
            Some("doc-1".to_string()),
            Some(1),
            Some(0),
            Some(10),
            "text-hash".to_string(),
            "voice-123".to_string(),
            "settings-hash".to_string(),
            "/cache/test.mp3".to_string(),
            1024,
            5000,
        )
    }

    #[tokio::test]
    async fn test_get_returns_cached_data() {
        let mut mock = MockAudioCacheRepository::new();
        let entry = make_test_entry();
        let cache_key = entry.cache_key.clone();

        mock.expect_get()
            .with(eq(cache_key.clone()))
            .times(1)
            .returning(move |_| {
                Ok(Some(CachedAudioData {
                    entry: make_test_entry(),
                    audio_data: vec![1, 2, 3],
                    word_timings: None,
                }))
            });

        let service = AudioCacheService::new(mock);
        let result = service.get(&cache_key).await.unwrap();
        assert!(result.is_some());
    }

    #[tokio::test]
    async fn test_get_returns_none_on_miss() {
        let mut mock = MockAudioCacheRepository::new();
        mock.expect_get()
            .with(eq("missing-key".to_string()))
            .times(1)
            .returning(|_| Ok(None));

        let service = AudioCacheService::new(mock);
        let result = service.get("missing-key").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_exists() {
        let mut mock = MockAudioCacheRepository::new();
        mock.expect_exists()
            .with(eq("test-key".to_string()))
            .times(1)
            .returning(|_| Ok(true));

        let service = AudioCacheService::new(mock);
        let result = service.exists("test-key").await.unwrap();
        assert!(result);
    }

    #[tokio::test]
    async fn test_store_triggers_eviction_when_over_limit() {
        let mut mock = MockAudioCacheRepository::new();
        let entry = make_test_entry();

        mock.expect_store().times(1).returning(|_, _| Ok(()));

        mock.expect_get_stats().times(1).returning(|| {
            Ok(CacheStats {
                total_size_bytes: 1_100_000_000, // Over limit
                entry_count: 100,
                max_size_bytes: 1_000_000_000,
                oldest_entry_at: None,
                newest_entry_at: None,
                document_count: 5,
            })
        });

        mock.expect_evict_lru().times(1).returning(|_| {
            Ok(EvictionResult {
                evicted_count: 10,
                bytes_freed: 100_000_000,
            })
        });

        let service = AudioCacheService::new(mock);
        let result = service.store(entry, vec![1, 2, 3]).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_store_no_eviction_under_limit() {
        let mut mock = MockAudioCacheRepository::new();
        let entry = make_test_entry();

        mock.expect_store().times(1).returning(|_, _| Ok(()));

        mock.expect_get_stats().times(1).returning(|| {
            Ok(CacheStats {
                total_size_bytes: 500_000_000, // Under limit
                entry_count: 50,
                max_size_bytes: 1_000_000_000,
                oldest_entry_at: None,
                newest_entry_at: None,
                document_count: 3,
            })
        });

        // No eviction expected

        let service = AudioCacheService::new(mock);
        let result = service.store(entry, vec![1, 2, 3]).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_coverage() {
        let mut mock = MockAudioCacheRepository::new();
        mock.expect_get_coverage()
            .with(eq("doc-1"), eq(true))
            .times(1)
            .returning(|_, _| Ok(CoverageStats::empty("doc-1".to_string())));

        let service = AudioCacheService::new(mock);
        let result = service.get_coverage("doc-1", true).await.unwrap();
        assert_eq!(result.document_id, "doc-1");
    }

    #[tokio::test]
    async fn test_clear_document() {
        let mut mock = MockAudioCacheRepository::new();
        mock.expect_delete_for_document()
            .with(eq("doc-1"))
            .times(1)
            .returning(|_| Ok(5));

        let service = AudioCacheService::new(mock);
        let result = service.clear_document("doc-1").await.unwrap();
        assert_eq!(result, 5);
    }

    #[tokio::test]
    async fn test_set_size_limit_triggers_eviction() {
        let mut mock = MockAudioCacheRepository::new();

        mock.expect_set_size_limit().times(1).returning(|_| Ok(()));

        mock.expect_get_stats().times(1).returning(|| {
            Ok(CacheStats {
                total_size_bytes: 2_000_000_000, // Over new limit
                entry_count: 200,
                max_size_bytes: 1_000_000_000,
                oldest_entry_at: None,
                newest_entry_at: None,
                document_count: 10,
            })
        });

        mock.expect_evict_lru().times(1).returning(|_| {
            Ok(EvictionResult {
                evicted_count: 100,
                bytes_freed: 1_100_000_000,
            })
        });

        let service = AudioCacheService::new(mock);
        let result = service.set_size_limit(1_000_000_000).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_with_validation_returns_data_on_hash_match() {
        let mut mock = MockAudioCacheRepository::new();
        let entry = make_test_entry();
        let cache_key = entry.cache_key.clone();
        let text_hash = entry.text_hash.clone();

        mock.expect_get()
            .with(eq(cache_key.clone()))
            .times(1)
            .returning(move |_| {
                Ok(Some(CachedAudioData {
                    entry: make_test_entry(),
                    audio_data: vec![1, 2, 3],
                    word_timings: None,
                }))
            });

        let service = AudioCacheService::new(mock);
        let result = service
            .get_with_validation(&cache_key, &text_hash)
            .await
            .unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().audio_data, vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn test_get_with_validation_invalidates_on_hash_mismatch() {
        let mut mock = MockAudioCacheRepository::new();
        let entry = make_test_entry();
        let cache_key = entry.cache_key.clone();

        mock.expect_get()
            .with(eq(cache_key.clone()))
            .times(1)
            .returning(move |_| {
                Ok(Some(CachedAudioData {
                    entry: make_test_entry(), // Has text_hash "text-hash"
                    audio_data: vec![1, 2, 3],
                    word_timings: None,
                }))
            });

        // Expect delete to be called when hash mismatches
        mock.expect_delete()
            .with(eq(cache_key.clone()))
            .times(1)
            .returning(|_| Ok(()));

        let service = AudioCacheService::new(mock);
        // Pass different hash than what's in the entry ("text-hash")
        let result = service
            .get_with_validation(&cache_key, "different-hash")
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_with_validation_returns_none_on_cache_miss() {
        let mut mock = MockAudioCacheRepository::new();
        mock.expect_get()
            .with(eq("missing-key".to_string()))
            .times(1)
            .returning(|_| Ok(None));

        let service = AudioCacheService::new(mock);
        let result = service
            .get_with_validation("missing-key", "any-hash")
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_with_validation_propagates_get_error() {
        let mut mock = MockAudioCacheRepository::new();
        mock.expect_get()
            .with(eq("error-key".to_string()))
            .times(1)
            .returning(|_| Err(RepositoryError::NotFound("test error".to_string())));

        let service = AudioCacheService::new(mock);
        let result = service.get_with_validation("error-key", "any-hash").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_with_validation_propagates_delete_error() {
        let mut mock = MockAudioCacheRepository::new();
        let entry = make_test_entry();
        let cache_key = entry.cache_key.clone();

        mock.expect_get()
            .with(eq(cache_key.clone()))
            .times(1)
            .returning(move |_| {
                Ok(Some(CachedAudioData {
                    entry: make_test_entry(),
                    audio_data: vec![1, 2, 3],
                    word_timings: None,
                }))
            });

        // Simulate delete error
        mock.expect_delete()
            .with(eq(cache_key.clone()))
            .times(1)
            .returning(|_| Err(RepositoryError::DatabaseError("delete failed".to_string())));

        let service = AudioCacheService::new(mock);
        let result = service
            .get_with_validation(&cache_key, "different-hash")
            .await;
        assert!(result.is_err());
    }
}
