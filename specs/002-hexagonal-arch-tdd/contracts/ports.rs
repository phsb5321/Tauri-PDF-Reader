//! Port Traits for Hexagonal Architecture
//!
//! These traits define the contracts between the domain/application layers
//! and the infrastructure adapters. They are owned by the core (domain/application)
//! and implemented by adapters.
//!
//! Generated for: 002-hexagonal-arch-tdd
//! Date: 2026-01-13

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[cfg(test)]
use mockall::automock;

// =============================================================================
// Domain Entities
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub file_path: String,
    pub title: Option<String>,
    pub page_count: Option<i32>,
    pub current_page: i32,
    pub scroll_position: f64,
    pub last_tts_chunk_id: Option<String>,
    pub last_opened_at: Option<String>,
    pub file_hash: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Highlight {
    pub id: String,
    pub document_id: String,
    pub page_number: i32,
    pub rects: Vec<Rect>,
    pub color: String,
    pub text_content: Option<String>,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceInfo {
    pub id: String,
    pub name: String,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsState {
    pub initialized: bool,
    pub is_speaking: bool,
    pub is_paused: bool,
    pub current_chunk_id: Option<String>,
    pub current_voice: Option<VoiceInfo>,
    pub rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsInitResponse {
    pub available: bool,
    pub backend: Option<String>,
    pub default_voice: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsCapabilities {
    pub supports_utterance: bool,
    pub supports_rate: bool,
    pub supports_pitch: bool,
    pub supports_volume: bool,
}

// =============================================================================
// Input/Output DTOs
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightCreate {
    pub document_id: String,
    pub page_number: i32,
    pub rects: Vec<Rect>,
    pub color: String,
    pub text_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightUpdate {
    pub color: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchCreateResponse {
    pub highlights: Vec<Highlight>,
    pub created: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub success: bool,
    pub deleted: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResponse {
    pub content: String,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileExistsResponse {
    pub exists: bool,
    pub file_path: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderBy {
    LastOpened,
    Created,
    Title,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Markdown,
    Json,
    Text,
}

// =============================================================================
// Error Types
// =============================================================================

#[derive(Debug, Clone, thiserror::Error)]
pub enum DomainError {
    #[error("Entity not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("TTS error: {0}")]
    Tts(String),

    #[error("File system error: {0}")]
    FileSystem(String),
}

// =============================================================================
// Port Traits
// =============================================================================

/// DocumentRepository Port
///
/// Manages document persistence operations.
/// Implemented by: SqliteDocumentRepo, MockDocumentRepo
#[cfg_attr(test, automock)]
#[async_trait]
pub trait DocumentRepository: Send + Sync {
    /// Add a new document to the library
    async fn add(
        &self,
        file_path: &str,
        title: Option<&str>,
        page_count: Option<i32>,
    ) -> Result<Document, DomainError>;

    /// Get a document by its content-hash ID
    async fn get_by_id(&self, id: &str) -> Result<Option<Document>, DomainError>;

    /// Get a document by its file path
    async fn get_by_path(&self, path: &str) -> Result<Option<Document>, DomainError>;

    /// List all documents with optional ordering and pagination
    async fn list(
        &self,
        order: OrderBy,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Result<Vec<Document>, DomainError>;

    /// Update reading progress for a document
    async fn update_progress(
        &self,
        id: &str,
        page: i32,
        scroll: Option<f64>,
        tts_chunk: Option<&str>,
    ) -> Result<Document, DomainError>;

    /// Update document title
    async fn update_title(&self, id: &str, title: &str) -> Result<Document, DomainError>;

    /// Relocate a document to a new file path
    async fn relocate(&self, id: &str, new_path: &str) -> Result<Document, DomainError>;

    /// Remove a document from the library
    async fn remove(&self, id: &str) -> Result<(), DomainError>;

    /// Check if a file exists at the given path
    async fn check_file_exists(&self, path: &str) -> Result<FileExistsResponse, DomainError>;
}

/// HighlightRepository Port
///
/// Manages highlight persistence operations.
/// Implemented by: SqliteHighlightRepo, MockHighlightRepo
#[cfg_attr(test, automock)]
#[async_trait]
pub trait HighlightRepository: Send + Sync {
    /// Create a new highlight
    async fn create(&self, input: HighlightCreate) -> Result<Highlight, DomainError>;

    /// Create multiple highlights in a batch
    async fn batch_create(
        &self,
        inputs: Vec<HighlightCreate>,
    ) -> Result<BatchCreateResponse, DomainError>;

    /// Get a highlight by ID
    async fn get_by_id(&self, id: &str) -> Result<Option<Highlight>, DomainError>;

    /// List all highlights for a specific page
    async fn list_for_page(
        &self,
        document_id: &str,
        page_number: i32,
    ) -> Result<Vec<Highlight>, DomainError>;

    /// List all highlights for a document
    async fn list_for_document(&self, document_id: &str) -> Result<Vec<Highlight>, DomainError>;

    /// Update a highlight's color or note
    async fn update(&self, id: &str, input: HighlightUpdate) -> Result<Highlight, DomainError>;

    /// Delete a highlight
    async fn delete(&self, id: &str) -> Result<(), DomainError>;

    /// Delete all highlights for a document
    async fn delete_for_document(&self, document_id: &str) -> Result<DeleteResponse, DomainError>;

    /// Export highlights in various formats
    async fn export(
        &self,
        document_id: &str,
        format: ExportFormat,
    ) -> Result<ExportResponse, DomainError>;
}

/// TtsEngine Port
///
/// Text-to-speech engine operations.
/// Implemented by: NativeTtsAdapter, ElevenLabsAdapter, MockTtsAdapter
#[cfg_attr(test, automock)]
#[async_trait]
pub trait TtsEngine: Send + Sync {
    /// Initialize the TTS engine
    async fn init(&self) -> Result<TtsInitResponse, DomainError>;

    /// List available voices
    async fn list_voices(&self) -> Result<Vec<VoiceInfo>, DomainError>;

    /// Speak a single text chunk
    async fn speak(&self, text: &str, chunk_id: Option<&str>) -> Result<(), DomainError>;

    /// Speak multiple chunks sequentially (for long content)
    async fn speak_long(
        &self,
        chunks: Vec<(String, String)>, // (id, text)
    ) -> Result<(), DomainError>;

    /// Stop all speech
    async fn stop(&self) -> Result<(), DomainError>;

    /// Pause current speech
    async fn pause(&self) -> Result<(), DomainError>;

    /// Resume paused speech
    async fn resume(&self) -> Result<(), DomainError>;

    /// Set the active voice
    async fn set_voice(&self, voice_id: &str) -> Result<(), DomainError>;

    /// Set playback rate (0.5 - 3.0)
    async fn set_rate(&self, rate: f64) -> Result<(), DomainError>;

    /// Get current TTS state
    async fn get_state(&self) -> Result<TtsState, DomainError>;

    /// Check engine capabilities
    async fn check_capabilities(&self) -> Result<TtsCapabilities, DomainError>;
}

/// SettingsRepository Port
///
/// User settings persistence.
/// Implemented by: SqliteSettingsRepo, MockSettingsRepo
#[cfg_attr(test, automock)]
#[async_trait]
pub trait SettingsRepository: Send + Sync {
    /// Get a setting value by key
    async fn get(&self, key: &str) -> Result<Option<String>, DomainError>;

    /// Set a setting value
    async fn set(&self, key: &str, value: &str) -> Result<(), DomainError>;

    /// Get all settings
    async fn get_all(&self) -> Result<Vec<(String, String)>, DomainError>;

    /// Delete a setting
    async fn delete(&self, key: &str) -> Result<(), DomainError>;

    /// Set multiple settings at once
    async fn set_batch(&self, settings: Vec<(String, String)>) -> Result<(), DomainError>;
}

/// FileSystem Port
///
/// File system operations (restricted by Tauri security model).
/// Implemented by: TauriFileSystemAdapter, MockFileSystemAdapter
#[cfg_attr(test, automock)]
#[async_trait]
pub trait FileSystemPort: Send + Sync {
    /// Read file contents
    async fn read_file(&self, path: &str) -> Result<Vec<u8>, DomainError>;

    /// Write file contents
    async fn write_file(&self, path: &str, data: &[u8]) -> Result<(), DomainError>;

    /// Check if file exists
    async fn exists(&self, path: &str) -> Result<bool, DomainError>;

    /// Compute SHA-256 hash of file contents
    async fn hash_file(&self, path: &str) -> Result<String, DomainError>;
}

// =============================================================================
// Application Service Traits (Use Cases)
// =============================================================================

/// LibraryService
///
/// Use cases for document library management.
#[async_trait]
pub trait LibraryService: Send + Sync {
    async fn open_document(&self, file_path: &str) -> Result<Document, DomainError>;
    async fn close_document(&self, id: &str) -> Result<(), DomainError>;
    async fn get_recent_documents(&self, limit: Option<i32>) -> Result<Vec<Document>, DomainError>;
    async fn remove_document(&self, id: &str) -> Result<(), DomainError>;
}

/// ReadingService
///
/// Use cases for document reading and navigation.
#[async_trait]
pub trait ReadingService: Send + Sync {
    async fn go_to_page(&self, document_id: &str, page: i32) -> Result<(), DomainError>;
    async fn update_scroll(&self, document_id: &str, scroll: f64) -> Result<(), DomainError>;
    async fn bookmark_position(&self, document_id: &str) -> Result<(), DomainError>;
}

/// TtsService
///
/// Use cases for text-to-speech playback.
#[async_trait]
pub trait TtsService: Send + Sync {
    async fn start_reading(
        &self,
        document_id: &str,
        from_chunk: Option<&str>,
    ) -> Result<(), DomainError>;
    async fn stop_reading(&self) -> Result<(), DomainError>;
    async fn toggle_pause(&self) -> Result<(), DomainError>;
    async fn skip_to_chunk(&self, chunk_id: &str) -> Result<(), DomainError>;
}
