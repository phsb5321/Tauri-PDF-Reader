//! Application Layer
//!
//! Contains application services (use cases) that orchestrate domain logic
//! and interact with ports. This layer is responsible for:
//! - Implementing business use cases
//! - Coordinating between domain entities
//! - Managing transactions and workflows
//!
//! Application services depend on:
//! - Domain entities and logic
//! - Port traits (injected via generics or trait objects)
//!
//! Application services DO NOT depend on:
//! - Infrastructure details (databases, APIs, file systems)
//! - UI/presentation concerns
//! - Specific adapter implementations

pub mod highlight_service;
pub mod library_service;
pub mod settings_service;
pub mod tts_service;

pub use highlight_service::HighlightService;
pub use library_service::LibraryService;
pub use settings_service::SettingsService;
pub use tts_service::TtsService;
