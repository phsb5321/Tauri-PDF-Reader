//! Tauri API Layer
//!
//! Contains thin Tauri command handlers that:
//! - Parse and validate input from the frontend
//! - Delegate to application services
//! - Map results to frontend-friendly responses
//!
//! Command handlers MUST:
//! - Be thin (max ~10-15 lines)
//! - NOT contain business logic
//! - Use #[specta::specta] for type generation
//!
//! Command handlers depend on:
//! - Application services (via Tauri managed state)
//! - Domain types (for input/output)
//!
//! Command handlers DO NOT depend on:
//! - Database details
//! - Adapter implementations directly
//! - Complex business logic

pub mod settings;

pub use settings::{
    settings_delete_v2, settings_get_all_v2, settings_get_v2, settings_set_batch_v2,
    settings_set_v2,
};
