//! ElevenLabs API client
//!
//! Provides text-to-speech functionality using the ElevenLabs API.
//! Supports streaming audio generation for low latency playback.
//!
//! Note: This module is prepared for ElevenLabs TTS integration but not yet active.

#![allow(dead_code)]

use super::{TtsProvider, VoiceInfo};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error as StdError;

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

/// Response from TTS with timestamps endpoint
#[derive(Debug, Deserialize)]
struct TtsWithTimestampsResponse {
    audio_base64: String,
    alignment: Option<AlignmentData>,
}

/// Character-level alignment data from ElevenLabs
#[derive(Debug, Deserialize, Clone)]
struct AlignmentData {
    characters: Vec<String>,
    character_start_times_seconds: Vec<f64>,
    character_end_times_seconds: Vec<f64>,
}

/// Word timing information for highlighting
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordTiming {
    pub word: String,
    pub start_time: f64,
    pub end_time: f64,
    pub char_start: usize,
    pub char_end: usize,
}

/// TTS result with audio and word timings
#[derive(Debug, Clone, Serialize)]
pub struct TtsWithTimings {
    pub audio_data: Vec<u8>,
    pub word_timings: Vec<WordTiming>,
    pub total_duration: f64,
}

/// Request body for text-to-speech with timestamps
#[derive(Debug, Serialize)]
struct TtsWithTimestampsRequest {
    text: String,
    model_id: String,
    voice_settings: VoiceSettings,
}

impl ElevenLabsClient {
    /// Create a new ElevenLabs client
    pub fn new(api_key: String) -> Self {
        tracing::info!("Creating ElevenLabs HTTP client with native-tls");

        // ElevenLabs /with-timestamps endpoint can take 60+ seconds for long text
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .connect_timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        tracing::info!("ElevenLabs HTTP client created successfully (timeout: 120s)");
        Self { client, api_key }
    }

    /// List available voices
    pub async fn list_voices(&self) -> Result<Vec<VoiceInfo>, String> {
        let url = format!("{}/voices", BASE_URL);

        tracing::debug!("Fetching voices from: {}", url);

        let response = self
            .client
            .get(&url)
            .header("xi-api-key", &self.api_key)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("HTTP request failed: {:?}", e);
                if let Some(source) = e.source() {
                    tracing::error!("Error source: {:?}", source);
                }
                if e.is_connect() {
                    tracing::error!("Connection error - possible TLS/SSL issue");
                }
                if e.is_timeout() {
                    tracing::error!("Request timed out");
                }
                format!(
                    "HTTP_ERROR: {} (is_connect={}, is_timeout={}, is_request={})",
                    e,
                    e.is_connect(),
                    e.is_timeout(),
                    e.is_request()
                )
            })?;

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

    /// Generate speech with word-level timestamps for karaoke-style highlighting
    ///
    /// Uses ElevenLabs' /with-timestamps endpoint to get character-level timing,
    /// then aggregates into word-level timing for text highlighting.
    pub async fn text_to_speech_with_timestamps(
        &self,
        text: &str,
        voice_id: &str,
        model_id: Option<&str>,
    ) -> Result<TtsWithTimings, String> {
        let url = format!("{}/text-to-speech/{}/with-timestamps", BASE_URL, voice_id);

        let request = TtsWithTimestampsRequest {
            text: text.to_string(),
            model_id: model_id.unwrap_or("eleven_monolingual_v1").to_string(),
            voice_settings: VoiceSettings::default(),
        };

        tracing::info!(
            "Requesting TTS with timestamps: {} chars, voice={}, model={}",
            text.len(),
            voice_id,
            request.model_id
        );

        let start_time = std::time::Instant::now();
        tracing::info!("Sending HTTP POST to {}", url);

        let response = self
            .client
            .post(&url)
            .header("xi-api-key", &self.api_key)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                let elapsed = start_time.elapsed();
                tracing::error!(
                    "HTTP request to {} failed after {:.2}s: {:?}",
                    url,
                    elapsed.as_secs_f64(),
                    e
                );
                if let Some(source) = e.source() {
                    tracing::error!("Error source: {:?}", source);
                }
                if e.is_connect() {
                    tracing::error!("Connection error - possible TLS/SSL issue");
                }
                if e.is_timeout() {
                    tracing::error!(
                        "Request timed out after {:.2}s (timeout is 120s)",
                        elapsed.as_secs_f64()
                    );
                }
                format!(
                    "HTTP_ERROR: {} (is_connect={}, is_timeout={}, is_request={}, elapsed={:.2}s)",
                    e,
                    e.is_connect(),
                    e.is_timeout(),
                    e.is_request(),
                    elapsed.as_secs_f64()
                )
            })?;

        let elapsed = start_time.elapsed();
        tracing::info!(
            "HTTP response received in {:.2}s, status: {}",
            elapsed.as_secs_f64(),
            response.status()
        );

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            if let Ok(error) = serde_json::from_str::<ErrorResponse>(&error_text) {
                return Err(format!(
                    "API_ERROR: {} - {}",
                    error.detail.status, error.detail.message
                ));
            }

            return Err(format!("API_ERROR: {} - {}", status, error_text));
        }

        let tts_response: TtsWithTimestampsResponse = response
            .json()
            .await
            .map_err(|e| format!("PARSE_ERROR: {}", e))?;

        // Decode base64 audio
        use base64::{engine::general_purpose::STANDARD, Engine};
        let audio_data = STANDARD
            .decode(&tts_response.audio_base64)
            .map_err(|e| format!("BASE64_ERROR: {}", e))?;

        tracing::debug!(
            "Received {} bytes of audio with timestamps",
            audio_data.len()
        );

        // Convert character timings to word timings
        let (word_timings, total_duration) = match tts_response.alignment {
            Some(alignment) => {
                let timings = Self::chars_to_words(text, &alignment);
                let duration = alignment
                    .character_end_times_seconds
                    .last()
                    .copied()
                    .unwrap_or(0.0);
                (timings, duration)
            }
            None => {
                tracing::warn!("No alignment data returned from ElevenLabs");
                (Vec::new(), 0.0)
            }
        };

        tracing::debug!(
            "Extracted {} word timings, total duration: {:.2}s",
            word_timings.len(),
            total_duration
        );

        Ok(TtsWithTimings {
            audio_data,
            word_timings,
            total_duration,
        })
    }

    /// Convert character-level timing to word-level timing
    fn chars_to_words(original_text: &str, alignment: &AlignmentData) -> Vec<WordTiming> {
        let mut words: Vec<WordTiming> = Vec::new();
        let mut current_word = String::new();
        let mut word_start_time: Option<f64> = None;
        let mut word_char_start: Option<usize> = None;
        let mut char_index = 0;

        for (i, char_str) in alignment.characters.iter().enumerate() {
            let c = char_str.chars().next().unwrap_or(' ');
            let start_time = alignment
                .character_start_times_seconds
                .get(i)
                .copied()
                .unwrap_or(0.0);
            let end_time = alignment
                .character_end_times_seconds
                .get(i)
                .copied()
                .unwrap_or(0.0);

            if c.is_whitespace() || c == '\n' {
                // End current word if we have one
                if !current_word.is_empty() {
                    if let (Some(start), Some(char_start)) = (word_start_time, word_char_start) {
                        words.push(WordTiming {
                            word: current_word.clone(),
                            start_time: start,
                            end_time: alignment
                                .character_end_times_seconds
                                .get(i.saturating_sub(1))
                                .copied()
                                .unwrap_or(end_time),
                            char_start,
                            char_end: char_index,
                        });
                    }
                    current_word.clear();
                    word_start_time = None;
                    word_char_start = None;
                }
            } else {
                // Start or continue word
                if current_word.is_empty() {
                    word_start_time = Some(start_time);
                    word_char_start = Some(char_index);
                }
                current_word.push(c);
            }

            char_index += char_str.len();
        }

        // Don't forget the last word
        if !current_word.is_empty() {
            if let (Some(start), Some(char_start)) = (word_start_time, word_char_start) {
                let end_time = alignment
                    .character_end_times_seconds
                    .last()
                    .copied()
                    .unwrap_or(0.0);
                words.push(WordTiming {
                    word: current_word,
                    start_time: start,
                    end_time,
                    char_start,
                    char_end: char_index,
                });
            }
        }

        // Validate against original text
        tracing::debug!(
            "Parsed {} words from {} characters (original text: {} chars)",
            words.len(),
            alignment.characters.len(),
            original_text.len()
        );

        words
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
