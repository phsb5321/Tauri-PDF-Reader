/// Rust Port Contracts
/// Feature: Reading Session Manager with Audio Cache & Progress Persistence
///
/// This file defines the Rust traits (ports) for the new features.
/// Implementations will be in src-tauri/src/adapters/

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

// =============================================================================
// SESSION REPOSITORY PORT
// =============================================================================

/// Repository trait for reading session persistence
#[async_trait]
pub trait SessionRepository: Send + Sync {
    /// Create a new reading session
    async fn create(&self, session: CreateSessionInput) -> Result<ReadingSession, RepositoryError>;

    /// Get a session by ID with all documents
    async fn get(&self, session_id: &str) -> Result<Option<ReadingSession>, RepositoryError>;

    /// List all sessions (summary only)
    async fn list(&self) -> Result<Vec<SessionSummary>, RepositoryError>;

    /// Update session metadata
    async fn update(&self, session_id: &str, input: UpdateSessionInput) -> Result<ReadingSession, RepositoryError>;

    /// Delete a session (cascade deletes session_documents)
    async fn delete(&self, session_id: &str) -> Result<(), RepositoryError>;

    /// Add a document to a session
    async fn add_document(&self, session_id: &str, document_id: &str, position: Option<i32>) -> Result<(), RepositoryError>;

    /// Remove a document from a session
    async fn remove_document(&self, session_id: &str, document_id: &str) -> Result<(), RepositoryError>;

    /// Update document state within session
    async fn update_document(&self, session_id: &str, document_id: &str, input: UpdateSessionDocumentInput) -> Result<(), RepositoryError>;

    /// Update last_accessed_at timestamp
    async fn touch(&self, session_id: &str) -> Result<(), RepositoryError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionInput {
    pub name: String,
    pub document_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionInput {
    pub name: Option<String>,
    pub document_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionDocumentInput {
    pub current_page: Option<i32>,
    pub scroll_position: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingSession {
    pub id: String,
    pub name: String,
    pub documents: Vec<SessionDocument>,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDocument {
    pub document_id: String,
    pub position: i32,
    pub current_page: i32,
    pub scroll_position: f64,
    pub created_at: String,
    // Denormalized for display
    pub title: Option<String>,
    pub page_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub name: String,
    pub document_count: i32,
    pub last_accessed_at: String,
    pub created_at: String,
}

// =============================================================================
// AUDIO CACHE REPOSITORY PORT
// =============================================================================

/// Enhanced repository trait for audio cache with metadata tracking
#[async_trait]
pub trait AudioCacheRepository: Send + Sync {
    /// Store audio data with full metadata
    async fn store(&self, entry: AudioCacheEntry, audio_data: Vec<u8>) -> Result<(), RepositoryError>;

    /// Retrieve audio data by cache key
    async fn get(&self, cache_key: &str) -> Result<Option<CachedAudioData>, RepositoryError>;

    /// Check if cache entry exists
    async fn exists(&self, cache_key: &str) -> Result<bool, RepositoryError>;

    /// Update last_accessed_at timestamp
    async fn touch(&self, cache_key: &str) -> Result<(), RepositoryError>;

    /// Delete a cache entry
    async fn delete(&self, cache_key: &str) -> Result<(), RepositoryError>;

    /// Get coverage statistics for a document
    async fn get_coverage(&self, document_id: &str, include_page_stats: bool) -> Result<CoverageStats, RepositoryError>;

    /// List cache entries for a document (ordered by page/chunk)
    async fn list_for_document(&self, document_id: &str) -> Result<Vec<AudioCacheEntry>, RepositoryError>;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedAudioData {
    pub entry: AudioCacheEntry,
    pub audio_data: Vec<u8>,
    pub word_timings: Option<Vec<WordTiming>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordTiming {
    pub word: String,
    pub start_time: f64,
    pub end_time: f64,
    pub char_start: i32,
    pub char_end: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverageStats {
    pub document_id: String,
    pub total_chunks: i32,
    pub cached_chunks: i32,
    pub coverage_percent: f64,
    pub total_duration_ms: i64,
    pub cached_size_bytes: i64,
    pub last_updated: String,
    pub page_stats: Option<Vec<PageCoverageStats>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageCoverageStats {
    pub page_number: i32,
    pub total_chunks: i32,
    pub cached_chunks: i32,
    pub coverage_percent: f64,
    pub duration_ms: i64,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvictionResult {
    pub evicted_count: i64,
    pub bytes_freed: i64,
}

// =============================================================================
// AUDIO EXPORT SERVICE PORT
// =============================================================================

/// Service trait for audio export functionality
#[async_trait]
pub trait AudioExportService: Send + Sync {
    /// Check if document is ready for export
    async fn check_readiness(&self, document_id: &str, voice_id: Option<&str>) -> Result<ExportReadiness, ExportError>;

    /// Export document audio to file
    async fn export(&self, options: ExportOptions, progress_callback: Box<dyn Fn(ExportProgress) + Send + Sync>) -> Result<ExportResult, ExportError>;

    /// Cancel in-progress export
    fn cancel(&self) -> bool;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportReadiness {
    pub ready: bool,
    pub coverage_percent: f64,
    pub missing_chunks: Vec<MissingChunkInfo>,
    pub estimated_duration_ms: i64,
    pub estimated_file_size_bytes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingChunkInfo {
    pub page_number: i32,
    pub chunk_index: i32,
    pub text_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub document_id: String,
    pub format: String,
    pub output_path: String,
    pub include_chapters: bool,
    pub chapter_strategy: String,
    pub voice_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub phase: String,
    pub current_chunk: i32,
    pub total_chunks: i32,
    pub percent: f64,
    pub estimated_remaining_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub success: bool,
    pub output_path: String,
    pub format: String,
    pub total_duration_ms: i64,
    pub chapter_count: i32,
    pub file_size_bytes: i64,
    pub exported_at: String,
}

// =============================================================================
// ERROR TYPES
// =============================================================================

#[derive(Debug, Clone)]
pub enum RepositoryError {
    NotFound(String),
    DatabaseError(String),
    ValidationError(String),
    IoError(String),
}

impl std::fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RepositoryError::NotFound(msg) => write!(f, "NOT_FOUND: {}", msg),
            RepositoryError::DatabaseError(msg) => write!(f, "DATABASE_ERROR: {}", msg),
            RepositoryError::ValidationError(msg) => write!(f, "VALIDATION_ERROR: {}", msg),
            RepositoryError::IoError(msg) => write!(f, "IO_ERROR: {}", msg),
        }
    }
}

impl std::error::Error for RepositoryError {}

#[derive(Debug, Clone)]
pub enum ExportError {
    NotReady(String),
    Cancelled,
    WriteError(String),
    PathInvalid(String),
    CacheError(String),
}

impl std::fmt::Display for ExportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExportError::NotReady(msg) => write!(f, "EXPORT_NOT_READY: {}", msg),
            ExportError::Cancelled => write!(f, "EXPORT_CANCELLED"),
            ExportError::WriteError(msg) => write!(f, "EXPORT_WRITE_ERROR: {}", msg),
            ExportError::PathInvalid(msg) => write!(f, "EXPORT_PATH_INVALID: {}", msg),
            ExportError::CacheError(msg) => write!(f, "CACHE_ERROR: {}", msg),
        }
    }
}

impl std::error::Error for ExportError {}
