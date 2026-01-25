pub mod document;
pub mod error;
pub mod highlight;
pub mod settings;
pub mod tts;

pub use document::{Document, DocumentBuilder};
pub use error::DomainError;
pub use highlight::{Highlight, HighlightBuilder, Rect};
pub use settings::{SettingKey, SettingsDefaults, SettingsValidator, Theme};
pub use tts::{TextChunk, TextChunkBuilder, TextChunker};
