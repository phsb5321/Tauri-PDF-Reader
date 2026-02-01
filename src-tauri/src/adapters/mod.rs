//! Adapters Layer
//!
//! Contains concrete implementations of port traits. Adapters connect
//! the application to external systems:
//! - Databases (SQLite)
//! - File systems
//! - TTS engines (native, ElevenLabs)
//! - External APIs
//! - Audio caching
//!
//! Adapters implement:
//! - Port traits from the ports module
//!
//! Adapters depend on:
//! - Port trait definitions
//! - Domain types
//! - External libraries (sqlx, tts, reqwest, etc.)
//!
//! Adapters DO NOT depend on:
//! - Other adapters
//! - Application services
//! - Tauri command handlers

pub mod audio_cache;
pub mod sqlite;

pub use audio_cache::{AudioCacheAdapter, CacheInfo, CachedTtsData, CachedWordTiming, ClearResult};
pub use sqlite::{SqliteAudioCacheRepo, SqliteSessionRepo, SqliteSettingsRepo};
