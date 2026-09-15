use crate::adapters::wav::{normalize_streaming_pcm16_wav, validate_pcm16_wav};
use crate::ports::{
    AudioMediaType, SynthesisProvider, SynthesisRequest, SynthesisResult, SynthesisVoice,
    SynthesizerPort,
};
use async_trait::async_trait;
use futures::StreamExt;
use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE},
    Client,
};
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const GROQ_API_BASE: &str = "https://api.groq.com/openai/v1";
pub const GROQ_ORPHEUS_MODEL: &str = "canopylabs/orpheus-v1-english";
const MAX_TEXT_UTF8_BYTES: usize = 200;
const MAX_AUDIO_BYTES: usize = 16 * 1024 * 1024;
const MAX_CONTROL_BYTES: usize = 1024 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const TOTAL_TIMEOUT: Duration = Duration::from_secs(30);

const ENGLISH_VOICES: [(&str, &str); 6] = [
    ("autumn", "Autumn"),
    ("diana", "Diana"),
    ("hannah", "Hannah"),
    ("austin", "Austin"),
    ("daniel", "Daniel"),
    ("troy", "Troy"),
];

#[derive(Debug, Deserialize)]
struct ModelsResponse {
    data: Vec<ModelInfo>,
}

#[derive(Debug, Deserialize)]
struct ModelInfo {
    id: String,
}

#[derive(Debug, Serialize)]
struct SpeechRequest<'a> {
    model: &'static str,
    input: &'a str,
    voice: &'a str,
    response_format: &'static str,
}

pub struct GroqTtsClient {
    client: Client,
    base_url: String,
    voices: Vec<SynthesisVoice>,
}

impl GroqTtsClient {
    pub async fn connect(api_key: &str) -> Result<Self, String> {
        Self::connect_inner(GROQ_API_BASE, api_key).await
    }

    #[cfg(test)]
    async fn connect_for_test(base_url: &str, api_key: &str) -> Result<Self, String> {
        Self::connect_inner(base_url, api_key).await
    }

    async fn connect_inner(base_url: &str, api_key: &str) -> Result<Self, String> {
        if api_key.trim().is_empty() {
            return Err("GROQ_API_KEY_REQUIRED: enter a Groq API key".to_string());
        }
        let mut authorization = HeaderValue::from_str(&format!("Bearer {}", api_key.trim()))
            .map_err(|_| "GROQ_API_KEY_INVALID: key contains invalid header bytes".to_string())?;
        authorization.set_sensitive(true);
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, authorization);
        let client = Client::builder()
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(TOTAL_TIMEOUT)
            .default_headers(headers)
            .build()
            .map_err(|error| format!("GROQ_CLIENT: {error}"))?;
        let base_url = base_url.trim_end_matches('/').to_string();
        let response = client
            .get(format!("{base_url}/models"))
            .send()
            .await
            .map_err(|error| format!("GROQ_UNREACHABLE: {error}"))?;
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err("GROQ_AUTH: API key was rejected".to_string());
        }
        if !response.status().is_success() {
            return Err(format!(
                "GROQ_HTTP_{}: model preflight",
                response.status().as_u16()
            ));
        }
        if response
            .content_length()
            .is_some_and(|length| length > MAX_CONTROL_BYTES as u64)
        {
            return Err("GROQ_MODELS_TOO_LARGE".to_string());
        }
        let mut bytes = Vec::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| format!("GROQ_MODELS_RESPONSE: {error}"))?;
            if bytes.len().saturating_add(chunk.len()) > MAX_CONTROL_BYTES {
                return Err("GROQ_MODELS_TOO_LARGE".to_string());
            }
            bytes.extend_from_slice(&chunk);
        }
        let models: ModelsResponse = serde_json::from_slice(&bytes)
            .map_err(|error| format!("GROQ_MODELS_INVALID_JSON: {error}"))?;
        if !models
            .data
            .iter()
            .any(|model| model.id == GROQ_ORPHEUS_MODEL)
        {
            return Err(format!(
                "GROQ_MODEL_UNAVAILABLE: {GROQ_ORPHEUS_MODEL} is not enabled for this key"
            ));
        }

        Ok(Self {
            client,
            base_url,
            voices: ENGLISH_VOICES
                .iter()
                .map(|(id, name)| SynthesisVoice {
                    id: (*id).to_string(),
                    name: (*name).to_string(),
                    language: Some("en".to_string()),
                    provider: SynthesisProvider::Groq,
                    preview_url: None,
                    labels: Some(serde_json::json!({
                        "model": GROQ_ORPHEUS_MODEL,
                        "markKinds": [],
                        "status": "preview"
                    })),
                })
                .collect(),
        })
    }

    fn validate_text(text: &str) -> Result<(), String> {
        if text.trim().is_empty() {
            return Err("GROQ_EMPTY_TEXT: text is empty".to_string());
        }
        if text.len() > MAX_TEXT_UTF8_BYTES {
            return Err(format!(
                "TEXT_TOO_LONG: Groq accepts at most {MAX_TEXT_UTF8_BYTES} UTF-8 bytes per request"
            ));
        }
        Ok(())
    }
}

#[async_trait]
impl SynthesizerPort for GroqTtsClient {
    fn provider(&self) -> SynthesisProvider {
        SynthesisProvider::Groq
    }

    fn provider_revision(&self) -> &str {
        GROQ_ORPHEUS_MODEL
    }

    fn max_text_utf8_bytes(&self) -> usize {
        MAX_TEXT_UTF8_BYTES
    }

    fn supports_word_timings(&self) -> bool {
        false
    }

    async fn list_voices(&self) -> Result<Vec<SynthesisVoice>, String> {
        Ok(self.voices.clone())
    }

    async fn synthesize(&self, request: SynthesisRequest) -> Result<SynthesisResult, String> {
        Self::validate_text(&request.text)?;
        if !self.voices.iter().any(|voice| voice.id == request.voice_id) {
            return Err(format!("GROQ_UNKNOWN_VOICE: {}", request.voice_id));
        }
        let response = self
            .client
            .post(format!("{}/audio/speech", self.base_url))
            .json(&SpeechRequest {
                model: GROQ_ORPHEUS_MODEL,
                input: &request.text,
                voice: &request.voice_id,
                response_format: "wav",
            })
            .send()
            .await
            .map_err(|error| format!("GROQ_REQUEST: {error}"))?;
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err("GROQ_AUTH: API key was rejected".to_string());
        }
        if !response.status().is_success() {
            return Err(format!("GROQ_HTTP_{}", response.status().as_u16()));
        }
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        if !content_type
            .split(';')
            .next()
            .is_some_and(|media| media.trim().eq_ignore_ascii_case("audio/wav"))
        {
            return Err(format!(
                "GROQ_MEDIA_TYPE: expected audio/wav, got {content_type}"
            ));
        }
        if response
            .content_length()
            .is_some_and(|length| length > MAX_AUDIO_BYTES as u64)
        {
            return Err("GROQ_RESPONSE_TOO_LARGE".to_string());
        }
        let mut audio_data = Vec::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| format!("GROQ_RESPONSE: {error}"))?;
            if audio_data.len().saturating_add(chunk.len()) > MAX_AUDIO_BYTES {
                return Err("GROQ_RESPONSE_TOO_LARGE".to_string());
            }
            audio_data.extend_from_slice(&chunk);
        }
        normalize_streaming_pcm16_wav(&mut audio_data, "GROQ")?;
        let total_duration = validate_pcm16_wav(&audio_data, "GROQ")?;
        Ok(SynthesisResult {
            audio_data,
            media_type: AudioMediaType::Wav,
            word_timings: Vec::new(),
            total_duration,
            provider_revision: GROQ_ORPHEUS_MODEL.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::wav::fixture_pcm_wav;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::{Arc, Mutex};

    fn fixture_key() -> String {
        format!("gsk_{}", "fixture_secret_not_real")
    }

    fn read_request(stream: &mut std::net::TcpStream) -> String {
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        let mut data = Vec::new();
        let mut buffer = [0_u8; 4096];
        loop {
            let read = stream.read(&mut buffer).unwrap();
            data.extend_from_slice(&buffer[..read]);
            if let Some(end) = data.windows(4).position(|window| window == b"\r\n\r\n") {
                let headers = String::from_utf8_lossy(&data[..end]);
                let length = headers
                    .lines()
                    .find_map(|line| {
                        line.to_ascii_lowercase()
                            .strip_prefix("content-length: ")
                            .and_then(|value| value.parse::<usize>().ok())
                    })
                    .unwrap_or(0);
                if data.len() >= end + 4 + length {
                    return String::from_utf8(data).unwrap();
                }
            }
        }
    }

    fn fixture() -> (String, Arc<Mutex<Vec<String>>>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let requests = Arc::new(Mutex::new(Vec::new()));
        let observed = Arc::clone(&requests);
        std::thread::spawn(move || {
            for index in 0..2 {
                let (mut stream, _) = listener.accept().unwrap();
                let request = read_request(&mut stream);
                observed.lock().unwrap().push(request);
                let (content_type, body) = if index == 0 {
                    (
                        "application/json",
                        format!(r#"{{"data":[{{"id":"{GROQ_ORPHEUS_MODEL}"}}]}}"#).into_bytes(),
                    )
                } else {
                    let mut wav = fixture_pcm_wav();
                    wav[4..8].copy_from_slice(&u32::MAX.to_le_bytes());
                    wav[40..44].copy_from_slice(&u32::MAX.to_le_bytes());
                    ("audio/wav", wav)
                };
                write!(
                    stream,
                    "HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                )
                .unwrap();
                stream.write_all(&body).unwrap();
            }
        });
        (url, requests)
    }

    #[tokio::test]
    async fn preflights_model_and_synthesizes_bounded_wav() {
        let (url, requests) = fixture();
        let key = fixture_key();
        let client = GroqTtsClient::connect_for_test(&url, &key).await.unwrap();
        let voices = client.list_voices().await.unwrap();
        assert_eq!(voices.len(), 6);
        assert_eq!(voices[0].id, "autumn");
        assert!(!client.supports_word_timings());
        assert_eq!(client.max_text_utf8_bytes(), 200);

        let result = client
            .synthesize(SynthesisRequest {
                text: "Groq narration.".to_string(),
                voice_id: "hannah".to_string(),
                model_id: None,
                speed: 1.0,
                with_word_timings: true,
            })
            .await
            .unwrap();
        assert_eq!(result.media_type, AudioMediaType::Wav);
        assert!(result.word_timings.is_empty());
        assert!((result.total_duration - 0.1).abs() < 0.000_001);

        let requests = requests.lock().unwrap();
        assert!(requests[0].starts_with("GET /models HTTP/1.1"));
        assert!(requests[0].contains(&format!("authorization: Bearer {key}")));
        assert!(requests[1].starts_with("POST /audio/speech HTTP/1.1"));
        assert!(requests[1].contains(r#""model":"canopylabs/orpheus-v1-english""#));
        assert!(requests[1].contains(r#""voice":"hannah""#));
        assert!(requests[1].contains(r#""response_format":"wav""#));
    }

    #[tokio::test]
    async fn rejects_oversized_utf8_input_before_dispatch() {
        let client = GroqTtsClient {
            client: Client::new(),
            base_url: "http://127.0.0.1:9".to_string(),
            voices: ENGLISH_VOICES
                .iter()
                .map(|(id, name)| SynthesisVoice {
                    id: (*id).to_string(),
                    name: (*name).to_string(),
                    language: Some("en".to_string()),
                    provider: SynthesisProvider::Groq,
                    preview_url: None,
                    labels: None,
                })
                .collect(),
        };
        let error = client
            .synthesize(SynthesisRequest {
                text: "é".repeat(101),
                voice_id: "troy".to_string(),
                model_id: None,
                speed: 1.0,
                with_word_timings: false,
            })
            .await
            .unwrap_err();
        assert!(error.starts_with("TEXT_TOO_LONG:"), "{error}");
    }

    #[tokio::test]
    async fn auth_failure_never_echoes_the_key() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let _ = read_request(&mut stream);
            write!(
                stream,
                "HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            )
            .unwrap();
        });
        let key = fixture_key();
        let error = match GroqTtsClient::connect_for_test(&url, &key).await {
            Ok(_) => panic!("fixture key unexpectedly connected"),
            Err(error) => error,
        };
        assert_eq!(error, "GROQ_AUTH: API key was rejected");
        assert!(!error.contains(&key));
    }
}
