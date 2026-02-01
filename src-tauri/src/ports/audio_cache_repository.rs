//! Audio Cache Repository Port
//!
//! Defines the contract for TTS audio cache persistence operations.

use crate::domain::cache::{AudioCacheEntry, CoverageStats};
use crate::domain::errors::RepositoryError;
use async_trait::async_trait;
#[cfg(any(test, feature = "test-mocks"))]
use mockall::automock;
use serde::{Deserialize, Serialize};

/// Cached audio data with entry metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedAudioData {
    pub entry: AudioCacheEntry,
    pub audio_data: Vec<u8>,
    pub word_timings: Option<Vec<WordTiming>>,
}

/// Word timing for synchronized highlighting
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordTiming {
    pub word: String,
    pub start_time: f64,
    pub end_time: f64,
    pub char_start: i32,
    pub char_end: i32,
}

/// Overall cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStats {
    pub total_size_bytes: i64,
    pub entry_count: i64,
    pub max_size_bytes: i64,
    pub oldest_entry_at: Option<String>,
    pub newest_entry_at: Option<String>,
    pub document_count: i64,
}

/// Result of an eviction operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvictionResult {
    pub evicted_count: i64,
    pub bytes_freed: i64,
}

/// Repository trait for audio cache persistence
#[cfg_attr(any(test, feature = "test-mocks"), automock)]
#[async_trait]
pub trait AudioCacheRepository: Send + Sync {
    /// Store audio data with full metadata
    async fn store(
        &self,
        entry: AudioCacheEntry,
        audio_data: Vec<u8>,
    ) -> Result<(), RepositoryError>;

    /// Retrieve audio data by cache key
    async fn get(&self, cache_key: &str) -> Result<Option<CachedAudioData>, RepositoryError>;

    /// Check if cache entry exists
    async fn exists(&self, cache_key: &str) -> Result<bool, RepositoryError>;

    /// Update last_accessed_at timestamp
    async fn touch(&self, cache_key: &str) -> Result<(), RepositoryError>;

    /// Delete a cache entry
    async fn delete(&self, cache_key: &str) -> Result<(), RepositoryError>;

    /// Get coverage statistics for a document
    async fn get_coverage(
        &self,
        document_id: &str,
        include_page_stats: bool,
    ) -> Result<CoverageStats, RepositoryError>;

    /// List cache entries for a document (ordered by page/chunk)
    async fn list_for_document(
        &self,
        document_id: &str,
    ) -> Result<Vec<AudioCacheEntry>, RepositoryError>;

    /// Delete all cache entries for a document
    async fn delete_for_document(&self, document_id: &str) -> Result<i64, RepositoryError>;

    /// Get overall cache statistics
    async fn get_stats(&self) -> Result<CacheStats, RepositoryError>;

    /// Evict entries using LRU until under target size
    async fn evict_lru(&self, target_size_bytes: i64) -> Result<EvictionResult, RepositoryError>;

    /// Get cache size limit setting
    async fn get_size_limit(&self) -> Result<i64, RepositoryError>;

    /// Set cache size limit setting
    async fn set_size_limit(&self, max_size_bytes: i64) -> Result<(), RepositoryError>;
}
