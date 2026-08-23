use crate::ports::{
    AudioMediaType, SynthesisProvider, SynthesisRequest, SynthesisResult, SynthesisVoice,
    SynthesizerPort,
};
use async_trait::async_trait;
use futures::StreamExt;
use reqwest::{Client, Response};
use rodio::{Decoder, Source};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Cursor;
use std::time::Duration;

pub use crate::config::schema::LOCAL_TTS_URL;

const HARD_MAX_TEXT_UTF8_BYTES: usize = 8_192;
const MAX_AUDIO_BYTES: usize = 64 * 1024 * 1024;
const MAX_CONTROL_RESPONSE_BYTES: usize = 1024 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(2);
const TOTAL_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Deserialize)]
struct HealthResponse {
    ready: bool,
    version: String,
}

#[derive(Debug, Deserialize)]
struct CapabilitiesResponse {
    ready: bool,
    limits: CapabilityLimits,
    tts: TtsCapabilities,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityLimits {
    max_text_utf8_bytes: usize,
}

#[derive(Debug, Deserialize)]
struct TtsCapabilities {
    voices: Vec<CapabilityVoice>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityVoice {
    id: String,
    language: String,
    media_types: Vec<String>,
    mark_kinds: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct LocalTtsRequest<'a> {
    input: &'a str,
    voice: &'a str,
    speed: f32,
}

pub struct LocalTtsClient {
    client: Client,
    base_url: String,
    revision: String,
    max_text_utf8_bytes: usize,
    voices: Vec<SynthesisVoice>,
}

impl LocalTtsClient {
    pub async fn connect(base_url: &str) -> Result<Self, String> {
        Self::validate_base_url(base_url)?;
        Self::connect_inner(base_url).await
    }

    #[cfg(test)]
    async fn connect_for_test(base_url: &str) -> Result<Self, String> {
        Self::connect_inner(base_url).await
    }

    async fn connect_inner(base_url: &str) -> Result<Self, String> {
        let client = Client::builder()
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(TOTAL_TIMEOUT)
            .build()
            .map_err(|error| format!("LOCAL_TTS_CLIENT: {error}"))?;
        let health: HealthResponse = Self::get_json(&client, base_url, "/health").await?;
        if !health.ready || health.version.trim().is_empty() {
            return Err("LOCAL_TTS_NOT_READY: health did not publish a ready revision".to_string());
        }
        let capabilities: CapabilitiesResponse =
            Self::get_json(&client, base_url, "/v1/capabilities").await?;
        if !capabilities.ready {
            return Err("LOCAL_TTS_NOT_READY: capabilities reported not ready".to_string());
        }
        let voices: Vec<SynthesisVoice> = capabilities
            .tts
            .voices
            .into_iter()
            .filter(|voice| voice.media_types.iter().any(|media| media == "audio/wav"))
            .map(|voice| SynthesisVoice {
                name: voice.id.clone(),
                id: voice.id,
                language: Some(voice.language),
                provider: SynthesisProvider::Local,
                preview_url: None,
                labels: Some(serde_json::json!({ "markKinds": voice.mark_kinds })),
            })
            .collect();
        if voices.is_empty() {
            return Err("LOCAL_TTS_NO_VOICES: capability catalog has no WAV voices".to_string());
        }
        let max_text_utf8_bytes = capabilities
            .limits
            .max_text_utf8_bytes
            .min(HARD_MAX_TEXT_UTF8_BYTES);
        if max_text_utf8_bytes == 0 {
            return Err("LOCAL_TTS_INVALID_LIMIT: maxTextUtf8Bytes must be positive".to_string());
        }
        Ok(Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            revision: health.version,
            max_text_utf8_bytes,
            voices,
        })
    }

    async fn get_json<T: for<'de> Deserialize<'de>>(
        client: &Client,
        base_url: &str,
        path: &str,
    ) -> Result<T, String> {
        let response = client
            .get(format!("{}{path}", base_url.trim_end_matches('/')))
            .send()
            .await
            .map_err(|error| format!("LOCAL_TTS_UNREACHABLE: {error}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "LOCAL_TTS_HTTP_{}: {path}",
                response.status().as_u16()
            ));
        }
        if response
            .content_length()
            .is_some_and(|length| length > MAX_CONTROL_RESPONSE_BYTES as u64)
        {
            return Err(format!("LOCAL_TTS_CONTROL_TOO_LARGE: {path}"));
        }
        let mut bytes = Vec::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| format!("LOCAL_TTS_CONTROL: {path}: {error}"))?;
            if bytes.len().saturating_add(chunk.len()) > MAX_CONTROL_RESPONSE_BYTES {
                return Err(format!("LOCAL_TTS_CONTROL_TOO_LARGE: {path}"));
            }
            bytes.extend_from_slice(&chunk);
        }
        serde_json::from_slice(&bytes)
            .map_err(|error| format!("LOCAL_TTS_INVALID_JSON: {path}: {error}"))
    }

    fn validate_base_url(base_url: &str) -> Result<(), String> {
        if base_url == LOCAL_TTS_URL {
            Ok(())
        } else {
            Err(format!(
                "LOCAL_TTS_URL: expected exact destination {LOCAL_TTS_URL}"
            ))
        }
    }

    fn normalized_speed(speed: f32) -> String {
        let rendered = format!("{speed:.6}");
        rendered
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string()
    }

    fn idempotency_key(revision: &str, request: &SynthesisRequest) -> String {
        let canonical = format!(
            "lectrice-local-v1\0{revision}\0{}\0{}\0{}",
            request.voice_id,
            Self::normalized_speed(request.speed),
            request.text
        );
        format!("{:x}", Sha256::digest(canonical.as_bytes()))
    }

    async fn send_synthesis(
        &self,
        body: &LocalTtsRequest<'_>,
        idempotency_key: &str,
    ) -> Result<Response, reqwest::Error> {
        self.client
            .post(format!("{}/v1/tts", self.base_url))
            .header("Idempotency-Key", idempotency_key)
            .json(body)
            .send()
            .await
    }

    fn validate_response_metadata(
        content_type: &str,
        content_length: Option<u64>,
    ) -> Result<(), String> {
        if !content_type
            .split(';')
            .next()
            .is_some_and(|media| media.trim().eq_ignore_ascii_case("audio/wav"))
        {
            return Err(format!(
                "LOCAL_TTS_MEDIA_TYPE: expected audio/wav, got {content_type}"
            ));
        }
        if content_length.is_some_and(|length| length > MAX_AUDIO_BYTES as u64) {
            return Err("LOCAL_TTS_RESPONSE_TOO_LARGE".to_string());
        }
        Ok(())
    }

    fn read_u16(bytes: &[u8], at: usize) -> Result<u16, String> {
        let raw: [u8; 2] = bytes
            .get(at..at + 2)
            .ok_or("LOCAL_TTS_INVALID_WAV: truncated u16")?
            .try_into()
            .map_err(|_| "LOCAL_TTS_INVALID_WAV: truncated u16")?;
        Ok(u16::from_le_bytes(raw))
    }

    fn read_u32(bytes: &[u8], at: usize) -> Result<u32, String> {
        let raw: [u8; 4] = bytes
            .get(at..at + 4)
            .ok_or("LOCAL_TTS_INVALID_WAV: truncated u32")?
            .try_into()
            .map_err(|_| "LOCAL_TTS_INVALID_WAV: truncated u32")?;
        Ok(u32::from_le_bytes(raw))
    }

    fn validate_wav(bytes: &[u8]) -> Result<f64, String> {
        if bytes.len() < 44 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
            return Err("LOCAL_TTS_INVALID_WAV: missing RIFF/WAVE header".to_string());
        }
        let declared = Self::read_u32(bytes, 4)? as usize + 8;
        if declared != bytes.len() {
            return Err("LOCAL_TTS_INVALID_WAV: RIFF size does not match bytes".to_string());
        }
        let mut cursor = 12_usize;
        let mut format = None;
        let mut data_size = None;
        while cursor + 8 <= bytes.len() {
            let id = &bytes[cursor..cursor + 4];
            let size = Self::read_u32(bytes, cursor + 4)? as usize;
            let start = cursor + 8;
            let end = start
                .checked_add(size)
                .ok_or("LOCAL_TTS_INVALID_WAV: chunk size overflow")?;
            if end > bytes.len() {
                return Err("LOCAL_TTS_INVALID_WAV: truncated chunk".to_string());
            }
            if id == b"fmt " {
                if size < 16 {
                    return Err("LOCAL_TTS_INVALID_WAV: short fmt chunk".to_string());
                }
                format = Some((
                    Self::read_u16(bytes, start)?,
                    Self::read_u16(bytes, start + 2)?,
                    Self::read_u32(bytes, start + 4)?,
                    Self::read_u32(bytes, start + 8)?,
                    Self::read_u16(bytes, start + 12)?,
                    Self::read_u16(bytes, start + 14)?,
                ));
            } else if id == b"data" {
                data_size = Some(size);
            }
            cursor = end + (size % 2);
        }
        let (audio_format, channels, sample_rate, byte_rate, block_align, bits) =
            format.ok_or("LOCAL_TTS_INVALID_WAV: fmt chunk missing")?;
        let data_size = data_size.ok_or("LOCAL_TTS_INVALID_WAV: data chunk missing")?;
        if audio_format != 1 || !(1..=2).contains(&channels) || bits != 16 {
            return Err("LOCAL_TTS_INVALID_WAV: only mono/stereo PCM16 is supported".to_string());
        }
        if !(8_000..=96_000).contains(&sample_rate) {
            return Err("LOCAL_TTS_INVALID_WAV: sample rate out of bounds".to_string());
        }
        let expected_align = channels * (bits / 8);
        let expected_rate = sample_rate * u32::from(expected_align);
        if block_align != expected_align
            || byte_rate != expected_rate
            || data_size % usize::from(block_align) != 0
        {
            return Err("LOCAL_TTS_INVALID_WAV: inconsistent PCM format".to_string());
        }
        let duration = data_size as f64 / byte_rate as f64;
        let decoder = Decoder::new(Cursor::new(bytes.to_vec()))
            .map_err(|error| format!("LOCAL_TTS_INVALID_WAV: rodio decode failed: {error}"))?;
        if let Some(decoded) = decoder.total_duration() {
            let tolerance = 1.0 / sample_rate as f64;
            if (decoded.as_secs_f64() - duration).abs() > tolerance {
                return Err("LOCAL_TTS_INVALID_WAV: decoded duration mismatch".to_string());
            }
        }
        Ok(duration)
    }
}

#[async_trait]
impl SynthesizerPort for LocalTtsClient {
    fn provider(&self) -> SynthesisProvider {
        SynthesisProvider::Local
    }

    fn provider_revision(&self) -> &str {
        &self.revision
    }

    fn max_text_utf8_bytes(&self) -> usize {
        self.max_text_utf8_bytes
    }

    fn supports_word_timings(&self) -> bool {
        false
    }

    async fn list_voices(&self) -> Result<Vec<SynthesisVoice>, String> {
        Ok(self.voices.clone())
    }

    async fn synthesize(&self, request: SynthesisRequest) -> Result<SynthesisResult, String> {
        if request.text.trim().is_empty() {
            return Err("LOCAL_TTS_EMPTY_TEXT: text is empty".to_string());
        }
        if request.text.len() > self.max_text_utf8_bytes {
            return Err(format!(
                "TEXT_TOO_LONG: local service accepts at most {} UTF-8 bytes",
                self.max_text_utf8_bytes
            ));
        }
        if !self.voices.iter().any(|voice| voice.id == request.voice_id) {
            return Err(format!("LOCAL_TTS_UNKNOWN_VOICE: {}", request.voice_id));
        }
        if !(0.7..=2.0).contains(&request.speed) {
            return Err("LOCAL_TTS_INVALID_SPEED: service accepts 0.7..=2.0".to_string());
        }
        let body = LocalTtsRequest {
            input: &request.text,
            voice: &request.voice_id,
            speed: request.speed,
        };
        let key = Self::idempotency_key(&self.revision, &request);
        let mut response = self.send_synthesis(&body, &key).await;
        if response.as_ref().is_err_and(reqwest::Error::is_timeout) {
            response = self.send_synthesis(&body, &key).await;
        }
        let response = response.map_err(|error| format!("LOCAL_TTS_REQUEST: {error}"))?;
        if !response.status().is_success() {
            return Err(format!("LOCAL_TTS_HTTP_{}", response.status().as_u16()));
        }
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        Self::validate_response_metadata(content_type, response.content_length())?;
        let mut audio_data = Vec::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| format!("LOCAL_TTS_RESPONSE: {error}"))?;
            if audio_data.len().saturating_add(chunk.len()) > MAX_AUDIO_BYTES {
                return Err("LOCAL_TTS_RESPONSE_TOO_LARGE".to_string());
            }
            audio_data.extend_from_slice(&chunk);
        }
        let total_duration = Self::validate_wav(&audio_data)?;
        Ok(SynthesisResult {
            audio_data,
            media_type: AudioMediaType::Wav,
            word_timings: Vec::new(),
            total_duration,
            provider_revision: self.revision.clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ports::AudioMediaType;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::{mpsc, Arc, Mutex};

    fn pcm_wav() -> Vec<u8> {
        let sample_rate = 16_000_u32;
        let samples = vec![0_i16; 1_600];
        let data_len = (samples.len() * 2) as u32;
        let mut wav = Vec::with_capacity(44 + data_len as usize);
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + data_len).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16_u32.to_le_bytes());
        wav.extend_from_slice(&1_u16.to_le_bytes());
        wav.extend_from_slice(&1_u16.to_le_bytes());
        wav.extend_from_slice(&sample_rate.to_le_bytes());
        wav.extend_from_slice(&(sample_rate * 2).to_le_bytes());
        wav.extend_from_slice(&2_u16.to_le_bytes());
        wav.extend_from_slice(&16_u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_len.to_le_bytes());
        for sample in samples {
            wav.extend_from_slice(&sample.to_le_bytes());
        }
        wav
    }

    fn read_request(stream: &mut std::net::TcpStream) -> String {
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(2)))
            .unwrap();
        let mut data = Vec::new();
        let mut buffer = [0_u8; 4096];
        loop {
            let read = stream.read(&mut buffer).unwrap();
            data.extend_from_slice(&buffer[..read]);
            let headers_end = data.windows(4).position(|w| w == b"\r\n\r\n");
            if let Some(end) = headers_end {
                let headers = String::from_utf8_lossy(&data[..end]);
                let content_length = headers
                    .lines()
                    .find_map(|line| {
                        line.to_ascii_lowercase()
                            .strip_prefix("content-length: ")
                            .and_then(|value| value.parse::<usize>().ok())
                    })
                    .unwrap_or(0);
                if data.len() >= end + 4 + content_length {
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
        let wav = pcm_wav();
        std::thread::spawn(move || {
            for index in 0..3 {
                let (mut stream, _) = listener.accept().unwrap();
                let request = read_request(&mut stream);
                observed.lock().unwrap().push(request);
                let (content_type, body) = match index {
                    0 => (
                        "application/json",
                        br#"{"status":"ok","ready":true,"version":"fixture-1"}"#.to_vec(),
                    ),
                    1 => (
                        "application/json",
                        br#"{"status":"ok","ready":true,"limits":{"maxTextUtf8Bytes":8192},"tts":{"voices":[{"id":"F1-pt","language":"pt-BR","mediaTypes":["audio/wav"],"markKinds":[]}]}}"#.to_vec(),
                    ),
                    _ => ("audio/wav", wav.clone()),
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
    async fn local_contract_connects_lists_and_synthesizes_valid_wav() {
        let (url, requests) = fixture();
        let client = LocalTtsClient::connect_for_test(&url).await.unwrap();
        assert_eq!(client.provider_revision(), "fixture-1");
        assert_eq!(client.max_text_utf8_bytes(), 8192);
        assert!(!client.supports_word_timings());
        assert_eq!(client.list_voices().await.unwrap()[0].id, "F1-pt");

        let result = client
            .synthesize(SynthesisRequest {
                text: "Olá do Lectrice.".to_string(),
                voice_id: "F1-pt".to_string(),
                model_id: None,
                speed: 1.0,
                with_word_timings: false,
            })
            .await
            .unwrap();

        assert_eq!(result.media_type, AudioMediaType::Wav);
        assert!(result.word_timings.is_empty());
        assert!((result.total_duration - 0.1).abs() < 0.000_001);
        let requests = requests.lock().unwrap();
        assert!(requests[2].starts_with("POST /v1/tts HTTP/1.1"));
        assert!(requests[2]
            .to_ascii_lowercase()
            .contains("idempotency-key: "));
        assert!(requests[2].contains("\"input\":\"Olá do Lectrice.\""));
        assert!(requests[2].contains("\"voice\":\"F1-pt\""));
    }

    #[test]
    fn production_url_is_an_exact_whitelist() {
        assert!(LocalTtsClient::validate_base_url(LOCAL_TTS_URL).is_ok());
        for rejected in [
            "http://127.0.0.1:5302",
            "http://localhost:5301",
            "http://10.0.0.5:5301",
            "http://169.254.169.254:5301",
            "https://127.0.0.1:5301",
            "http://user:pass@127.0.0.1:5301",
            "http://127.0.0.1:5301/v1",
        ] {
            assert!(
                LocalTtsClient::validate_base_url(rejected).is_err(),
                "{rejected}"
            );
        }
    }

    #[test]
    fn response_metadata_rejects_wrong_media_and_oversize() {
        assert!(
            LocalTtsClient::validate_response_metadata("audio/wav; charset=binary", Some(44))
                .is_ok()
        );
        assert!(LocalTtsClient::validate_response_metadata("audio/mpeg", Some(44)).is_err());
        assert!(LocalTtsClient::validate_response_metadata(
            "audio/wav",
            Some(MAX_AUDIO_BYTES as u64 + 1)
        )
        .is_err());
    }

    #[test]
    fn wav_validation_rejects_truncation_and_non_pcm() {
        let valid = pcm_wav();
        assert!((LocalTtsClient::validate_wav(&valid).unwrap() - 0.1).abs() < 0.000_001);
        assert!(LocalTtsClient::validate_wav(&valid[..valid.len() - 1]).is_err());
        let mut float = valid;
        float[20..22].copy_from_slice(&3_u16.to_le_bytes());
        assert!(LocalTtsClient::validate_wav(&float).is_err());
    }

    #[tokio::test]
    async fn over_bound_text_fails_before_network_dispatch() {
        let local = LocalTtsClient {
            client: Client::new(),
            base_url: "http://127.0.0.1:9".to_string(),
            revision: "fixture-bound".to_string(),
            max_text_utf8_bytes: 3,
            voices: vec![SynthesisVoice {
                id: "F1-pt".to_string(),
                name: "F1-pt".to_string(),
                language: Some("pt-BR".to_string()),
                provider: SynthesisProvider::Local,
                preview_url: None,
                labels: None,
            }],
        };
        let error = local
            .synthesize(SynthesisRequest {
                text: "four".to_string(),
                voice_id: "F1-pt".to_string(),
                model_id: None,
                speed: 1.0,
                with_word_timings: false,
            })
            .await
            .unwrap_err();
        assert!(error.starts_with("TEXT_TOO_LONG:"), "{error}");
    }

    #[tokio::test(start_paused = true)]
    async fn timeout_retries_exactly_once_then_fails_locally() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}", listener.local_addr().unwrap());
        let accepted = Arc::new(AtomicUsize::new(0));
        let observed = Arc::clone(&accepted);
        let (release_tx, release_rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut held = Vec::new();
            for _ in 0..2 {
                let (stream, _) = listener.accept().unwrap();
                observed.fetch_add(1, Ordering::SeqCst);
                held.push(stream);
            }
            let _ = release_rx.recv();
        });
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(1))
            .timeout(Duration::from_secs(1))
            .build()
            .unwrap();
        let local = LocalTtsClient {
            client,
            base_url,
            revision: "fixture-timeout".to_string(),
            max_text_utf8_bytes: 8_192,
            voices: vec![SynthesisVoice {
                id: "F1-pt".to_string(),
                name: "F1-pt".to_string(),
                language: Some("pt-BR".to_string()),
                provider: SynthesisProvider::Local,
                preview_url: None,
                labels: None,
            }],
        };
        let future = local.synthesize(SynthesisRequest {
            text: "timeout".to_string(),
            voice_id: "F1-pt".to_string(),
            model_id: None,
            speed: 1.0,
            with_word_timings: false,
        });
        tokio::pin!(future);
        assert!(futures::poll!(&mut future).is_pending());
        tokio::time::advance(Duration::from_secs(1)).await;
        for _ in 0..10 {
            tokio::task::yield_now().await;
        }
        tokio::time::advance(Duration::from_secs(1)).await;
        let error = future.await.unwrap_err();
        assert!(error.starts_with("LOCAL_TTS_REQUEST:"), "{error}");
        assert_eq!(accepted.load(Ordering::SeqCst), 2, "one retry only");
        let _ = release_tx.send(());
    }

    #[test]
    fn idempotency_identity_is_stable_and_body_bound() {
        let request = SynthesisRequest {
            text: "Olá".to_string(),
            voice_id: "F1-pt".to_string(),
            model_id: None,
            speed: 1.0,
            with_word_timings: false,
        };
        let first = LocalTtsClient::idempotency_key("fixture-1", &request);
        assert_eq!(first.len(), 64);
        assert_eq!(
            first,
            LocalTtsClient::idempotency_key("fixture-1", &request)
        );
        let mut changed = request.clone();
        changed.text.push('!');
        assert_ne!(
            first,
            LocalTtsClient::idempotency_key("fixture-1", &changed)
        );
    }
}
