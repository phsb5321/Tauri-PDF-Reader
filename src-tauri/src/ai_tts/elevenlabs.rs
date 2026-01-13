//! ElevenLabs API client
//!
//! Provides text-to-speech functionality using the ElevenLabs API.
//! Supports streaming audio generation for low latency playback.

use super::{TtsProvider, VoiceInfo};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const BASE_URL: &str = "https://api.elevenlabs.io/v1";

/// ElevenLabs API client
pub struct ElevenLabsClient {
    client: Client,
    api_key: String,
}

/// Voice settings for TTS generation
#[derive(Debug, Clone, Serialize)]
pub struct VoiceSettings {
    pub stability: f32,
    pub similarity_boost: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_speaker_boost: Option<bool>,
}

impl Default for VoiceSettings {
    fn default() -> Self {
        Self {
            stability: 0.5,
            similarity_boost: 0.75,
            style: None,
            use_speaker_boost: None,
        }
    }
}

/// Request body for text-to-speech
#[derive(Debug, Serialize)]
struct TtsRequest {
    text: String,
    model_id: String,
    voice_settings: VoiceSettings,
}

/// Voice from ElevenLabs API
#[derive(Debug, Deserialize)]
struct ElevenLabsVoice {
    voice_id: String,
    name: String,
    preview_url: Option<String>,
    labels: Option<serde_json::Value>,
}

/// Response from list voices endpoint
#[derive(Debug, Deserialize)]
struct VoicesResponse {
    voices: Vec<ElevenLabsVoice>,
}

/// Error response from ElevenLabs
#[derive(Debug, Deserialize)]
struct ErrorResponse {
    detail: ErrorDetail,
}

#[derive(Debug, Deserialize)]
struct ErrorDetail {
    message: String,
    #[serde(default)]
    status: String,
}

impl ElevenLabsClient {
    /// Create a new ElevenLabs client
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, api_key }
    }

    /// List available voices
    pub async fn list_voices(&self) -> Result<Vec<VoiceInfo>, String> {
        let url = format!("{}/voices", BASE_URL);

        let response = self
            .client
            .get(&url)
            .header("xi-api-key", &self.api_key)
            .send()
            .await
            .map_err(|e| format!("HTTP_ERROR: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            return Err(format!("API_ERROR: {} - {}", status, error_text));
        }

        let voices_response: VoicesResponse = response
            .json()
            .await
            .map_err(|e| format!("PARSE_ERROR: {}", e))?;

        Ok(voices_response
            .voices
            .into_iter()
            .map(|v| VoiceInfo {
                id: v.voice_id,
                name: v.name,
                provider: TtsProvider::ElevenLabs,
                preview_url: v.preview_url,
                labels: v.labels,
            })
            .collect())
    }

    /// Generate speech from text
    ///
    /// Returns raw MP3 audio bytes
    pub async fn text_to_speech(
        &self,
        text: &str,
        voice_id: &str,
        model_id: Option<&str>,
    ) -> Result<Vec<u8>, String> {
        let url = format!("{}/text-to-speech/{}", BASE_URL, voice_id);

        let request = TtsRequest {
            text: text.to_string(),
            model_id: model_id.unwrap_or("eleven_monolingual_v1").to_string(),
            voice_settings: VoiceSettings::default(),
        };

        tracing::debug!(
            "Requesting TTS: {} chars, voice={}, model={}",
            text.len(),
            voice_id,
            request.model_id
        );

        let response = self
            .client
            .post(&url)
            .header("xi-api-key", &self.api_key)
            .header("Content-Type", "application/json")
            .header("Accept", "audio/mpeg")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("HTTP_ERROR: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            // Try to parse as JSON error
            if let Ok(error) = serde_json::from_str::<ErrorResponse>(&error_text) {
                return Err(format!(
                    "API_ERROR: {} - {}",
                    error.detail.status, error.detail.message
                ));
            }

            return Err(format!("API_ERROR: {} - {}", status, error_text));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("DOWNLOAD_ERROR: {}", e))?;

        tracing::debug!("Received {} bytes of audio", bytes.len());

        Ok(bytes.to_vec())
    }

    /// Generate speech with streaming (returns audio chunks as they're generated)
    ///
    /// This is useful for lower latency playback of long text
    pub async fn text_to_speech_stream(
        &self,
        text: &str,
        voice_id: &str,
        model_id: Option<&str>,
    ) -> Result<impl futures::Stream<Item = Result<bytes::Bytes, reqwest::Error>>, String> {
        let url = format!("{}/text-to-speech/{}/stream", BASE_URL, voice_id);

        let request = TtsRequest {
            text: text.to_string(),
            model_id: model_id.unwrap_or("eleven_monolingual_v1").to_string(),
            voice_settings: VoiceSettings::default(),
        };

        let response = self
            .client
            .post(&url)
            .header("xi-api-key", &self.api_key)
            .header("Content-Type", "application/json")
            .header("Accept", "audio/mpeg")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("HTTP_ERROR: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            return Err(format!("API_ERROR: {} - {}", status, error_text));
        }

        Ok(response.bytes_stream())
    }

    /// Get user subscription info (useful for checking quota)
    pub async fn get_subscription_info(&self) -> Result<serde_json::Value, String> {
        let url = format!("{}/user/subscription", BASE_URL);

        let response = self
            .client
            .get(&url)
            .header("xi-api-key", &self.api_key)
            .send()
            .await
            .map_err(|e| format!("HTTP_ERROR: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(format!("API_ERROR: {}", status));
        }

        response
            .json()
            .await
            .map_err(|e| format!("PARSE_ERROR: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_voice_settings_default() {
        let settings = VoiceSettings::default();
        assert_eq!(settings.stability, 0.5);
        assert_eq!(settings.similarity_boost, 0.75);
    }
}
