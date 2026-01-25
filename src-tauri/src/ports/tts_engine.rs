//! TTS Engine Port
//!
//! Text-to-speech engine operations.
//! Implemented by: NativeTtsAdapter, ElevenLabsAdapter, MockTtsAdapter

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[cfg(any(test, feature = "test-mocks"))]
use mockall::automock;

use crate::domain::DomainError;

/// Voice metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceInfo {
    pub id: String,
    pub name: String,
    pub language: Option<String>,
}

/// Current state of the TTS engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsState {
    pub initialized: bool,
    pub is_speaking: bool,
    pub is_paused: bool,
    pub current_chunk_id: Option<String>,
    pub current_voice: Option<VoiceInfo>,
    pub rate: f64,
}

impl Default for TtsState {
    fn default() -> Self {
        Self {
            initialized: false,
            is_speaking: false,
            is_paused: false,
            current_chunk_id: None,
            current_voice: None,
            rate: 1.0,
        }
    }
}

/// Response from TTS initialization.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsInitResponse {
    pub available: bool,
    pub backend: Option<String>,
    pub default_voice: Option<String>,
    pub error: Option<String>,
}

/// TTS engine capabilities.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsCapabilities {
    pub supports_utterance: bool,
    pub supports_rate: bool,
    pub supports_pitch: bool,
    pub supports_volume: bool,
}

/// A text chunk for TTS playback.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsChunk {
    pub id: String,
    pub text: String,
}

/// TtsEngine Port
///
/// Text-to-speech engine operations.
/// Implemented by: NativeTtsAdapter, ElevenLabsAdapter, MockTtsAdapter
#[cfg_attr(any(test, feature = "test-mocks"), automock)]
#[async_trait]
pub trait TtsEngine: Send + Sync {
    /// Initialize the TTS engine
    async fn init(&self) -> Result<TtsInitResponse, DomainError>;

    /// List available voices
    async fn list_voices(&self) -> Result<Vec<VoiceInfo>, DomainError>;

    /// Speak a single text chunk
    async fn speak(&self, text: String, chunk_id: Option<String>) -> Result<(), DomainError>;

    /// Speak multiple chunks sequentially (for long content)
    async fn speak_long(&self, chunks: Vec<TtsChunk>) -> Result<(), DomainError>;

    /// Stop all speech
    async fn stop(&self) -> Result<(), DomainError>;

    /// Pause current speech
    async fn pause(&self) -> Result<(), DomainError>;

    /// Resume paused speech
    async fn resume(&self) -> Result<(), DomainError>;

    /// Set the active voice
    async fn set_voice(&self, voice_id: String) -> Result<(), DomainError>;

    /// Set playback rate (0.5 - 3.0)
    async fn set_rate(&self, rate: f64) -> Result<(), DomainError>;

    /// Get current TTS state
    async fn get_state(&self) -> Result<TtsState, DomainError>;

    /// Check engine capabilities
    async fn check_capabilities(&self) -> Result<TtsCapabilities, DomainError>;
}
