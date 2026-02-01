//! Audio cache domain module
//!
//! Contains domain entities for TTS audio caching.

pub mod cache_entry;
pub mod coverage;

pub use cache_entry::AudioCacheEntry;
pub use coverage::{CoverageStats, PageCoverageStats};
