pub mod cache;
pub mod document;
pub mod error;
pub mod errors;
pub mod export;
pub mod highlight;
pub mod sessions;
pub mod settings;
pub mod tts;

pub use cache::{AudioCacheEntry, CoverageStats, PageCoverageStats};
pub use document::{Document, DocumentBuilder};
pub use error::DomainError;
pub use errors::{ExportError, RepositoryError};
pub use export::{ExportOptions, ExportProgress, ExportReadiness, ExportResult, MissingChunkInfo};
pub use highlight::{Highlight, HighlightBuilder, Rect};
pub use sessions::{ReadingSession, SessionDocument};
pub use settings::{SettingKey, SettingsDefaults, SettingsValidator, Theme};
pub use tts::{TextChunk, TextChunkBuilder, TextChunker};
