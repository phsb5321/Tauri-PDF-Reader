//! SQLite Adapter Module
//!
//! Contains adapters that implement repository ports using SQLite.

pub mod settings_repo;

pub use settings_repo::SqliteSettingsRepo;
