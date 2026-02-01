//! Port Traits for Hexagonal Architecture
//!
//! These traits define the contracts between the domain/application layers
//! and the infrastructure adapters. They are owned by the core (domain/application)
//! and implemented by adapters.

pub mod audio_cache_repository;
pub mod audio_export_service;
pub mod document_repository;
pub mod highlight_repository;
pub mod session_repository;
pub mod settings_repository;
pub mod tts_engine;

// Re-export main traits and types
pub use audio_cache_repository::{
    AudioCacheRepository, CacheStats, CachedAudioData, EvictionResult, WordTiming,
};
pub use audio_export_service::{AudioExportService, ProgressCallback};
// ExportReadiness and MissingChunkInfo are re-exported from domain::export
pub use document_repository::{Document, DocumentRepository, FileExistsResponse, OrderBy};
pub use highlight_repository::{
    BatchCreateResponse, DeleteResponse, ExportFormat, ExportResponse, Highlight, HighlightCreate,
    HighlightRepository, HighlightUpdate, Rect,
};
pub use session_repository::{
    CreateSessionInput, SessionRepository, SessionRestoreResponse, SessionSummary,
    UpdateSessionDocumentInput, UpdateSessionInput,
};
pub use settings_repository::SettingsRepository;
pub use tts_engine::{TtsCapabilities, TtsChunk, TtsEngine, TtsInitResponse, TtsState, VoiceInfo};

// Re-export mock types for tests (both unit tests and integration tests with test-mocks feature)
#[cfg(any(test, feature = "test-mocks"))]
pub use audio_cache_repository::MockAudioCacheRepository;
#[cfg(any(test, feature = "test-mocks"))]
pub use audio_export_service::MockAudioExportService;
#[cfg(any(test, feature = "test-mocks"))]
pub use document_repository::MockDocumentRepository;
#[cfg(any(test, feature = "test-mocks"))]
pub use highlight_repository::MockHighlightRepository;
#[cfg(any(test, feature = "test-mocks"))]
pub use session_repository::MockSessionRepository;
#[cfg(any(test, feature = "test-mocks"))]
pub use settings_repository::MockSettingsRepository;
#[cfg(any(test, feature = "test-mocks"))]
pub use tts_engine::MockTtsEngine;
