//! ElevenLabs API client
//!
//! Provides text-to-speech functionality using the ElevenLabs API.
//! Supports streaming audio generation for low latency playback.
//!
//! Note: This module is prepared for ElevenLabs TTS integration but not yet active.

#![allow(dead_code)]

use super::{TtsProvider, VoiceInfo};
pub use crate::ports::synthesizer::WordTiming;
use crate::ports::{
    AudioMediaType, SynthesisProvider, SynthesisRequest, SynthesisResult, SynthesisVoice,
    SynthesizerPort,
};
use async_trait::async_trait;
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
    ///
    /// Buffering vs. streaming: the /with-timestamps endpoint returns the audio
    /// as base64 embedded in a JSON body alongside the character alignment, so
    /// the full response is buffered — the word timings cannot be derived from a
    /// partial stream. `text_to_speech_stream` (chunked transfer) is used only
    /// for the plain-playback path. ElevenLabs does expose a chunked
    /// /stream/with-timestamps endpoint (per-chunk audio + alignment); adopting
    /// it for true stream-while-caching on the timestamped path is a future
    /// option, not wired here.
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

            // Advance by UTF-16 code units, NOT bytes: char_start/char_end must
            // index the spoken text the way JS string offsets and DOM Ranges do,
            // so the frontend highlighter (TtsWordHighlight.createWordRange) maps
            // words correctly for non-ASCII text (accents, CJK). For ASCII this
            // equals the byte length, so ASCII behavior is unchanged.
            char_index += char_str.encode_utf16().count();
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

#[async_trait]
impl SynthesizerPort for ElevenLabsClient {
    fn provider(&self) -> SynthesisProvider {
        SynthesisProvider::ElevenLabs
    }

    fn provider_revision(&self) -> &str {
        "eleven_monolingual_v1"
    }

    fn max_text_utf8_bytes(&self) -> usize {
        10_000
    }

    fn supports_word_timings(&self) -> bool {
        true
    }

    async fn list_voices(&self) -> Result<Vec<SynthesisVoice>, String> {
        ElevenLabsClient::list_voices(self).await.map(|voices| {
            voices
                .into_iter()
                .map(|voice| SynthesisVoice {
                    id: voice.id,
                    name: voice.name,
                    language: None,
                    provider: SynthesisProvider::ElevenLabs,
                    preview_url: voice.preview_url,
                    labels: voice.labels,
                })
                .collect()
        })
    }

    async fn synthesize(&self, request: SynthesisRequest) -> Result<SynthesisResult, String> {
        let model_id = request
            .model_id
            .as_deref()
            .unwrap_or_else(|| self.provider_revision());
        if request.with_word_timings {
            let result = self
                .text_to_speech_with_timestamps(&request.text, &request.voice_id, Some(model_id))
                .await?;
            return Ok(SynthesisResult {
                audio_data: result.audio_data,
                media_type: AudioMediaType::Mp3,
                word_timings: result.word_timings,
                total_duration: result.total_duration,
                provider_revision: self.provider_revision().to_string(),
            });
        }
        let audio_data = self
            .text_to_speech(&request.text, &request.voice_id, Some(model_id))
            .await?;
        Ok(SynthesisResult {
            audio_data,
            media_type: AudioMediaType::Mp3,
            word_timings: Vec::new(),
            total_duration: 0.0,
            provider_revision: self.provider_revision().to_string(),
        })
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

    // ---- chars_to_words: word-level timing (karaoke highlight core) ----

    /// Build AlignmentData from (char, start_s, end_s) triples.
    fn align(chars: &[(&str, f64, f64)]) -> AlignmentData {
        AlignmentData {
            characters: chars.iter().map(|(c, _, _)| (*c).to_string()).collect(),
            character_start_times_seconds: chars.iter().map(|(_, s, _)| *s).collect(),
            character_end_times_seconds: chars.iter().map(|(_, _, e)| *e).collect(),
        }
    }

    /// Float compare with tolerance (avoids clippy::float_cmp; times are copied
    /// verbatim from the alignment, so this is exact in practice).
    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-9
    }

    #[test]
    fn chars_to_words_splits_on_space_with_correct_times_and_offsets() {
        // "Hi there"
        let a = align(&[
            ("H", 0.0, 0.10),
            ("i", 0.10, 0.20),
            (" ", 0.20, 0.25),
            ("t", 0.25, 0.30),
            ("h", 0.30, 0.35),
            ("e", 0.35, 0.40),
            ("r", 0.40, 0.45),
            ("e", 0.45, 0.50),
        ]);
        let w = ElevenLabsClient::chars_to_words("Hi there", &a);
        assert_eq!(w.len(), 2);
        assert_eq!(w[0].word, "Hi");
        assert!(close(w[0].start_time, 0.0));
        assert!(close(w[0].end_time, 0.20)); // end of last char before the space
        assert_eq!(w[0].char_start, 0);
        assert_eq!(w[0].char_end, 2);
        assert_eq!(w[1].word, "there");
        assert!(close(w[1].start_time, 0.25));
        assert!(close(w[1].end_time, 0.50));
        assert_eq!(w[1].char_start, 3);
        assert_eq!(w[1].char_end, 8);
    }

    #[test]
    fn chars_to_words_keeps_punctuation_attached() {
        // Non-whitespace punctuation stays part of the word ("Hi," not "Hi").
        let a = align(&[("H", 0.0, 0.1), ("i", 0.1, 0.2), (",", 0.2, 0.3)]);
        let w = ElevenLabsClient::chars_to_words("Hi,", &a);
        assert_eq!(w.len(), 1);
        assert_eq!(w[0].word, "Hi,");
        assert!(close(w[0].end_time, 0.3));
    }

    #[test]
    fn chars_to_words_collapses_multiple_spaces() {
        // Two spaces between words must not produce an empty word.
        let a = align(&[
            ("a", 0.0, 0.1),
            (" ", 0.1, 0.15),
            (" ", 0.15, 0.2),
            ("b", 0.2, 0.3),
        ]);
        let w = ElevenLabsClient::chars_to_words("a  b", &a);
        let words: Vec<&str> = w.iter().map(|t| t.word.as_str()).collect();
        assert_eq!(words, vec!["a", "b"]);
    }

    #[test]
    fn chars_to_words_ignores_leading_and_trailing_whitespace() {
        let a = align(&[(" ", 0.0, 0.1), ("a", 0.1, 0.2), (" ", 0.2, 0.3)]);
        let w = ElevenLabsClient::chars_to_words(" a ", &a);
        assert_eq!(w.len(), 1);
        assert_eq!(w[0].word, "a");
        assert_eq!(w[0].char_start, 1);
        assert_eq!(w[0].char_end, 2);
    }

    #[test]
    fn chars_to_words_treats_newline_as_separator() {
        let a = align(&[("a", 0.0, 0.1), ("\n", 0.1, 0.15), ("b", 0.15, 0.25)]);
        let w = ElevenLabsClient::chars_to_words("a\nb", &a);
        let words: Vec<&str> = w.iter().map(|t| t.word.as_str()).collect();
        assert_eq!(words, vec!["a", "b"]);
    }

    #[test]
    fn chars_to_words_empty_alignment_yields_no_words() {
        let w = ElevenLabsClient::chars_to_words("", &align(&[]));
        assert!(w.is_empty());
    }

    #[test]
    fn chars_to_words_emits_final_word_without_trailing_space() {
        // Exercises the "don't forget the last word" branch.
        let a = align(&[("w", 0.0, 0.1), ("o", 0.1, 0.2), ("w", 0.2, 0.3)]);
        let w = ElevenLabsClient::chars_to_words("wow", &a);
        assert_eq!(w.len(), 1);
        assert_eq!(w[0].word, "wow");
        assert!(close(w[0].start_time, 0.0));
        assert!(close(w[0].end_time, 0.3));
        assert_eq!(w[0].char_start, 0);
        assert_eq!(w[0].char_end, 3);
    }

    #[test]
    fn chars_to_words_uses_utf16_offsets_matching_js_strings() {
        // 'é' is 1 UTF-16 code unit (2 bytes in UTF-8). Offsets are counted in
        // UTF-16 code units so they match JS string indices / DOM Ranges used by
        // the frontend highlighter for non-ASCII text. (Regression guard for the
        // byte-vs-UTF-16 offset bug found in spec 010.)
        let a = align(&[("é", 0.0, 0.1), (" ", 0.1, 0.15), ("x", 0.15, 0.25)]);
        let w = ElevenLabsClient::chars_to_words("é x", &a);
        assert_eq!(w.len(), 2);
        assert_eq!(w[0].word, "é");
        assert_eq!(w[0].char_start, 0);
        assert_eq!(w[0].char_end, 1); // 'é' = 1 UTF-16 code unit
        assert_eq!(w[1].word, "x");
        assert_eq!(w[1].char_start, 2);
        assert_eq!(w[1].char_end, 3);
    }

    // ---- response wire-contract: ElevenLabs /with-timestamps JSON ----
    // The chars_to_words tests above feed hand-built AlignmentData. These assert
    // the API *wire contract* instead: a realistic /with-timestamps JSON body
    // deserializes into our typed model (field names, base64 audio, optional
    // alignment) and flows through chars_to_words exactly as the live adapter
    // does it. The JSON is a fixture — no live API call.

    #[test]
    fn with_timestamps_response_deserializes_and_converts_end_to_end() {
        // Includes `normalized_alignment` (which the real API returns and this
        // adapter ignores) to prove deserialization tolerates the fuller wire
        // shape — i.e. the struct does not strict-parse and reject extra fields.
        let json = r#"{
            "audio_base64": "aGVsbG8=",
            "alignment": {
                "characters": ["H", "i", " ", "y", "o", "u"],
                "character_start_times_seconds": [0.0, 0.10, 0.20, 0.30, 0.45, 0.60],
                "character_end_times_seconds": [0.10, 0.20, 0.30, 0.45, 0.60, 0.80]
            },
            "normalized_alignment": {
                "characters": ["H", "i", " ", "y", "o", "u"],
                "character_start_times_seconds": [0.0, 0.10, 0.20, 0.30, 0.45, 0.60],
                "character_end_times_seconds": [0.10, 0.20, 0.30, 0.45, 0.60, 0.80]
            }
        }"#;

        let resp: TtsWithTimestampsResponse =
            serde_json::from_str(json).expect("with-timestamps body should deserialize");

        // Audio arrives base64-encoded inside the JSON; it must decode to raw bytes.
        use base64::{engine::general_purpose::STANDARD, Engine};
        let audio = STANDARD
            .decode(&resp.audio_base64)
            .expect("audio_base64 should decode");
        assert_eq!(audio, b"hello");

        // Alignment present -> word timings via the same call the adapter makes.
        let alignment = resp.alignment.expect("alignment present");
        let words = ElevenLabsClient::chars_to_words("Hi you", &alignment);

        assert_eq!(words.len(), 2);
        assert_eq!(words[0].word, "Hi");
        assert!(close(words[0].start_time, 0.0));
        assert!(close(words[0].end_time, 0.20)); // end of 'i' (word before the space)
        assert_eq!(words[1].word, "you");
        assert!(close(words[1].start_time, 0.30)); // start of 'y'
        assert!(close(words[1].end_time, 0.80)); // last char end (final word)

        // total_duration the adapter reports is the last character end time.
        let total = alignment
            .character_end_times_seconds
            .last()
            .copied()
            .unwrap_or(0.0);
        assert!(close(total, 0.80));
    }

    #[test]
    fn with_timestamps_response_tolerates_missing_alignment() {
        // ElevenLabs may omit alignment; the Option field must yield None so the
        // adapter returns empty word timings rather than failing to parse.
        let json = r#"{ "audio_base64": "aGVsbG8=" }"#;
        let resp: TtsWithTimestampsResponse =
            serde_json::from_str(json).expect("body without alignment should deserialize");
        assert!(resp.alignment.is_none());
    }
}
