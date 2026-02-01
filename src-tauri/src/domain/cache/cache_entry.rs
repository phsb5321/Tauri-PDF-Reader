//! Audio cache entry domain entity
//!
//! Defines the structure for cached TTS audio metadata.

use serde::{Deserialize, Serialize};

/// Metadata for a cached TTS audio file
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioCacheEntry {
    pub cache_key: String,
    pub document_id: Option<String>,
    pub page_number: Option<i32>,
    pub chunk_index: Option<i32>,
    pub total_chunks: Option<i32>,
    pub text_hash: String,
    pub voice_id: String,
    pub settings_hash: String,
    pub file_path: String,
    pub size_bytes: i64,
    pub duration_ms: i64,
    pub created_at: String,
    pub last_accessed_at: String,
}

impl AudioCacheEntry {
    /// Create a new cache entry
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        cache_key: String,
        document_id: Option<String>,
        page_number: Option<i32>,
        chunk_index: Option<i32>,
        total_chunks: Option<i32>,
        text_hash: String,
        voice_id: String,
        settings_hash: String,
        file_path: String,
        size_bytes: i64,
        duration_ms: i64,
    ) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            cache_key,
            document_id,
            page_number,
            chunk_index,
            total_chunks,
            text_hash,
            voice_id,
            settings_hash,
            file_path,
            size_bytes,
            duration_ms,
            created_at: now.clone(),
            last_accessed_at: now,
        }
    }

    /// Update the last accessed timestamp
    pub fn touch(&mut self) {
        self.last_accessed_at = chrono::Utc::now().to_rfc3339();
    }

    /// Validate the cache entry
    pub fn validate(&self) -> Result<(), String> {
        if self.cache_key.is_empty() {
            return Err("Cache key cannot be empty".into());
        }
        if self.cache_key.len() != 64 {
            return Err("Cache key must be a 64-character SHA256 hash".into());
        }
        if self.voice_id.is_empty() {
            return Err("Voice ID cannot be empty".into());
        }
        if self.size_bytes <= 0 {
            return Err("Size must be greater than 0".into());
        }
        if self.duration_ms <= 0 {
            return Err("Duration must be greater than 0".into());
        }
        Ok(())
    }

    /// Check if this entry belongs to a specific document
    pub fn belongs_to_document(&self, document_id: &str) -> bool {
        self.document_id.as_deref() == Some(document_id)
    }
}

/// Cached audio data with entry metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedAudioData {
    pub entry: AudioCacheEntry,
    pub audio_data: Vec<u8>,
    pub word_timings: Option<Vec<WordTiming>>,
}

/// Word timing information for synchronized highlighting
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WordTiming {
    pub word: String,
    pub start_time: f64,
    pub end_time: f64,
    pub char_start: i32,
    pub char_end: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_valid_entry() -> AudioCacheEntry {
        AudioCacheEntry::new(
            "a".repeat(64), // Valid SHA256 length
            Some("doc-1".to_string()),
            Some(1),
            Some(0),
            Some(5),
            "text-hash".to_string(),
            "voice-123".to_string(),
            "settings-hash".to_string(),
            "/path/to/audio.mp3".to_string(),
            1024,
            5000,
        )
    }

    #[test]
    fn test_new_cache_entry() {
        let entry = make_valid_entry();
        assert_eq!(entry.document_id, Some("doc-1".to_string()));
        assert_eq!(entry.page_number, Some(1));
        assert_eq!(entry.chunk_index, Some(0));
        assert_eq!(entry.size_bytes, 1024);
        assert_eq!(entry.duration_ms, 5000);
    }

    #[test]
    fn test_validate_valid_entry() {
        let entry = make_valid_entry();
        assert!(entry.validate().is_ok());
    }

    #[test]
    fn test_validate_empty_cache_key() {
        let mut entry = make_valid_entry();
        entry.cache_key = "".to_string();
        assert!(entry.validate().is_err());
    }

    #[test]
    fn test_validate_invalid_cache_key_length() {
        let mut entry = make_valid_entry();
        entry.cache_key = "short".to_string();
        assert!(entry.validate().is_err());
    }

    #[test]
    fn test_validate_empty_voice_id() {
        let mut entry = make_valid_entry();
        entry.voice_id = "".to_string();
        assert!(entry.validate().is_err());
    }

    #[test]
    fn test_validate_zero_size() {
        let mut entry = make_valid_entry();
        entry.size_bytes = 0;
        assert!(entry.validate().is_err());
    }

    #[test]
    fn test_validate_zero_duration() {
        let mut entry = make_valid_entry();
        entry.duration_ms = 0;
        assert!(entry.validate().is_err());
    }

    #[test]
    fn test_touch() {
        let mut entry = make_valid_entry();
        let original = entry.last_accessed_at.clone();
        std::thread::sleep(std::time::Duration::from_millis(10));
        entry.touch();
        assert_ne!(entry.last_accessed_at, original);
    }

    #[test]
    fn test_belongs_to_document() {
        let entry = make_valid_entry();
        assert!(entry.belongs_to_document("doc-1"));
        assert!(!entry.belongs_to_document("doc-2"));
    }

    #[test]
    fn test_belongs_to_document_none() {
        let mut entry = make_valid_entry();
        entry.document_id = None;
        assert!(!entry.belongs_to_document("doc-1"));
    }
}
