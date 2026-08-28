use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum SynthesisProvider {
    #[default]
    ElevenLabs,
    Local,
    Groq,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRuntimeInfo {
    pub provider_revision: String,
    pub model: Option<String>,
    pub model_revision: Option<String>,
    pub quantization: Option<String>,
    pub backend: Option<String>,
    pub device: Option<String>,
    pub acceleration: Option<String>,
    pub queue_capacity: Option<usize>,
    pub chunk_max_utf8_bytes: usize,
}

#[derive(Debug, Clone)]
pub struct SynthesisRequest {
    pub text: String,
    pub voice_id: String,
    pub model_id: Option<String>,
    pub speed: f32,
    pub with_word_timings: bool,
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
    fn runtime_info(&self) -> ProviderRuntimeInfo {
        ProviderRuntimeInfo {
            provider_revision: self.provider_revision().to_string(),
            model: None,
            model_revision: None,
            quantization: None,
            backend: None,
            device: None,
            acceleration: None,
            queue_capacity: None,
            chunk_max_utf8_bytes: self.max_text_utf8_bytes(),
        }
    }
    async fn list_voices(&self) -> Result<Vec<SynthesisVoice>, String>;
    async fn synthesize(&self, request: SynthesisRequest) -> Result<SynthesisResult, String>;
}
