//! Reading session domain module
//!
//! Contains domain entities for reading session management.

pub mod session;

pub use session::{
    ReadingSession, SessionDocument, SessionSummary, MAX_DOCUMENTS_PER_SESSION,
    SESSION_NAME_MAX_LENGTH, SESSION_NAME_MIN_LENGTH,
};
