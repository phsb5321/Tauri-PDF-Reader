//! AI-powered Text-to-Speech module
//!
//! Provides TTS functionality using cloud providers like ElevenLabs.
//! Audio is played directly through the system using rodio.

mod elevenlabs;
mod player;

pub use elevenlabs::ElevenLabsClient;
pub use player::AudioPlayer;

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Supported TTS providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TtsProvider {
    ElevenLabs,
    // Future: OpenAI, Azure, Google, etc.
}

impl Default for TtsProvider {
    fn default() -> Self {
        Self::ElevenLabs
    }
}

/// Voice information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceInfo {
    pub id: String,
    pub name: String,
    pub provider: TtsProvider,
    pub preview_url: Option<String>,
    pub labels: Option<serde_json::Value>,
}

/// TTS configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsConfig {
    pub provider: TtsProvider,
    pub api_key: Option<String>,
    pub voice_id: Option<String>,
    pub model_id: Option<String>,
    pub stability: f32,
    pub similarity_boost: f32,
    pub speed: f32,
}

impl Default for TtsConfig {
    fn default() -> Self {
        Self {
            provider: TtsProvider::ElevenLabs,
            api_key: None,
            voice_id: None,
            model_id: Some("eleven_monolingual_v1".to_string()),
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1.0,
        }
    }
}

/// Current TTS playback state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsState {
    pub is_playing: bool,
    pub is_paused: bool,
    pub current_text: Option<String>,
    pub current_voice_id: Option<String>,
    pub progress: f32, // 0.0 to 1.0
}

impl Default for TtsState {
    fn default() -> Self {
        Self {
            is_playing: false,
            is_paused: false,
            current_text: None,
            current_voice_id: None,
            progress: 0.0,
        }
    }
}

/// Main TTS engine that coordinates providers and playback
pub struct AiTtsEngine {
    config: Arc<RwLock<TtsConfig>>,
    state: Arc<RwLock<TtsState>>,
    player: Arc<AudioPlayer>,
    elevenlabs: Option<ElevenLabsClient>,
}

impl AiTtsEngine {
    pub fn new() -> Self {
        Self {
            config: Arc::new(RwLock::new(TtsConfig::default())),
            state: Arc::new(RwLock::new(TtsState::default())),
            player: Arc::new(AudioPlayer::new()),
            elevenlabs: None,
        }
    }

    /// Initialize with API key
    pub async fn init(&mut self, api_key: String) -> Result<(), String> {
        let client = ElevenLabsClient::new(api_key.clone());

        // Verify API key works by fetching voices
        client
            .list_voices()
            .await
            .map_err(|e| format!("Failed to initialize ElevenLabs: {}", e))?;

        self.elevenlabs = Some(client);

        let mut config = self.config.write().await;
        config.api_key = Some(api_key);

        tracing::info!("AI TTS engine initialized with ElevenLabs");
        Ok(())
    }

    /// Check if initialized
    pub async fn is_initialized(&self) -> bool {
        self.elevenlabs.is_some()
    }

    /// Get available voices
    pub async fn list_voices(&self) -> Result<Vec<VoiceInfo>, String> {
        let client = self
            .elevenlabs
            .as_ref()
            .ok_or("NOT_INITIALIZED: Call init() with API key first")?;

        client.list_voices().await
    }

    /// Speak text
    pub async fn speak(&self, text: &str, voice_id: Option<&str>) -> Result<(), String> {
        let client = self
            .elevenlabs
            .as_ref()
            .ok_or("NOT_INITIALIZED: Call init() with API key first")?;

        let config = self.config.read().await;
        let voice = voice_id
            .map(|s| s.to_string())
            .or_else(|| config.voice_id.clone())
            .ok_or("NO_VOICE: No voice ID specified")?;

        // Update state
        {
            let mut state = self.state.write().await;
            state.is_playing = true;
            state.is_paused = false;
            state.current_text = Some(text.to_string());
            state.current_voice_id = Some(voice.clone());
            state.progress = 0.0;
        }

        // Get audio from ElevenLabs
        let audio_data = client
            .text_to_speech(text, &voice, config.model_id.as_deref())
            .await?;

        // Play audio
        self.player.play_mp3(&audio_data)?;

        // Update state when done
        {
            let mut state = self.state.write().await;
            state.is_playing = false;
            state.progress = 1.0;
        }

        Ok(())
    }

    /// Stop playback
    pub fn stop(&self) -> Result<(), String> {
        self.player.stop()
    }

    /// Pause playback
    pub fn pause(&self) -> Result<(), String> {
        self.player.pause()
    }

    /// Resume playback
    pub fn resume(&self) -> Result<(), String> {
        self.player.resume()
    }

    /// Set voice
    pub async fn set_voice(&self, voice_id: &str) -> Result<(), String> {
        let mut config = self.config.write().await;
        config.voice_id = Some(voice_id.to_string());
        Ok(())
    }

    /// Set speed (0.5 to 2.0)
    pub async fn set_speed(&self, speed: f32) -> Result<(), String> {
        if speed < 0.5 || speed > 2.0 {
            return Err("INVALID_SPEED: Speed must be between 0.5 and 2.0".to_string());
        }
        let mut config = self.config.write().await;
        config.speed = speed;
        Ok(())
    }

    /// Get current state
    pub async fn get_state(&self) -> TtsState {
        self.state.read().await.clone()
    }

    /// Get current config
    pub async fn get_config(&self) -> TtsConfig {
        self.config.read().await.clone()
    }
}

impl Default for AiTtsEngine {
    fn default() -> Self {
        Self::new()
    }
}
