//! TTS Module
//!
//! Native text-to-speech functionality wrapping platform TTS engines.

pub mod chunking;
pub mod engine;
pub mod types;

pub use engine::TtsEngine;
pub use types::{TtsCapabilities, TtsStateResponse};
