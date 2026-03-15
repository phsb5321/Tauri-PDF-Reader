//! Audio Cache Adapter
//!
//! Handles caching of TTS audio files to disk with metadata tracking.
//! Cache key is generated from SHA256(text + voice_id + model_id + settings).
//!
//! Cache structure:
//! - `{cache_key}.mp3` - Audio data
//! - `{cache_key}.json` - Timestamps and metadata (optional)

use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;

/// Information about a cached audio entry
#[derive(Debug, Clone)]
pub struct CacheEntry {
    pub cache_key: String,
    pub document_id: Option<String>,
    pub page_number: Option<i32>,
    pub text_hash: String,
    pub voice_id: String,
    pub settings_hash: String,
    pub file_path: PathBuf,
    pub size_bytes: u64,
    pub created_at: String,
    pub last_accessed_at: String,
}

/// Cached TTS result with audio and timestamps
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedTtsData {
    pub audio_data: Vec<u8>,
    pub word_timings: Vec<CachedWordTiming>,
    pub total_duration: f64,
}

/// Word timing for cached data (matches WordTiming from elevenlabs.rs)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedWordTiming {
    pub word: String,
    pub start_time: f64,
    pub end_time: f64,
    pub char_start: usize,
    pub char_end: usize,
}

/// Cache statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheInfo {
    pub total_size_bytes: u64,
    pub entry_count: u32,
    pub oldest_entry: Option<String>,
    pub newest_entry: Option<String>,
}

/// Result of clearing cache
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearResult {
    pub success: bool,
    pub bytes_cleared: u64,
    pub entries_removed: u32,
}

/// Audio cache adapter for file-based caching
pub struct AudioCacheAdapter {
    cache_dir: PathBuf,
}

impl AudioCacheAdapter {
    /// Create a new audio cache adapter
    ///
    /// # Arguments
    /// * `app_cache_dir` - The app's cache directory (e.g., from Tauri's app handle)
    pub fn new(app_cache_dir: PathBuf) -> Self {
        let cache_dir = app_cache_dir.join("tts_cache");
        Self { cache_dir }
    }

    /// Generate a cache key from text and settings
    pub fn generate_cache_key(
        text: &str,
        voice_id: &str,
        model_id: &str,
        settings_hash: &str,
    ) -> String {
        let mut hasher = Sha256::new();
        hasher.update(text.as_bytes());
        hasher.update(voice_id.as_bytes());
        hasher.update(model_id.as_bytes());
        hasher.update(settings_hash.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Generate a hash of the text content
    pub fn hash_text(text: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(text.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Ensure cache directory exists, create if missing
    fn ensure_cache_dir(&self) -> Result<(), String> {
        if !self.cache_dir.exists() {
            fs::create_dir_all(&self.cache_dir).map_err(|e| {
                tracing::error!("Failed to create cache directory: {}", e);
                format!("CACHE_DIR_ERROR: Failed to create cache directory: {}", e)
            })?;
            tracing::debug!("Created TTS cache directory: {:?}", self.cache_dir);
        }
        Ok(())
    }

    /// Get cached audio bytes if they exist
    ///
    /// # Returns
    /// - `Ok(Some(data))` if cache hit
    /// - `Ok(None)` if cache miss
    /// - `Err` if error reading file (corrupted files are deleted and treated as miss)
    pub fn get(&self, cache_key: &str) -> Result<Option<Vec<u8>>, String> {
        let file_path = self.cache_dir.join(format!("{}.mp3", cache_key));

        if !file_path.exists() {
            return Ok(None);
        }

        match fs::File::open(&file_path) {
            Ok(mut file) => {
                let mut buffer = Vec::new();
                match file.read_to_end(&mut buffer) {
                    Ok(_) => {
                        tracing::debug!("Cache hit for key: {}", cache_key);
                        Ok(Some(buffer))
                    }
                    Err(e) => {
                        // Corrupted file - delete and treat as miss
                        tracing::warn!("Corrupted cache file {}, deleting: {}", cache_key, e);
                        let _ = fs::remove_file(&file_path);
                        Ok(None)
                    }
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                tracing::error!("Permission denied reading cache file: {}", cache_key);
                Err(format!("PERMISSION_ERROR: Cannot read cache file: {}", e))
            }
            Err(e) => {
                tracing::error!("Error reading cache file {}: {}", cache_key, e);
                // Treat other errors as cache miss but log them
                Ok(None)
            }
        }
    }

    /// Store audio bytes in cache
    ///
    /// # Errors
    /// - Permission errors are returned as errors
    /// - Disk full errors are logged and ignored (cache is best-effort)
    pub fn set(&self, cache_key: &str, data: &[u8]) -> Result<(), String> {
        // Ensure cache directory exists
        self.ensure_cache_dir()?;

        let file_path = self.cache_dir.join(format!("{}.mp3", cache_key));

        match fs::File::create(&file_path) {
            Ok(mut file) => {
                match file.write_all(data) {
                    Ok(_) => {
                        tracing::debug!("Cached {} bytes for key: {}", data.len(), cache_key);
                        Ok(())
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::StorageFull => {
                        // Disk full - log and continue without cache
                        tracing::warn!("Disk full, cannot cache audio: {}", e);
                        // Try to clean up the partially written file
                        let _ = fs::remove_file(&file_path);
                        Ok(()) // Don't fail the operation, just skip caching
                    }
                    Err(e) => {
                        tracing::error!("Failed to write cache file: {}", e);
                        // Clean up partial file
                        let _ = fs::remove_file(&file_path);
                        Err(format!("CACHE_WRITE_ERROR: {}", e))
                    }
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                tracing::error!("Permission denied creating cache file");
                Err(format!("PERMISSION_ERROR: Cannot create cache file: {}", e))
            }
            Err(e) => {
                tracing::error!("Failed to create cache file: {}", e);
                Err(format!("CACHE_CREATE_ERROR: {}", e))
            }
        }
    }

    /// Store complete TTS data (audio + timestamps) in cache
    ///
    /// Writes both the MP3 audio file and a JSON file with timestamps.
    pub fn set_with_timestamps(
        &self,
        cache_key: &str,
        audio_data: &[u8],
        word_timings: &[CachedWordTiming],
        total_duration: f64,
    ) -> Result<(), String> {
        // Ensure cache directory exists
        self.ensure_cache_dir()?;

        let audio_path = self.cache_dir.join(format!("{}.mp3", cache_key));
        let meta_path = self.cache_dir.join(format!("{}.json", cache_key));

        // Write audio file
        match fs::File::create(&audio_path) {
            Ok(mut file) => {
                if let Err(e) = file.write_all(audio_data) {
                    let _ = fs::remove_file(&audio_path);
                    if e.kind() == std::io::ErrorKind::StorageFull {
                        tracing::warn!("Disk full, cannot cache audio: {}", e);
                        return Ok(());
                    }
                    return Err(format!("CACHE_WRITE_ERROR: {}", e));
                }
            }
            Err(e) => {
                return Err(format!("CACHE_CREATE_ERROR: {}", e));
            }
        }

        // Write metadata/timestamps file
        let metadata = serde_json::json!({
            "wordTimings": word_timings,
            "totalDuration": total_duration
        });

        match fs::File::create(&meta_path) {
            Ok(mut file) => {
                let json_str = serde_json::to_string(&metadata)
                    .map_err(|e| format!("JSON_SERIALIZE_ERROR: {}", e))?;
                if let Err(e) = file.write_all(json_str.as_bytes()) {
                    // Clean up both files on error
                    let _ = fs::remove_file(&audio_path);
                    let _ = fs::remove_file(&meta_path);
                    return Err(format!("CACHE_WRITE_ERROR: {}", e));
                }
            }
            Err(e) => {
                // Clean up audio file since we couldn't write metadata
                let _ = fs::remove_file(&audio_path);
                return Err(format!("CACHE_CREATE_ERROR: {}", e));
            }
        }

        tracing::info!(
            "Cached TTS with timestamps: {} bytes audio, {} words, {:.2}s duration",
            audio_data.len(),
            word_timings.len(),
            total_duration
        );

        Ok(())
    }

    /// Get complete TTS data (audio + timestamps) from cache
    ///
    /// Returns None if either file is missing or corrupted.
    pub fn get_with_timestamps(&self, cache_key: &str) -> Result<Option<CachedTtsData>, String> {
        let audio_path = self.cache_dir.join(format!("{}.mp3", cache_key));
        let meta_path = self.cache_dir.join(format!("{}.json", cache_key));

        // Check if both files exist
        if !audio_path.exists() || !meta_path.exists() {
            return Ok(None);
        }

        // Read audio file
        let audio_data = match fs::read(&audio_path) {
            Ok(data) => data,
            Err(e) => {
                tracing::warn!("Failed to read cached audio {}: {}", cache_key, e);
                // Clean up corrupted cache entry
                let _ = fs::remove_file(&audio_path);
                let _ = fs::remove_file(&meta_path);
                return Ok(None);
            }
        };

        // Read and parse metadata file
        let meta_content = match fs::read_to_string(&meta_path) {
            Ok(content) => content,
            Err(e) => {
                tracing::warn!("Failed to read cached metadata {}: {}", cache_key, e);
                let _ = fs::remove_file(&audio_path);
                let _ = fs::remove_file(&meta_path);
                return Ok(None);
            }
        };

        let metadata: serde_json::Value = match serde_json::from_str(&meta_content) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("Failed to parse cached metadata {}: {}", cache_key, e);
                let _ = fs::remove_file(&audio_path);
                let _ = fs::remove_file(&meta_path);
                return Ok(None);
            }
        };

        let word_timings: Vec<CachedWordTiming> = match serde_json::from_value(
            metadata
                .get("wordTimings")
                .cloned()
                .unwrap_or(serde_json::Value::Array(vec![])),
        ) {
            Ok(timings) => timings,
            Err(e) => {
                tracing::warn!("Failed to parse word timings {}: {}", cache_key, e);
                let _ = fs::remove_file(&audio_path);
                let _ = fs::remove_file(&meta_path);
                return Ok(None);
            }
        };

        let total_duration = metadata
            .get("totalDuration")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        tracing::info!(
            "Cache hit with timestamps: {} bytes, {} words",
            audio_data.len(),
            word_timings.len()
        );

        Ok(Some(CachedTtsData {
            audio_data,
            word_timings,
            total_duration,
        }))
    }

    /// Delete all cache entries for a specific voice
    pub fn invalidate_voice(&self, voice_id: &str) -> Result<ClearResult, String> {
        // This requires metadata tracking to know which files belong to which voice
        // For now, we'll need to iterate through files
        // In production, this would query the tts_cache_metadata table
        tracing::debug!("Invalidating cache for voice: {}", voice_id);

        // Without metadata, we can't selectively invalidate
        // This is a placeholder - actual implementation would use DB
        Ok(ClearResult {
            success: true,
            bytes_cleared: 0,
            entries_removed: 0,
        })
    }

    /// Clear all cached audio files
    pub fn clear(&self) -> Result<ClearResult, String> {
        if !self.cache_dir.exists() {
            return Ok(ClearResult {
                success: true,
                bytes_cleared: 0,
                entries_removed: 0,
            });
        }

        let mut bytes_cleared: u64 = 0;
        let mut entries_removed: u32 = 0;

        match fs::read_dir(&self.cache_dir) {
            Ok(entries) => {
                for entry in entries.flatten() {
                    let path = entry.path();
                    // Clear both .mp3 and .json files
                    let ext = path.extension().and_then(|e| e.to_str());
                    if ext == Some("mp3") || ext == Some("json") {
                        if let Ok(metadata) = entry.metadata() {
                            bytes_cleared += metadata.len();
                        }
                        if fs::remove_file(&path).is_ok() {
                            // Only count mp3 files as entries (json is metadata)
                            if ext == Some("mp3") {
                                entries_removed += 1;
                            }
                        }
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to read cache directory: {}", e);
                return Err(format!("CACHE_CLEAR_ERROR: {}", e));
            }
        }

        tracing::info!(
            "Cleared TTS cache: {} bytes, {} entries",
            bytes_cleared,
            entries_removed
        );

        Ok(ClearResult {
            success: true,
            bytes_cleared,
            entries_removed,
        })
    }

    /// Get cache statistics
    pub fn get_info(&self) -> Result<CacheInfo, String> {
        if !self.cache_dir.exists() {
            return Ok(CacheInfo {
                total_size_bytes: 0,
                entry_count: 0,
                oldest_entry: None,
                newest_entry: None,
            });
        }

        let mut total_size: u64 = 0;
        let mut entry_count: u32 = 0;
        let mut oldest_time: Option<std::time::SystemTime> = None;
        let mut newest_time: Option<std::time::SystemTime> = None;
        let mut oldest_name: Option<String> = None;
        let mut newest_name: Option<String> = None;

        match fs::read_dir(&self.cache_dir) {
            Ok(entries) => {
                for entry in entries.flatten() {
                    let path = entry.path();
                    // Count both .mp3 and .json files for size
                    let ext = path.extension().and_then(|e| e.to_str());
                    if ext == Some("mp3") || ext == Some("json") {
                        if let Ok(metadata) = entry.metadata() {
                            total_size += metadata.len();
                            // Only count mp3 files as entries
                            if ext == Some("mp3") {
                                entry_count += 1;

                                if let Ok(created) = metadata.created() {
                                    let name =
                                        path.file_name().map(|n| n.to_string_lossy().to_string());

                                    if oldest_time.is_none() || created < oldest_time.unwrap() {
                                        oldest_time = Some(created);
                                        oldest_name = name.clone();
                                    }
                                    if newest_time.is_none() || created > newest_time.unwrap() {
                                        newest_time = Some(created);
                                        newest_name = name;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to read cache directory: {}", e);
                return Err(format!("CACHE_INFO_ERROR: {}", e));
            }
        }

        Ok(CacheInfo {
            total_size_bytes: total_size,
            entry_count,
            oldest_entry: oldest_name,
            newest_entry: newest_name,
        })
    }

    /// Get the cache directory path
    pub fn get_cache_dir(&self) -> &PathBuf {
        &self.cache_dir
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;

    #[test]
    fn test_generate_cache_key() {
        let key1 = AudioCacheAdapter::generate_cache_key("hello", "voice1", "model1", "settings1");
        let key2 = AudioCacheAdapter::generate_cache_key("hello", "voice1", "model1", "settings1");
        let key3 = AudioCacheAdapter::generate_cache_key("hello", "voice2", "model1", "settings1");

        assert_eq!(key1, key2);
        assert_ne!(key1, key3);
        assert_eq!(key1.len(), 64); // SHA256 hex string length
    }

    #[test]
    fn test_hash_text() {
        let hash1 = AudioCacheAdapter::hash_text("hello world");
        let hash2 = AudioCacheAdapter::hash_text("hello world");
        let hash3 = AudioCacheAdapter::hash_text("different text");

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }

    #[test]
    fn test_cache_operations() {
        let cache_dir = temp_dir().join("test_tts_cache");
        let adapter = AudioCacheAdapter::new(cache_dir.clone());

        // Test set and get
        let key = "test_key_123";
        let data = vec![1, 2, 3, 4, 5];

        adapter.set(key, &data).unwrap();
        let retrieved = adapter.get(key).unwrap();
        assert_eq!(retrieved, Some(data));

        // Test cache miss
        let miss = adapter.get("nonexistent_key").unwrap();
        assert_eq!(miss, None);

        // Test clear
        let result = adapter.clear().unwrap();
        assert!(result.success);
        assert_eq!(result.entries_removed, 1);

        // Cleanup
        let _ = fs::remove_dir_all(&cache_dir);
    }
}
