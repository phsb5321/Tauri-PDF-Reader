use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SynthesisProvider {
    ElevenLabs,
    Local,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AudioMediaType {
    Mp3,
    Wav,
}

impl AudioMediaType {
    pub fn extension(self) -> &'static str {
        match self {
            Self::Mp3 => "mp3",
            Self::Wav => "wav",
        }
    }

    pub fn content_type(self) -> &'static str {
        match self {
            Self::Mp3 => "audio/mpeg",
            Self::Wav => "audio/wav",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynthesisVoice {
    pub id: String,
    pub name: String,
    pub language: Option<String>,
    pub provider: SynthesisProvider,
    pub preview_url: Option<String>,
    pub labels: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordTiming {
    pub word: String,
    pub start_time: f64,
    pub end_time: f64,
    pub char_start: usize,
    pub char_end: usize,
}

#[derive(Debug, Clone)]
pub struct SynthesisRequest {
    pub text: String,
    pub voice_id: String,
    pub speed: f32,
}

#[derive(Debug, Clone)]
pub struct SynthesisResult {
    pub audio_data: Vec<u8>,
    pub media_type: AudioMediaType,
    pub word_timings: Vec<WordTiming>,
    pub total_duration: f64,
    pub provider_revision: String,
}

#[async_trait]
pub trait SynthesizerPort: Send + Sync {
    fn provider(&self) -> SynthesisProvider;
    fn provider_revision(&self) -> &str;
    fn max_text_utf8_bytes(&self) -> usize;
    fn supports_word_timings(&self) -> bool;
    async fn list_voices(&self) -> Result<Vec<SynthesisVoice>, String>;
    async fn synthesize(&self, request: SynthesisRequest) -> Result<SynthesisResult, String>;
}
