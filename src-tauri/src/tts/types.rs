//! TTS Types
//!
//! Data types for TTS operations. These are used for Tauri events
//! and internal state management.

use serde::{Deserialize, Serialize};

/// Current state of the TTS engine
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsStateResponse {
    pub initialized: bool,
    pub is_speaking: bool,
    pub is_paused: bool,
    pub current_chunk_id: Option<String>,
    pub current_voice: Option<String>,
    pub rate: f64,
}

/// TTS engine capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsCapabilities {
    pub supports_pause: bool,
    pub supports_resume: bool,
    pub supports_pitch: bool,
    pub supports_volume: bool,
    pub supports_rate: bool,
    pub min_rate: f64,
    pub max_rate: f64,
}

/// Event emitted when a chunk starts playing
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsChunkEvent {
    pub chunk_index: usize,
    pub total_chunks: usize,
    pub text: String,
}

/// Event emitted when a chunk finishes playing
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsChunkCompletedEvent {
    pub chunk_index: usize,
}

/// Event emitted when all chunks complete
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsCompletedEvent {
    pub success: bool,
}
