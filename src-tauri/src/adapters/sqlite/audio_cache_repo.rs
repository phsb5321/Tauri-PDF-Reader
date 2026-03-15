//! SQLite Audio Cache Repository Adapter
//!
//! Implements the AudioCacheRepository port using SQLite for metadata persistence.
//! Audio files are stored on the filesystem via AudioCacheAdapter; this repository
//! tracks metadata for efficient querying, coverage statistics, and LRU eviction.

use async_trait::async_trait;
use sqlx::{Pool, Sqlite};
use std::path::PathBuf;

use crate::adapters::audio_cache::AudioCacheAdapter;
use crate::domain::cache::{AudioCacheEntry, CoverageStats, PageCoverageStats};
use crate::domain::errors::RepositoryError;
use crate::ports::audio_cache_repository::{
    AudioCacheRepository, CacheStats, CachedAudioData, EvictionResult, WordTiming,
};

/// SQLite implementation of AudioCacheRepository.
///
/// Combines SQLite metadata storage with filesystem audio caching.
pub struct SqliteAudioCacheRepo {
    pool: Pool<Sqlite>,
    file_adapter: AudioCacheAdapter,
}

impl SqliteAudioCacheRepo {
    /// Create a new SqliteAudioCacheRepo with the given database pool and cache directory.
    pub fn new(pool: Pool<Sqlite>, cache_dir: PathBuf) -> Self {
        Self {
            pool,
            file_adapter: AudioCacheAdapter::new(cache_dir),
        }
    }
}

#[async_trait]
impl AudioCacheRepository for SqliteAudioCacheRepo {
    /// Store audio data with full metadata
    async fn store(
        &self,
        entry: AudioCacheEntry,
        audio_data: Vec<u8>,
    ) -> Result<(), RepositoryError> {
        // Validate the entry
        entry
            .validate()
            .map_err(|e| RepositoryError::ValidationError(e))?;

        // Store audio file on filesystem
        self.file_adapter
            .set(&entry.cache_key, &audio_data)
            .map_err(|e| RepositoryError::IoError(e))?;

        // Store metadata in SQLite
        sqlx::query(
            r#"
            INSERT INTO tts_cache_metadata (
                cache_key, document_id, page_number, text_hash, voice_id,
                settings_hash, file_path, size_bytes, created_at, last_accessed_at,
                chunk_index, duration_ms, total_chunks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                last_accessed_at = excluded.last_accessed_at,
                size_bytes = excluded.size_bytes
            "#,
        )
        .bind(&entry.cache_key)
        .bind(&entry.document_id)
        .bind(entry.page_number)
        .bind(&entry.text_hash)
        .bind(&entry.voice_id)
        .bind(&entry.settings_hash)
        .bind(&entry.file_path)
        .bind(entry.size_bytes)
        .bind(&entry.created_at)
        .bind(&entry.last_accessed_at)
        .bind(entry.chunk_index)
        .bind(entry.duration_ms)
        .bind(entry.total_chunks)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            RepositoryError::DatabaseError(format!("Failed to store cache metadata: {}", e))
        })?;

        tracing::debug!(
            "Stored cache entry: key={}, doc={:?}, page={:?}, chunk={:?}",
            entry.cache_key,
            entry.document_id,
            entry.page_number,
            entry.chunk_index
        );

        Ok(())
    }

    /// Retrieve audio data by cache key
    async fn get(&self, cache_key: &str) -> Result<Option<CachedAudioData>, RepositoryError> {
        // Get metadata from SQLite
        let row: Option<(
            String,         // cache_key
            Option<String>, // document_id
            Option<i32>,    // page_number
            String,         // text_hash
            String,         // voice_id
            String,         // settings_hash
            String,         // file_path
            i64,            // size_bytes
            String,         // created_at
            String,         // last_accessed_at
            Option<i32>,    // chunk_index
            i64,            // duration_ms
            Option<i32>,    // total_chunks
        )> = sqlx::query_as(
            r#"
            SELECT cache_key, document_id, page_number, text_hash, voice_id,
                   settings_hash, file_path, size_bytes, created_at, last_accessed_at,
                   chunk_index, duration_ms, total_chunks
            FROM tts_cache_metadata
            WHERE cache_key = ?
            "#,
        )
        .bind(cache_key)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            RepositoryError::DatabaseError(format!("Failed to get cache metadata: {}", e))
        })?;

        let row = match row {
            Some(r) => r,
            None => return Ok(None),
        };

        // Get audio data from filesystem (try basic get first, then with timestamps)
        let audio_data = match self
            .file_adapter
            .get(cache_key)
            .map_err(|e| RepositoryError::IoError(e))?
        {
            Some(data) => data,
            None => {
                // Metadata exists but file doesn't - clean up orphan metadata
                tracing::warn!(
                    "Cache metadata exists but file missing for key: {}",
                    cache_key
                );
                let _ = sqlx::query("DELETE FROM tts_cache_metadata WHERE cache_key = ?")
                    .bind(cache_key)
                    .execute(&self.pool)
                    .await;
                return Ok(None);
            }
        };

        // Update last_accessed_at
        let _ = self.touch(cache_key).await;

        // Build entry from row
        let entry = AudioCacheEntry {
            cache_key: row.0,
            document_id: row.1,
            page_number: row.2,
            chunk_index: row.10,
            total_chunks: row.12,
            text_hash: row.3,
            voice_id: row.4,
            settings_hash: row.5,
            file_path: row.6,
            size_bytes: row.7,
            duration_ms: row.11,
            created_at: row.8,
            last_accessed_at: row.9,
        };

        // Try to get word timings from JSON metadata
        let word_timings =
            if let Ok(Some(cached)) = self.file_adapter.get_with_timestamps(cache_key) {
                Some(
                    cached
                        .word_timings
                        .into_iter()
                        .map(|wt| WordTiming {
                            word: wt.word,
                            start_time: wt.start_time,
                            end_time: wt.end_time,
                            char_start: wt.char_start as i32,
                            char_end: wt.char_end as i32,
                        })
                        .collect(),
                )
            } else {
                None
            };

        Ok(Some(CachedAudioData {
            entry,
            audio_data,
            word_timings,
        }))
    }

    /// Check if cache entry exists
    async fn exists(&self, cache_key: &str) -> Result<bool, RepositoryError> {
        let row: Option<(i32,)> =
            sqlx::query_as("SELECT 1 FROM tts_cache_metadata WHERE cache_key = ?")
                .bind(cache_key)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| {
                    RepositoryError::DatabaseError(format!(
                        "Failed to check cache existence: {}",
                        e
                    ))
                })?;

        if row.is_none() {
            return Ok(false);
        }

        // Also verify the file exists
        let audio_path = self
            .file_adapter
            .get_cache_dir()
            .join(format!("{}.mp3", cache_key));
        Ok(audio_path.exists())
    }

    /// Update last_accessed_at timestamp
    async fn touch(&self, cache_key: &str) -> Result<(), RepositoryError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("UPDATE tts_cache_metadata SET last_accessed_at = ? WHERE cache_key = ?")
            .bind(&now)
            .bind(cache_key)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to touch cache entry: {}", e))
            })?;
        Ok(())
    }

    /// Delete a cache entry
    async fn delete(&self, cache_key: &str) -> Result<(), RepositoryError> {
        // Delete file first
        let audio_path = self
            .file_adapter
            .get_cache_dir()
            .join(format!("{}.mp3", cache_key));
        let meta_path = self
            .file_adapter
            .get_cache_dir()
            .join(format!("{}.json", cache_key));

        if audio_path.exists() {
            std::fs::remove_file(&audio_path).map_err(|e| {
                RepositoryError::IoError(format!("Failed to delete audio file: {}", e))
            })?;
        }
        if meta_path.exists() {
            let _ = std::fs::remove_file(&meta_path);
        }

        // Delete metadata
        sqlx::query("DELETE FROM tts_cache_metadata WHERE cache_key = ?")
            .bind(cache_key)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to delete cache metadata: {}", e))
            })?;

        tracing::debug!("Deleted cache entry: {}", cache_key);
        Ok(())
    }

    /// Get coverage statistics for a document
    async fn get_coverage(
        &self,
        document_id: &str,
        include_page_stats: bool,
    ) -> Result<CoverageStats, RepositoryError> {
        // Get aggregate stats
        let row: Option<(i64, i64, i64)> = sqlx::query_as(
            r#"
            SELECT COUNT(*) as cached_chunks,
                   COALESCE(SUM(duration_ms), 0) as total_duration,
                   COALESCE(SUM(size_bytes), 0) as total_size
            FROM tts_cache_metadata
            WHERE document_id = ?
            "#,
        )
        .bind(document_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            RepositoryError::DatabaseError(format!("Failed to get coverage stats: {}", e))
        })?;

        let (cached_chunks, total_duration_ms, cached_size_bytes) = row.unwrap_or((0, 0, 0));

        // Try to get total_chunks from any entry (they should all have the same value)
        let total_chunks_row: Option<(Option<i32>,)> = sqlx::query_as(
            "SELECT total_chunks FROM tts_cache_metadata WHERE document_id = ? AND total_chunks IS NOT NULL LIMIT 1",
        )
        .bind(document_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(format!("Failed to get total chunks: {}", e)))?;

        let total_chunks = total_chunks_row
            .and_then(|(t,)| t)
            .unwrap_or(cached_chunks as i32);

        let mut stats = CoverageStats::empty(document_id.to_string());
        stats.update(
            total_chunks,
            cached_chunks as i32,
            total_duration_ms,
            cached_size_bytes,
        );

        // Get page-level stats if requested
        if include_page_stats {
            let page_rows: Vec<(i32, i64, i64, Option<i32>)> = sqlx::query_as(
                r#"
                SELECT page_number, COUNT(*) as cached, SUM(duration_ms) as duration, MAX(total_chunks) as page_total
                FROM tts_cache_metadata
                WHERE document_id = ? AND page_number IS NOT NULL
                GROUP BY page_number
                ORDER BY page_number
                "#,
            )
            .bind(document_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepositoryError::DatabaseError(format!("Failed to get page stats: {}", e)))?;

            let page_stats: Vec<PageCoverageStats> = page_rows
                .into_iter()
                .map(|(page, cached, duration, page_total)| {
                    PageCoverageStats::new(
                        page,
                        page_total.unwrap_or(cached as i32),
                        cached as i32,
                        duration,
                    )
                })
                .collect();

            stats.page_stats = Some(page_stats);
        }

        Ok(stats)
    }

    /// List cache entries for a document (ordered by page/chunk)
    async fn list_for_document(
        &self,
        document_id: &str,
    ) -> Result<Vec<AudioCacheEntry>, RepositoryError> {
        let rows: Vec<(
            String,
            Option<String>,
            Option<i32>,
            String,
            String,
            String,
            String,
            i64,
            String,
            String,
            Option<i32>,
            i64,
            Option<i32>,
        )> = sqlx::query_as(
            r#"
            SELECT cache_key, document_id, page_number, text_hash, voice_id,
                   settings_hash, file_path, size_bytes, created_at, last_accessed_at,
                   chunk_index, duration_ms, total_chunks
            FROM tts_cache_metadata
            WHERE document_id = ?
            ORDER BY page_number ASC, chunk_index ASC
            "#,
        )
        .bind(document_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            RepositoryError::DatabaseError(format!("Failed to list cache entries: {}", e))
        })?;

        let entries = rows
            .into_iter()
            .map(|row| AudioCacheEntry {
                cache_key: row.0,
                document_id: row.1,
                page_number: row.2,
                chunk_index: row.10,
                total_chunks: row.12,
                text_hash: row.3,
                voice_id: row.4,
                settings_hash: row.5,
                file_path: row.6,
                size_bytes: row.7,
                duration_ms: row.11,
                created_at: row.8,
                last_accessed_at: row.9,
            })
            .collect();

        Ok(entries)
    }

    /// Delete all cache entries for a document
    async fn delete_for_document(&self, document_id: &str) -> Result<i64, RepositoryError> {
        // Get all cache keys for this document
        let keys: Vec<(String,)> =
            sqlx::query_as("SELECT cache_key FROM tts_cache_metadata WHERE document_id = ?")
                .bind(document_id)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| {
                    RepositoryError::DatabaseError(format!("Failed to get cache keys: {}", e))
                })?;

        let count = keys.len() as i64;

        // Delete files
        for (cache_key,) in &keys {
            let audio_path = self
                .file_adapter
                .get_cache_dir()
                .join(format!("{}.mp3", cache_key));
            let meta_path = self
                .file_adapter
                .get_cache_dir()
                .join(format!("{}.json", cache_key));
            let _ = std::fs::remove_file(&audio_path);
            let _ = std::fs::remove_file(&meta_path);
        }

        // Delete metadata
        sqlx::query("DELETE FROM tts_cache_metadata WHERE document_id = ?")
            .bind(document_id)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                RepositoryError::DatabaseError(format!("Failed to delete cache metadata: {}", e))
            })?;

        tracing::info!(
            "Deleted {} cache entries for document: {}",
            count,
            document_id
        );
        Ok(count)
    }

    /// Get overall cache statistics
    async fn get_stats(&self) -> Result<CacheStats, RepositoryError> {
        let row: Option<(i64, i64, i64)> = sqlx::query_as(
            r#"
            SELECT COALESCE(SUM(size_bytes), 0) as total_size,
                   COUNT(*) as entry_count,
                   COUNT(DISTINCT document_id) as doc_count
            FROM tts_cache_metadata
            "#,
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(format!("Failed to get cache stats: {}", e)))?;

        let (total_size, entry_count, document_count) = row.unwrap_or((0, 0, 0));

        // Get oldest and newest entries
        let oldest: Option<(String,)> = sqlx::query_as(
            "SELECT created_at FROM tts_cache_metadata ORDER BY created_at ASC LIMIT 1",
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            RepositoryError::DatabaseError(format!("Failed to get oldest entry: {}", e))
        })?;

        let newest: Option<(String,)> = sqlx::query_as(
            "SELECT created_at FROM tts_cache_metadata ORDER BY created_at DESC LIMIT 1",
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            RepositoryError::DatabaseError(format!("Failed to get newest entry: {}", e))
        })?;

        // Get size limit
        let max_size = self.get_size_limit().await?;

        Ok(CacheStats {
            total_size_bytes: total_size,
            entry_count,
            max_size_bytes: max_size,
            oldest_entry_at: oldest.map(|(t,)| t),
            newest_entry_at: newest.map(|(t,)| t),
            document_count,
        })
    }

    /// Evict entries using LRU until under target size
    async fn evict_lru(&self, target_size_bytes: i64) -> Result<EvictionResult, RepositoryError> {
        // Get current size
        let current: (i64,) =
            sqlx::query_as("SELECT COALESCE(SUM(size_bytes), 0) FROM tts_cache_metadata")
                .fetch_one(&self.pool)
                .await
                .map_err(|e| {
                    RepositoryError::DatabaseError(format!("Failed to get current size: {}", e))
                })?;

        let current_size = current.0;
        if current_size <= target_size_bytes {
            return Ok(EvictionResult {
                evicted_count: 0,
                bytes_freed: 0,
            });
        }

        let bytes_to_free = current_size - target_size_bytes;
        let mut bytes_freed: i64 = 0;
        let mut evicted_count: i64 = 0;

        // Get entries ordered by last_accessed_at (LRU)
        let entries: Vec<(String, i64)> = sqlx::query_as(
            "SELECT cache_key, size_bytes FROM tts_cache_metadata ORDER BY last_accessed_at ASC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(format!("Failed to get LRU entries: {}", e)))?;

        for (cache_key, size) in entries {
            if bytes_freed >= bytes_to_free {
                break;
            }

            // Delete the entry
            if let Err(e) = self.delete(&cache_key).await {
                tracing::warn!("Failed to evict cache entry {}: {:?}", cache_key, e);
                continue;
            }

            bytes_freed += size;
            evicted_count += 1;
        }

        tracing::info!(
            "LRU eviction: freed {} bytes, evicted {} entries",
            bytes_freed,
            evicted_count
        );

        Ok(EvictionResult {
            evicted_count,
            bytes_freed,
        })
    }

    /// Get cache size limit setting
    async fn get_size_limit(&self) -> Result<i64, RepositoryError> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT value FROM cache_settings WHERE key = 'max_size_bytes'")
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| {
                    RepositoryError::DatabaseError(format!("Failed to get size limit: {}", e))
                })?;

        let limit = row
            .and_then(|(v,)| v.parse::<i64>().ok())
            .unwrap_or(5_368_709_120); // Default 5GB

        Ok(limit)
    }

    /// Set cache size limit setting
    async fn set_size_limit(&self, max_size_bytes: i64) -> Result<(), RepositoryError> {
        if max_size_bytes < 0 {
            return Err(RepositoryError::ValidationError(
                "Size limit cannot be negative".into(),
            ));
        }

        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO cache_settings (key, value, updated_at) VALUES ('max_size_bytes', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            "#,
        )
        .bind(max_size_bytes.to_string())
        .bind(&now)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(format!("Failed to set size limit: {}", e)))?;

        tracing::info!("Set cache size limit to {} bytes", max_size_bytes);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;
    use std::env::temp_dir;

    async fn setup_test_db() -> (Pool<Sqlite>, PathBuf) {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        // Run migrations
        sqlx::query(crate::db::migrations::MIGRATIONS[0])
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(crate::db::migrations::MIGRATIONS[1])
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(crate::db::migrations::MIGRATIONS[2])
            .execute(&pool)
            .await
            .unwrap();

        // Insert a test document to satisfy foreign key constraints
        sqlx::query(
            "INSERT INTO documents (id, file_path, title, page_count, current_page, created_at)
             VALUES ('doc-1', '/test/doc.pdf', 'Test Doc', 10, 1, datetime('now'))",
        )
        .execute(&pool)
        .await
        .unwrap();

        let cache_dir = temp_dir().join(format!("audio_cache_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&cache_dir).unwrap();

        (pool, cache_dir)
    }

    fn make_test_entry(cache_key: &str, doc_id: &str, page: i32, chunk: i32) -> AudioCacheEntry {
        AudioCacheEntry::new(
            cache_key.to_string(),
            Some(doc_id.to_string()),
            Some(page),
            Some(chunk),
            Some(10),
            "text-hash".to_string(),
            "voice-123".to_string(),
            "settings-hash".to_string(),
            format!("/cache/{}.mp3", cache_key),
            1024,
            5000,
        )
    }

    #[tokio::test]
    async fn test_store_and_get() {
        let (pool, cache_dir) = setup_test_db().await;
        let repo = SqliteAudioCacheRepo::new(pool, cache_dir.clone());

        let entry = make_test_entry(&"a".repeat(64), "doc-1", 1, 0);
        let audio_data = vec![1, 2, 3, 4, 5];

        // Store
        repo.store(entry.clone(), audio_data.clone()).await.unwrap();

        // Get
        let result = repo.get(&entry.cache_key).await.unwrap();
        assert!(result.is_some());
        let cached = result.unwrap();
        assert_eq!(cached.entry.cache_key, entry.cache_key);
        assert_eq!(cached.audio_data, audio_data);

        // Cleanup
        let _ = std::fs::remove_dir_all(&cache_dir);
    }

    #[tokio::test]
    async fn test_exists() {
        let (pool, cache_dir) = setup_test_db().await;
        let repo = SqliteAudioCacheRepo::new(pool, cache_dir.clone());

        let cache_key = "a".repeat(64);

        // Doesn't exist
        assert!(!repo.exists(&cache_key).await.unwrap());

        // Store
        let entry = make_test_entry(&cache_key, "doc-1", 1, 0);
        repo.store(entry, vec![1, 2, 3]).await.unwrap();

        // Now exists
        assert!(repo.exists(&cache_key).await.unwrap());

        let _ = std::fs::remove_dir_all(&cache_dir);
    }

    #[tokio::test]
    async fn test_delete() {
        let (pool, cache_dir) = setup_test_db().await;
        let repo = SqliteAudioCacheRepo::new(pool, cache_dir.clone());

        let cache_key = "a".repeat(64);
        let entry = make_test_entry(&cache_key, "doc-1", 1, 0);
        repo.store(entry, vec![1, 2, 3]).await.unwrap();

        // Delete
        repo.delete(&cache_key).await.unwrap();

        // Gone
        assert!(!repo.exists(&cache_key).await.unwrap());

        let _ = std::fs::remove_dir_all(&cache_dir);
    }

    #[tokio::test]
    async fn test_get_coverage() {
        let (pool, cache_dir) = setup_test_db().await;
        let repo = SqliteAudioCacheRepo::new(pool, cache_dir.clone());

        // Store multiple entries for same document
        for i in 0..5 {
            let cache_key = format!("{}{}", "a".repeat(63), i);
            let entry = make_test_entry(&cache_key, "doc-1", 1, i);
            repo.store(entry, vec![1, 2, 3]).await.unwrap();
        }

        let coverage = repo.get_coverage("doc-1", false).await.unwrap();
        assert_eq!(coverage.document_id, "doc-1");
        assert_eq!(coverage.cached_chunks, 5);

        let _ = std::fs::remove_dir_all(&cache_dir);
    }

    #[tokio::test]
    async fn test_get_stats() {
        let (pool, cache_dir) = setup_test_db().await;
        let repo = SqliteAudioCacheRepo::new(pool, cache_dir.clone());

        // Empty stats
        let stats = repo.get_stats().await.unwrap();
        assert_eq!(stats.entry_count, 0);
        assert_eq!(stats.total_size_bytes, 0);

        // Add entries
        for i in 0..3 {
            let cache_key = format!("{}{}", "a".repeat(63), i);
            let entry = make_test_entry(&cache_key, "doc-1", 1, i);
            repo.store(entry, vec![1, 2, 3, 4]).await.unwrap();
        }

        let stats = repo.get_stats().await.unwrap();
        assert_eq!(stats.entry_count, 3);
        assert_eq!(stats.document_count, 1);

        let _ = std::fs::remove_dir_all(&cache_dir);
    }

    #[tokio::test]
    async fn test_size_limit() {
        let (pool, cache_dir) = setup_test_db().await;
        let repo = SqliteAudioCacheRepo::new(pool, cache_dir.clone());

        // Default
        let limit = repo.get_size_limit().await.unwrap();
        assert_eq!(limit, 5_368_709_120);

        // Set new limit
        repo.set_size_limit(1_073_741_824).await.unwrap(); // 1GB

        let limit = repo.get_size_limit().await.unwrap();
        assert_eq!(limit, 1_073_741_824);

        // Invalid limit
        let result = repo.set_size_limit(-1).await;
        assert!(result.is_err());

        let _ = std::fs::remove_dir_all(&cache_dir);
    }
}
