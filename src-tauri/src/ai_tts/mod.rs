//! AI-powered Text-to-Speech module
//!
//! Provides TTS functionality using cloud providers like ElevenLabs.
//! Audio is played directly through the system using rodio.
//! Includes audio caching for instant playback of previously generated audio.

mod elevenlabs;
mod player;
mod stretch; // pitch-preserving playback speed (spec 039)

pub use elevenlabs::{
    ElevenLabsClient, TtsWithTimings, WordTiming, ELEVEN_DEFAULT_MODEL_ID,
    ELEVEN_PROSODY_COMPILER_REVISION,
};
pub use player::AudioPlayer;

use crate::adapters::{
    wav::{equalize_pcm16_wav_boundary, PCM_PROSODY_REVISION},
    AudioCacheAdapter, CacheInfo, CachedWordTiming, ClearResult, LocalTtsClient,
};
use crate::ports::{
    AudioMediaType, ProviderRuntimeInfo, SynthesisProvider, SynthesisRequest, SynthesisResult,
    SynthesisVoice, SynthesizerPort,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{watch, Mutex, RwLock};

/// Cache contract shared with `src/lib/prosody-plan.ts`.
const SOURCE_PROSODY_REVISION: &str = "source-aligned-v4";

/// Supported TTS providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "lowercase")]
pub enum TtsProvider {
    #[default]
    ElevenLabs,
    Local,
    Groq,
}

impl From<SynthesisProvider> for TtsProvider {
    fn from(provider: SynthesisProvider) -> Self {
        match provider {
            SynthesisProvider::ElevenLabs => Self::ElevenLabs,
            SynthesisProvider::Local => Self::Local,
            SynthesisProvider::Groq => Self::Groq,
        }
    }
}

/// Provider-neutral boundary class selected by the source/spoken planner.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ProsodyBoundary {
    Clause,
    Sentence,
    Paragraph,
    Section,
}

impl ProsodyBoundary {
    fn target_ms(self) -> usize {
        match self {
            Self::Clause => 200,
            Self::Sentence => 350,
            Self::Paragraph => 650,
            Self::Section => 800,
        }
    }

    fn cache_coordinate(self) -> &'static str {
        match self {
            Self::Clause => "clause",
            Self::Sentence => "sentence",
            Self::Paragraph => "paragraph",
            Self::Section => "section",
        }
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
            voice_id: None,
            model_id: Some(ELEVEN_DEFAULT_MODEL_ID.to_string()),
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
    pub progress: f32,
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LastSynthesisPerformance {
    pub request_utf8_bytes: usize,
    pub generation_ms: f64,
    pub audio_duration: f64,
    pub standard_rtf: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TtsPerformanceSnapshot {
    pub provider: TtsProvider,
    pub supports_word_timings: bool,
    pub max_text_utf8_bytes: usize,
    pub runtime: ProviderRuntimeInfo,
    pub latest_uncached: Option<LastSynthesisPerformance>,
}

/// Result of pre-buffering TTS audio
pub struct PrebufferResult {
    pub was_cached: bool,
    pub word_count: usize,
    pub total_duration: f64,
}

#[derive(Clone)]
struct ProviderConnection {
    synthesizer: Arc<dyn SynthesizerPort>,
    voices: Vec<SynthesisVoice>,
}

#[derive(Default)]
struct ProviderRegistry {
    active: Option<TtsProvider>,
    connections: HashMap<TtsProvider, ProviderConnection>,
}

#[cfg(feature = "e2e-tts-fixture")]
struct FixtureSynthesizer {
    provider: SynthesisProvider,
}

#[cfg(feature = "e2e-tts-fixture")]
#[async_trait::async_trait]
impl SynthesizerPort for FixtureSynthesizer {
    fn provider(&self) -> SynthesisProvider {
        self.provider
    }

    fn provider_revision(&self) -> &str {
        "e2e-fixture-1"
    }

    fn max_text_utf8_bytes(&self) -> usize {
        match self.provider {
            SynthesisProvider::Groq => 200,
            SynthesisProvider::Local => 300,
            SynthesisProvider::ElevenLabs => 10_000,
        }
    }

    fn supports_word_timings(&self) -> bool {
        self.provider == SynthesisProvider::ElevenLabs
    }

    fn runtime_info(&self) -> ProviderRuntimeInfo {
        if self.provider == SynthesisProvider::Local {
            ProviderRuntimeInfo {
                provider_revision: self.provider_revision().to_string(),
                model: Some("Magpie packaged fixture".to_string()),
                model_revision: Some("fixture-model".to_string()),
                quantization: Some("Q6_K".to_string()),
                backend: Some("Vulkan/RADV fixture".to_string()),
                device: Some("Fixture GPU".to_string()),
                acceleration: Some("gpu".to_string()),
                queue_capacity: Some(1),
                chunk_max_utf8_bytes: 300,
            }
        } else {
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
    }

    async fn list_voices(&self) -> Result<Vec<SynthesisVoice>, String> {
        let ids: &[&str] = if self.provider == SynthesisProvider::Groq {
            &["autumn", "diana", "hannah", "austin", "daniel", "troy"]
        } else {
            &["e2e-fixture-voice"]
        };
        Ok(ids
            .iter()
            .map(|id| SynthesisVoice {
                id: (*id).to_string(),
                name: (*id).to_string(),
                language: Some("en".to_string()),
                provider: self.provider,
                preview_url: None,
                labels: None,
            })
            .collect())
    }

    async fn synthesize(
        &self,
        _request: SynthesisRequest,
    ) -> Result<crate::ports::SynthesisResult, String> {
        Err("E2E_FIXTURE: synthesis is handled by the command fixture".to_string())
    }
}

pub struct PreparedTtsWithTimings {
    pub output: TtsWithTimings,
    pub generation: u64,
}

/// Main TTS engine that coordinates connected providers and playback.
pub struct AiTtsEngine {
    config: Arc<RwLock<TtsConfig>>,
    state: Arc<RwLock<TtsState>>,
    player: Arc<AudioPlayer>,
    providers: Arc<RwLock<ProviderRegistry>>,
    playback_gate: Arc<Mutex<()>>,
    playback_generation: Arc<AtomicU64>,
    cancel_tx: watch::Sender<u64>,
    performance: Arc<RwLock<HashMap<TtsProvider, LastSynthesisPerformance>>>,
    cache: Option<AudioCacheAdapter>,
}

impl AiTtsEngine {
    pub fn new() -> Self {
        Self::with_player(AudioPlayer::new())
    }

    fn with_player(player: AudioPlayer) -> Self {
        let (cancel_tx, _) = watch::channel(0_u64);
        Self {
            config: Arc::new(RwLock::new(TtsConfig::default())),
            state: Arc::new(RwLock::new(TtsState::default())),
            player: Arc::new(player),
            providers: Arc::new(RwLock::new(ProviderRegistry::default())),
            playback_gate: Arc::new(Mutex::new(())),
            playback_generation: Arc::new(AtomicU64::new(0)),
            cancel_tx,
            performance: Arc::new(RwLock::new(HashMap::new())),
            cache: None,
        }
    }

    #[cfg(test)]
    fn for_test() -> Self {
        Self::with_player(AudioPlayer::for_test())
    }

    /// Rebuild the audio player so it invokes `on_finished` when playback ends
    /// naturally (the sink drains without an explicit stop). Wired in `lib.rs`
    /// setup to emit `ai-tts:finished`, so the frontend completes on the real
    /// audio-end signal instead of a timer estimate.
    ///
    /// Called once at startup before any playback, so swapping the player (the
    /// `new()` one was idle) is safe — its dropped thread joins cleanly.
    pub fn set_finished_callback(&mut self, on_finished: Box<dyn Fn(u64) + Send>) {
        let playback_generation = Arc::clone(&self.playback_generation);
        self.player = Arc::new(AudioPlayer::with_finished_callback(Box::new(move || {
            on_finished(playback_generation.load(Ordering::Acquire));
        })));
    }

    /// Initialize cache with app cache directory
    pub fn init_cache(&mut self, cache_dir: PathBuf) {
        self.cache = Some(AudioCacheAdapter::new(cache_dir));
        tracing::info!("TTS audio cache initialized");
    }

    /// Initialize and register an ElevenLabs connection. Credentials remain
    /// inside the provider client and are never copied into readable config.
    pub async fn init(&self, api_key: String) -> Result<(), String> {
        let client = Arc::new(ElevenLabsClient::new(api_key));
        let voices = SynthesizerPort::list_voices(client.as_ref())
            .await
            .map_err(|error| format!("Failed to initialize ElevenLabs: {error}"))?;
        self.install_provider(client, voices).await?;
        tracing::info!("AI TTS engine connected ElevenLabs");
        Ok(())
    }

    /// Install a preflighted local client without replacing other connections.
    pub async fn install_local(&self, client: LocalTtsClient) -> Result<(), String> {
        let client = Arc::new(client);
        let voices = client.list_voices().await?;
        self.install_provider(client, voices).await?;
        tracing::info!("AI TTS engine connected local provider");
        Ok(())
    }

    /// Install a preflighted Groq client without replacing other connections.
    pub async fn install_groq(&self, client: crate::adapters::GroqTtsClient) -> Result<(), String> {
        let client = Arc::new(client);
        let voices = client.list_voices().await?;
        self.install_provider(client, voices).await?;
        tracing::info!("AI TTS engine connected Groq");
        Ok(())
    }

    #[cfg(feature = "e2e-tts-fixture")]
    pub async fn install_fixture(&self, provider: TtsProvider) -> Result<(), String> {
        let synthesis_provider = match provider {
            TtsProvider::ElevenLabs => SynthesisProvider::ElevenLabs,
            TtsProvider::Local => SynthesisProvider::Local,
            TtsProvider::Groq => SynthesisProvider::Groq,
        };
        let synthesizer = Arc::new(FixtureSynthesizer {
            provider: synthesis_provider,
        });
        let voices = synthesizer.list_voices().await?;
        self.install_provider(synthesizer, voices).await
    }

    async fn install_provider(
        &self,
        synthesizer: Arc<dyn SynthesizerPort>,
        voices: Vec<SynthesisVoice>,
    ) -> Result<(), String> {
        let first_voice = voices
            .first()
            .map(|voice| voice.id.clone())
            .ok_or("TTS_NO_VOICES: provider returned no voices")?;
        let provider = TtsProvider::from(synthesizer.provider());
        let activate = {
            let mut registry = self.providers.write().await;
            let activate = registry.active.is_none() || registry.active == Some(provider);
            registry.connections.insert(
                provider,
                ProviderConnection {
                    synthesizer,
                    voices: voices.clone(),
                },
            );
            if activate {
                registry.active = Some(provider);
            }
            activate
        };
        if activate {
            let mut config = self.config.write().await;
            config.provider = provider;
            if !voices
                .iter()
                .any(|voice| config.voice_id.as_deref() == Some(&voice.id))
            {
                config.voice_id = Some(first_voice);
            }
        }
        Ok(())
    }

    pub async fn switch_provider(&self, provider: TtsProvider) -> Result<(), String> {
        let _gate = self.playback_gate.lock().await;
        self.cancel_synthesis();
        self.player.stop()?;
        let voices = {
            let mut registry = self.providers.write().await;
            let connection = registry
                .connections
                .get(&provider)
                .cloned()
                .ok_or_else(|| {
                    format!("TTS_PROVIDER_NOT_CONNECTED: {provider:?} is not connected")
                })?;
            registry.active = Some(provider);
            connection.voices
        };
        let mut config = self.config.write().await;
        config.provider = provider;
        if !voices
            .iter()
            .any(|voice| config.voice_id.as_deref() == Some(&voice.id))
        {
            config.voice_id = voices.first().map(|voice| voice.id.clone());
        }
        let player_speed = if provider == TtsProvider::Local {
            1.0
        } else {
            config.speed
        };
        self.player.set_speed(player_speed)?;
        drop(config);
        let mut state = self.state.write().await;
        state.is_playing = false;
        state.is_paused = false;
        state.current_text = None;
        state.current_voice_id = None;
        Ok(())
    }

    /// Check if an active provider is connected.
    pub async fn is_initialized(&self) -> bool {
        self.providers.read().await.active.is_some()
    }

    #[cfg(test)]
    pub async fn connected_providers(&self) -> Vec<TtsProvider> {
        let registry = self.providers.read().await;
        [
            TtsProvider::Local,
            TtsProvider::ElevenLabs,
            TtsProvider::Groq,
        ]
        .into_iter()
        .filter(|provider| registry.connections.contains_key(provider))
        .collect()
    }

    #[cfg(any(test, feature = "e2e-tts-fixture"))]
    pub async fn active_provider(&self) -> Option<TtsProvider> {
        self.providers.read().await.active
    }

    pub async fn provider_capabilities(
        &self,
        provider: TtsProvider,
    ) -> Option<(bool, usize, usize)> {
        self.providers
            .read()
            .await
            .connections
            .get(&provider)
            .map(|connection| {
                (
                    connection.synthesizer.supports_word_timings(),
                    connection.synthesizer.max_text_utf8_bytes(),
                    connection.voices.len(),
                )
            })
    }

    pub async fn performance_snapshot(&self) -> Option<TtsPerformanceSnapshot> {
        let (provider, connection) = {
            let registry = self.providers.read().await;
            let provider = registry.active?;
            let connection = registry.connections.get(&provider)?.clone();
            (provider, connection)
        };
        let latest_uncached = self.performance.read().await.get(&provider).cloned();
        Some(TtsPerformanceSnapshot {
            provider,
            supports_word_timings: connection.synthesizer.supports_word_timings(),
            max_text_utf8_bytes: connection.synthesizer.max_text_utf8_bytes(),
            runtime: connection.synthesizer.runtime_info(),
            latest_uncached,
        })
    }

    fn voice_info(voice: SynthesisVoice) -> VoiceInfo {
        VoiceInfo {
            id: voice.id,
            name: voice.name,
            provider: TtsProvider::from(voice.provider),
            preview_url: voice.preview_url,
            labels: voice.labels,
        }
    }

    async fn active_connection(&self) -> Option<ProviderConnection> {
        let registry = self.providers.read().await;
        registry
            .active
            .and_then(|provider| registry.connections.get(&provider).cloned())
    }

    /// Get the active provider's available voices from its preflighted catalog.
    pub async fn list_voices(&self) -> Result<Vec<VoiceInfo>, String> {
        self.active_connection()
            .await
            .ok_or_else(|| "NOT_INITIALIZED: initialize a TTS provider first".to_string())
            .map(|connection| {
                connection
                    .voices
                    .into_iter()
                    .map(Self::voice_info)
                    .collect()
            })
    }

    async fn synthesis_context(
        &self,
    ) -> Result<(u64, ProviderConnection, watch::Receiver<u64>), String> {
        // Subscribe before reading the active connection. A concurrent switch
        // therefore either selects the new provider or changes this receiver
        // and cancels the old snapshot; it cannot escape between the two.
        let cancelled = self.cancel_tx.subscribe();
        let generation = *cancelled.borrow();
        let connection = self
            .active_connection()
            .await
            .ok_or("NOT_INITIALIZED: initialize a TTS provider first")?;
        Ok((generation, connection, cancelled))
    }

    async fn synthesize_with(
        &self,
        provider: Arc<dyn SynthesizerPort>,
        request: SynthesisRequest,
        mut cancelled: watch::Receiver<u64>,
    ) -> Result<crate::ports::SynthesisResult, String> {
        let provider_kind = TtsProvider::from(provider.provider());
        let request_utf8_bytes = request.text.len();
        let started = Instant::now();
        let result = tokio::select! {
            result = provider.synthesize(request) => result,
            changed = cancelled.changed() => {
                let _ = changed;
                Err("TTS_CANCELLED: synthesis was cancelled".to_string())
            }
        };
        if let Ok(output) = &result {
            if !output.from_cache {
                let generation_ms = started.elapsed().as_secs_f64() * 1000.0;
                let standard_rtf = (output.total_duration > 0.0)
                    .then_some(generation_ms / 1000.0 / output.total_duration);
                self.performance.write().await.insert(
                    provider_kind,
                    LastSynthesisPerformance {
                        request_utf8_bytes,
                        generation_ms,
                        audio_duration: output.total_duration,
                        standard_rtf,
                    },
                );
            }
        }
        result
    }

    #[cfg(test)]
    async fn synthesize(
        &self,
        request: SynthesisRequest,
    ) -> Result<crate::ports::SynthesisResult, String> {
        let (_, connection, cancelled) = self.synthesis_context().await?;
        self.synthesize_with(connection.synthesizer, request, cancelled)
            .await
    }

    fn inferred_boundary(text: &str) -> ProsodyBoundary {
        let ending = text.trim_end().trim_end_matches(['"', '\'', ')', ']']);
        if ending.ends_with(['.', '!', '?', '…']) {
            ProsodyBoundary::Sentence
        } else {
            ProsodyBoundary::Clause
        }
    }

    fn apply_wav_prosody(
        text: &str,
        boundary_after: Option<ProsodyBoundary>,
        mut result: SynthesisResult,
    ) -> Result<SynthesisResult, String> {
        if result.media_type != AudioMediaType::Wav || !result.word_timings.is_empty() {
            return Ok(result);
        }
        let target = boundary_after
            .unwrap_or_else(|| Self::inferred_boundary(text))
            .target_ms();
        let (audio_data, stats) =
            equalize_pcm16_wav_boundary(&result.audio_data, target, "TTS_PROSODY")?;
        result.audio_data = audio_data;
        result.total_duration = stats.total_duration;
        result.provider_revision = format!("{}+{PCM_PROSODY_REVISION}", result.provider_revision);
        tracing::debug!(
            activity_found = stats.activity_found,
            leading_ms = stats.leading_ms,
            trailing_ms = stats.trailing_ms,
            target_ms = target,
            "normalized no-mark WAV boundary"
        );
        Ok(result)
    }

    fn cache_coordinates(
        provider: &dyn SynthesizerPort,
        text: &str,
        voice: &str,
        config: &TtsConfig,
        with_word_timings: bool,
        boundary_after: Option<ProsodyBoundary>,
    ) -> (String, AudioMediaType) {
        let boundary_coordinate = boundary_after
            .unwrap_or_else(|| Self::inferred_boundary(text))
            .cache_coordinate();
        match provider.provider() {
            SynthesisProvider::ElevenLabs => {
                let model_id = config
                    .model_id
                    .clone()
                    .unwrap_or_else(|| ELEVEN_DEFAULT_MODEL_ID.to_string());
                let suffix = if with_word_timings { "_ts" } else { "" };
                let settings_hash = format!(
                    "{:.2}_{:.2}_{ELEVEN_PROSODY_COMPILER_REVISION}_{SOURCE_PROSODY_REVISION}{suffix}",
                    config.stability, config.similarity_boost
                );
                (
                    AudioCacheAdapter::generate_cache_key(text, voice, &model_id, &settings_hash),
                    AudioMediaType::Mp3,
                )
            }
            SynthesisProvider::Local => {
                let settings_hash = format!(
                    "local_{}_{}_{}_{}_{}",
                    config.speed,
                    AudioMediaType::Wav.content_type(),
                    PCM_PROSODY_REVISION,
                    SOURCE_PROSODY_REVISION,
                    boundary_coordinate
                );
                (
                    AudioCacheAdapter::generate_cache_key(
                        text,
                        voice,
                        provider.provider_revision(),
                        &settings_hash,
                    ),
                    AudioMediaType::Wav,
                )
            }
            SynthesisProvider::Groq => (
                AudioCacheAdapter::generate_cache_key(
                    text,
                    voice,
                    provider.provider_revision(),
                    &format!(
                        "groq_audio/wav_{PCM_PROSODY_REVISION}_{SOURCE_PROSODY_REVISION}_{boundary_coordinate}"
                    ),
                ),
                AudioMediaType::Wav,
            ),
        }
    }

    async fn play_if_current(&self, audio_data: &[u8], generation: u64) -> Result<(), String> {
        let _gate = self.playback_gate.lock().await;
        if *self.cancel_tx.borrow() != generation {
            return Err("TTS_CANCELLED: provider changed before playback".to_string());
        }
        self.playback_generation
            .store(generation, Ordering::Release);
        self.player.play_mp3(audio_data)
    }

    /// Speak text (with provider-aware caching support).
    pub async fn speak(&self, text: &str, voice_id: Option<&str>) -> Result<u64, String> {
        let (generation, connection, cancelled) = self.synthesis_context().await?;
        let config = self.config.read().await.clone();
        let voice = voice_id
            .map(str::to_string)
            .or_else(|| config.voice_id.clone())
            .ok_or("NO_VOICE: No voice ID specified")?;
        if !connection
            .voices
            .iter()
            .any(|candidate| candidate.id == voice)
        {
            return Err(format!("UNKNOWN_VOICE: {voice}"));
        }
        let (cache_key, expected_media) = Self::cache_coordinates(
            connection.synthesizer.as_ref(),
            text,
            &voice,
            &config,
            false,
            None,
        );

        {
            let mut state = self.state.write().await;
            state.is_playing = true;
            state.is_paused = false;
            state.current_text = Some(text.to_string());
            state.current_voice_id = Some(voice.clone());
            state.progress = 0.0;
        }

        let cached = self.cache.as_ref().and_then(|cache| {
            match cache.get_media(&cache_key, expected_media) {
                Ok(value) => value,
                Err(error) => {
                    tracing::warn!("Cache error, synthesizing: {error}");
                    None
                }
            }
        });
        let audio_data = match cached {
            Some(data) => data,
            None => {
                let result = match self
                    .synthesize_with(
                        connection.synthesizer,
                        SynthesisRequest {
                            text: text.to_string(),
                            voice_id: voice,
                            model_id: config.model_id.clone(),
                            speed: config.speed,
                            with_word_timings: false,
                        },
                        cancelled,
                    )
                    .await
                {
                    Ok(result) => result,
                    Err(error) => {
                        let mut state = self.state.write().await;
                        state.is_playing = false;
                        state.is_paused = false;
                        return Err(error);
                    }
                };
                let result = Self::apply_wav_prosody(text, None, result)?;
                if result.media_type != expected_media {
                    return Err("TTS_MEDIA_MISMATCH: provider returned an unexpected format".into());
                }
                if let Some(cache) = &self.cache {
                    if let Err(error) =
                        cache.set_media(&cache_key, &result.audio_data, result.media_type)
                    {
                        tracing::warn!("Failed to cache audio: {error}");
                    }
                }
                result.audio_data
            }
        };
        self.play_if_current(&audio_data, generation).await?;
        Ok(generation)
    }

    /// Synthesize audio plus provider marks when available.
    pub async fn speak_with_timestamps(
        &self,
        text: &str,
        voice_id: Option<&str>,
        boundary_after: Option<ProsodyBoundary>,
    ) -> Result<PreparedTtsWithTimings, String> {
        let (generation, connection, cancelled) = self.synthesis_context().await?;
        let config = self.config.read().await.clone();
        let voice = voice_id
            .map(str::to_string)
            .or_else(|| config.voice_id.clone())
            .ok_or("NO_VOICE: No voice ID specified")?;
        if !connection
            .voices
            .iter()
            .any(|candidate| candidate.id == voice)
        {
            return Err(format!("UNKNOWN_VOICE: {voice}"));
        }
        let (cache_key, media_type) = Self::cache_coordinates(
            connection.synthesizer.as_ref(),
            text,
            &voice,
            &config,
            true,
            boundary_after,
        );

        {
            let mut state = self.state.write().await;
            state.is_playing = true;
            state.is_paused = false;
            state.current_text = Some(text.to_string());
            state.current_voice_id = Some(voice.clone());
            state.progress = 0.0;
        }

        if let Some(disk_cache) = &self.cache {
            match disk_cache.get_with_timestamps_media(&cache_key, media_type) {
                Ok(Some(cached)) => {
                    let word_timings = cached
                        .word_timings
                        .into_iter()
                        .map(|timing| WordTiming {
                            word: timing.word,
                            start_time: timing.start_time,
                            end_time: timing.end_time,
                            char_start: timing.char_start,
                            char_end: timing.char_end,
                        })
                        .collect();
                    return Ok(PreparedTtsWithTimings {
                        output: TtsWithTimings {
                            audio_data: cached.audio_data,
                            word_timings,
                            total_duration: cached.total_duration,
                        },
                        generation,
                    });
                }
                Ok(None) => {}
                Err(error) => tracing::warn!("Disk cache error: {error}"),
            }
        }

        let result = match self
            .synthesize_with(
                connection.synthesizer,
                SynthesisRequest {
                    text: text.to_string(),
                    voice_id: voice,
                    model_id: config.model_id.clone(),
                    speed: config.speed,
                    with_word_timings: true,
                },
                cancelled,
            )
            .await
        {
            Ok(result) => result,
            Err(error) => {
                let mut state = self.state.write().await;
                state.is_playing = false;
                state.is_paused = false;
                return Err(error);
            }
        };
        let result = Self::apply_wav_prosody(text, boundary_after, result)?;
        if result.media_type != media_type {
            return Err("TTS_MEDIA_MISMATCH: provider returned an unexpected format".into());
        }
        let output = TtsWithTimings {
            audio_data: result.audio_data,
            word_timings: result.word_timings,
            total_duration: result.total_duration,
        };
        if let Some(cache) = &self.cache {
            let cached_timings = output
                .word_timings
                .iter()
                .map(|timing| CachedWordTiming {
                    word: timing.word.clone(),
                    start_time: timing.start_time,
                    end_time: timing.end_time,
                    char_start: timing.char_start,
                    char_end: timing.char_end,
                })
                .collect::<Vec<_>>();
            if let Err(error) = cache.set_with_timestamps_media(
                &cache_key,
                &output.audio_data,
                &cached_timings,
                output.total_duration,
                media_type,
            ) {
                tracing::warn!("Failed to cache TTS: {error}");
            }
        }
        Ok(PreparedTtsWithTimings { output, generation })
    }

    /// Play prepared audio only if no Stop/provider switch superseded it.
    pub async fn play_audio(&self, prepared: &PreparedTtsWithTimings) -> Result<(), String> {
        self.play_if_current(&prepared.output.audio_data, prepared.generation)
            .await
    }

    fn cancel_synthesis(&self) -> u64 {
        let next = self.cancel_tx.borrow().wrapping_add(1);
        self.cancel_tx.send_replace(next);
        next
    }

    /// Stop playback and return the cancellation generation carried by the
    /// stopped event. A replacement may legitimately start at this generation,
    /// which lets the frontend reject a delayed event from the older run.
    pub async fn stop_with_generation(&self) -> Result<u64, String> {
        let _gate = self.playback_gate.lock().await;
        let generation = self.cancel_synthesis();
        self.player.stop()?;
        let mut state = self.state.write().await;
        state.is_playing = false;
        state.is_paused = false;
        state.current_text = None;
        state.current_voice_id = None;
        tracing::debug!("TTS state: stop -> is_playing=false, is_paused=false");
        Ok(generation)
    }

    /// Pause playback
    pub async fn pause(&self) -> Result<(), String> {
        let result = self.player.pause();
        if result.is_ok() {
            let mut state = self.state.write().await;
            state.is_paused = true;
            state.is_playing = false;
            tracing::debug!("TTS state: pause -> is_playing=false, is_paused=true");
        }
        result
    }

    /// Resume playback
    pub async fn resume(&self) -> Result<(), String> {
        let result = self.player.resume();
        if result.is_ok() {
            let mut state = self.state.write().await;
            state.is_paused = false;
            state.is_playing = true;
            tracing::debug!("TTS state: resume -> is_playing=true, is_paused=false");
        }
        result
    }

    /// Set voice for the active provider.
    pub async fn set_voice(&self, voice_id: &str) -> Result<(), String> {
        let connection = self
            .active_connection()
            .await
            .ok_or("NOT_INITIALIZED: initialize a TTS provider first")?;
        if !connection.voices.iter().any(|voice| voice.id == voice_id) {
            return Err(format!("UNKNOWN_VOICE: {voice_id}"));
        }
        let mut config = self.config.write().await;
        config.voice_id = Some(voice_id.to_string());
        Ok(())
    }

    /// Set speed. Pitch-preserving range (spec 039): 0.5×–4.5×.
    pub async fn set_speed(&self, speed: f32) -> Result<(), String> {
        if !(stretch::MIN_SPEED..=stretch::MAX_SPEED).contains(&speed) {
            return Err(format!(
                "INVALID_SPEED: Speed must be between {} and {}",
                stretch::MIN_SPEED,
                stretch::MAX_SPEED
            ));
        }
        let player_speed = {
            let mut config = self.config.write().await;
            config.speed = speed;
            if config.provider == TtsProvider::Local {
                // The loopback service already renders the requested speed.
                1.0
            } else {
                speed
            }
        };
        self.player.set_speed(player_speed)
    }

    /// Get current state
    pub async fn get_state(&self) -> TtsState {
        self.state.read().await.clone()
    }

    /// Get current config
    pub async fn get_config(&self) -> TtsConfig {
        self.config.read().await.clone()
    }

    /// Pre-buffer TTS audio without playing.
    pub async fn prebuffer(
        &self,
        text: &str,
        voice_id: Option<&str>,
        boundary_after: Option<ProsodyBoundary>,
    ) -> Result<PrebufferResult, String> {
        let (_, connection, cancelled) = self.synthesis_context().await?;
        let config = self.config.read().await.clone();
        let voice = voice_id
            .map(str::to_string)
            .or_else(|| config.voice_id.clone())
            .ok_or("NO_VOICE: No voice ID specified")?;
        if !connection
            .voices
            .iter()
            .any(|candidate| candidate.id == voice)
        {
            return Err(format!("UNKNOWN_VOICE: {voice}"));
        }
        let (cache_key, media_type) = Self::cache_coordinates(
            connection.synthesizer.as_ref(),
            text,
            &voice,
            &config,
            true,
            boundary_after,
        );
        if let Some(cache) = &self.cache {
            match cache.get_with_timestamps_media(&cache_key, media_type) {
                Ok(Some(cached)) => {
                    return Ok(PrebufferResult {
                        was_cached: true,
                        word_count: cached.word_timings.len(),
                        total_duration: cached.total_duration,
                    });
                }
                Ok(None) => {}
                Err(error) => tracing::warn!("Pre-buffer cache error: {error}"),
            }
        }
        let result = self
            .synthesize_with(
                connection.synthesizer,
                SynthesisRequest {
                    text: text.to_string(),
                    voice_id: voice,
                    model_id: config.model_id.clone(),
                    speed: config.speed,
                    with_word_timings: true,
                },
                cancelled,
            )
            .await?;
        let result = Self::apply_wav_prosody(text, boundary_after, result)?;
        if result.media_type != media_type {
            return Err("TTS_MEDIA_MISMATCH: provider returned an unexpected format".into());
        }
        if let Some(cache) = &self.cache {
            let timings = result
                .word_timings
                .iter()
                .map(|timing| CachedWordTiming {
                    word: timing.word.clone(),
                    start_time: timing.start_time,
                    end_time: timing.end_time,
                    char_start: timing.char_start,
                    char_end: timing.char_end,
                })
                .collect::<Vec<_>>();
            if let Err(error) = cache.set_with_timestamps_media(
                &cache_key,
                &result.audio_data,
                &timings,
                result.total_duration,
                media_type,
            ) {
                tracing::warn!("Failed to cache pre-buffered TTS: {error}");
            }
        }
        Ok(PrebufferResult {
            was_cached: false,
            word_count: result.word_timings.len(),
            total_duration: result.total_duration,
        })
    }

    /// Get cache statistics
    pub fn get_cache_info(&self) -> Result<CacheInfo, String> {
        match &self.cache {
            Some(cache) => cache.get_info(),
            None => Ok(CacheInfo {
                total_size_bytes: 0,
                entry_count: 0,
                oldest_entry: None,
                newest_entry: None,
            }),
        }
    }

    /// Clear all cached audio
    pub fn clear_cache(&self) -> Result<ClearResult, String> {
        // Clear disk cache
        match &self.cache {
            Some(cache) => cache.clear(),
            None => Ok(ClearResult {
                success: true,
                bytes_cleared: 0,
                entries_removed: 0,
            }),
        }
    }

    /// Invalidate cache for a specific voice
    pub fn invalidate_voice_cache(&self, voice_id: &str) -> Result<ClearResult, String> {
        match &self.cache {
            Some(cache) => cache.invalidate_voice(voice_id),
            None => Ok(ClearResult {
                success: true,
                bytes_cleared: 0,
                entries_removed: 0,
            }),
        }
    }
}

impl Default for AiTtsEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ports::{SynthesisResult, SynthesisVoice};
    use async_trait::async_trait;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn voice(provider: SynthesisProvider, id: &str) -> SynthesisVoice {
        SynthesisVoice {
            id: id.to_string(),
            name: id.to_string(),
            language: None,
            provider,
            preview_url: None,
            labels: None,
        }
    }

    struct PendingSynthesizer;

    #[async_trait]
    impl SynthesizerPort for PendingSynthesizer {
        fn provider(&self) -> SynthesisProvider {
            SynthesisProvider::Local
        }
        fn provider_revision(&self) -> &str {
            "pending-1"
        }
        fn max_text_utf8_bytes(&self) -> usize {
            8_192
        }
        fn supports_word_timings(&self) -> bool {
            false
        }
        async fn list_voices(&self) -> Result<Vec<SynthesisVoice>, String> {
            Ok(vec![voice(SynthesisProvider::Local, "local-voice")])
        }
        async fn synthesize(&self, _request: SynthesisRequest) -> Result<SynthesisResult, String> {
            std::future::pending().await
        }
    }

    struct SuccessfulSynthesizer {
        from_cache: bool,
    }

    #[async_trait]
    impl SynthesizerPort for SuccessfulSynthesizer {
        fn provider(&self) -> SynthesisProvider {
            SynthesisProvider::Local
        }
        fn provider_revision(&self) -> &str {
            "magpie-test-1"
        }
        fn max_text_utf8_bytes(&self) -> usize {
            300
        }
        fn supports_word_timings(&self) -> bool {
            false
        }
        fn runtime_info(&self) -> ProviderRuntimeInfo {
            ProviderRuntimeInfo {
                provider_revision: self.provider_revision().to_string(),
                model: Some("Magpie test".to_string()),
                model_revision: Some("model-sha".to_string()),
                quantization: Some("Q6_K".to_string()),
                backend: Some("Vulkan/RADV".to_string()),
                device: Some("Fixture GPU".to_string()),
                acceleration: Some("gpu".to_string()),
                queue_capacity: Some(1),
                chunk_max_utf8_bytes: 300,
            }
        }
        async fn list_voices(&self) -> Result<Vec<SynthesisVoice>, String> {
            Ok(vec![voice(SynthesisProvider::Local, "voice")])
        }
        async fn synthesize(&self, _request: SynthesisRequest) -> Result<SynthesisResult, String> {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            Ok(SynthesisResult {
                audio_data: vec![0; 44],
                media_type: AudioMediaType::Wav,
                word_timings: Vec::new(),
                total_duration: 2.0,
                provider_revision: self.provider_revision().to_string(),
                from_cache: self.from_cache,
            })
        }
    }

    struct CountingSynthesizer {
        provider: SynthesisProvider,
        calls: Arc<AtomicUsize>,
        failure: &'static str,
    }

    #[async_trait]
    impl SynthesizerPort for CountingSynthesizer {
        fn provider(&self) -> SynthesisProvider {
            self.provider
        }
        fn provider_revision(&self) -> &str {
            "counting-1"
        }
        fn max_text_utf8_bytes(&self) -> usize {
            200
        }
        fn supports_word_timings(&self) -> bool {
            false
        }
        async fn list_voices(&self) -> Result<Vec<SynthesisVoice>, String> {
            Ok(vec![voice(self.provider, "voice")])
        }
        async fn synthesize(&self, _request: SynthesisRequest) -> Result<SynthesisResult, String> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            Err(self.failure.to_string())
        }
    }

    async fn install_counting(
        engine: &AiTtsEngine,
        provider: SynthesisProvider,
        calls: Arc<AtomicUsize>,
        failure: &'static str,
    ) {
        engine
            .install_provider(
                Arc::new(CountingSynthesizer {
                    provider,
                    calls,
                    failure,
                }),
                vec![voice(provider, "voice")],
            )
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn stop_publishes_monotonic_cancellation_generations() {
        let engine = AiTtsEngine::for_test();
        assert_eq!(engine.stop_with_generation().await.unwrap(), 1);
        assert_eq!(engine.stop_with_generation().await.unwrap(), 2);
    }

    #[tokio::test]
    async fn registry_retains_connections_and_switch_rejects_unknown_provider() {
        let engine = AiTtsEngine::for_test();
        install_counting(
            &engine,
            SynthesisProvider::Local,
            Arc::new(AtomicUsize::new(0)),
            "local failure",
        )
        .await;
        install_counting(
            &engine,
            SynthesisProvider::Groq,
            Arc::new(AtomicUsize::new(0)),
            "groq failure",
        )
        .await;

        assert_eq!(
            engine.connected_providers().await,
            vec![TtsProvider::Local, TtsProvider::Groq]
        );
        assert_eq!(engine.active_provider().await, Some(TtsProvider::Local));
        engine.switch_provider(TtsProvider::Groq).await.unwrap();
        assert_eq!(engine.active_provider().await, Some(TtsProvider::Groq));
        assert!(engine
            .switch_provider(TtsProvider::ElevenLabs)
            .await
            .is_err());
        assert_eq!(engine.active_provider().await, Some(TtsProvider::Groq));
    }

    #[tokio::test]
    async fn performance_snapshot_reports_runtime_and_uncached_standard_rtf() {
        let engine = AiTtsEngine::for_test();
        engine
            .install_provider(
                Arc::new(SuccessfulSynthesizer { from_cache: false }),
                vec![voice(SynthesisProvider::Local, "voice")],
            )
            .await
            .unwrap();

        engine
            .synthesize(SynthesisRequest {
                text: "Olá".to_string(),
                voice_id: "voice".to_string(),
                model_id: None,
                speed: 1.0,
                with_word_timings: false,
            })
            .await
            .unwrap();

        let snapshot = engine.performance_snapshot().await.unwrap();
        assert_eq!(snapshot.provider, TtsProvider::Local);
        assert_eq!(snapshot.max_text_utf8_bytes, 300);
        assert_eq!(snapshot.runtime.model.as_deref(), Some("Magpie test"));
        assert_eq!(snapshot.runtime.acceleration.as_deref(), Some("gpu"));
        let latest = snapshot.latest_uncached.unwrap();
        assert_eq!(latest.request_utf8_bytes, 4);
        assert_eq!(latest.audio_duration, 2.0);
        assert!(latest.generation_ms >= 10.0, "{latest:?}");
        assert!((latest.standard_rtf.unwrap() - latest.generation_ms / 2_000.0).abs() < 1e-9);

        engine
            .install_provider(
                Arc::new(SuccessfulSynthesizer { from_cache: true }),
                vec![voice(SynthesisProvider::Local, "voice")],
            )
            .await
            .unwrap();
        engine
            .synthesize(SynthesisRequest {
                text: "cached replay must not replace the measurement".to_string(),
                voice_id: "voice".to_string(),
                model_id: None,
                speed: 1.0,
                with_word_timings: false,
            })
            .await
            .unwrap();
        assert_eq!(
            engine
                .performance_snapshot()
                .await
                .unwrap()
                .latest_uncached
                .unwrap()
                .request_utf8_bytes,
            4
        );
    }

    #[tokio::test]
    async fn provider_failure_never_falls_back_to_another_connection() {
        let engine = AiTtsEngine::for_test();
        let local_calls = Arc::new(AtomicUsize::new(0));
        let groq_calls = Arc::new(AtomicUsize::new(0));
        install_counting(
            &engine,
            SynthesisProvider::Local,
            Arc::clone(&local_calls),
            "LOCAL_SHOULD_NOT_RUN",
        )
        .await;
        install_counting(
            &engine,
            SynthesisProvider::Groq,
            Arc::clone(&groq_calls),
            "GROQ_EXPECTED_FAILURE",
        )
        .await;
        engine.switch_provider(TtsProvider::Groq).await.unwrap();

        let error = engine
            .synthesize(SynthesisRequest {
                text: "route once".to_string(),
                voice_id: "voice".to_string(),
                model_id: None,
                speed: 1.0,
                with_word_timings: false,
            })
            .await
            .unwrap_err();
        assert_eq!(error, "GROQ_EXPECTED_FAILURE");
        assert_eq!(groq_calls.load(Ordering::SeqCst), 1);
        assert_eq!(local_calls.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn prosody_boundary_targets_scale_by_document_structure() {
        assert_eq!(ProsodyBoundary::Clause.target_ms(), 200);
        assert_eq!(ProsodyBoundary::Sentence.target_ms(), 350);
        assert_eq!(ProsodyBoundary::Paragraph.target_ms(), 650);
        assert_eq!(ProsodyBoundary::Section.target_ms(), 800);
        assert_eq!(
            AiTtsEngine::inferred_boundary("A complete sentence."),
            ProsodyBoundary::Sentence
        );
        assert_eq!(
            AiTtsEngine::inferred_boundary("forced byte split"),
            ProsodyBoundary::Clause
        );
    }

    #[test]
    fn cache_identity_is_provider_scoped_and_only_rendered_speed_changes_audio() {
        let calls = Arc::new(AtomicUsize::new(0));
        let local = CountingSynthesizer {
            provider: SynthesisProvider::Local,
            calls: Arc::clone(&calls),
            failure: "unused",
        };
        let groq = CountingSynthesizer {
            provider: SynthesisProvider::Groq,
            calls: Arc::clone(&calls),
            failure: "unused",
        };
        let elevenlabs = CountingSynthesizer {
            provider: SynthesisProvider::ElevenLabs,
            calls,
            failure: "unused",
        };
        let mut config = TtsConfig {
            speed: 1.0,
            ..TtsConfig::default()
        };
        let (local_one, _) =
            AiTtsEngine::cache_coordinates(&local, "text", "voice", &config, true, None);
        let (groq_one, _) =
            AiTtsEngine::cache_coordinates(&groq, "text", "voice", &config, true, None);
        let (elevenlabs_one, _) =
            AiTtsEngine::cache_coordinates(&elevenlabs, "text", "voice", &config, true, None);
        let (section, _) = AiTtsEngine::cache_coordinates(
            &local,
            "text",
            "voice",
            &config,
            true,
            Some(ProsodyBoundary::Section),
        );
        config.speed = 2.0;
        let (local_two, _) =
            AiTtsEngine::cache_coordinates(&local, "text", "voice", &config, true, None);
        let (groq_two, _) =
            AiTtsEngine::cache_coordinates(&groq, "text", "voice", &config, true, None);
        let (elevenlabs_two, _) =
            AiTtsEngine::cache_coordinates(&elevenlabs, "text", "voice", &config, true, None);

        assert_ne!(local_one, groq_one, "provider identities cannot collide");
        assert_ne!(local_one, section, "boundary target changes cached WAV");
        assert_ne!(local_one, local_two, "Local renders speed into its WAV");
        assert_eq!(groq_one, groq_two, "Groq speed is player-side stretch");
        assert_eq!(
            elevenlabs_one, elevenlabs_two,
            "ElevenLabs speed is player-side stretch"
        );
    }

    #[tokio::test]
    async fn switch_cancels_a_pending_old_provider_before_activation() {
        let engine = AiTtsEngine::for_test();
        engine
            .install_provider(
                Arc::new(PendingSynthesizer),
                vec![voice(SynthesisProvider::Local, "local-voice")],
            )
            .await
            .unwrap();
        install_counting(
            &engine,
            SynthesisProvider::Groq,
            Arc::new(AtomicUsize::new(0)),
            "unused",
        )
        .await;

        let future = engine.synthesize(SynthesisRequest {
            text: "cancel me".to_string(),
            voice_id: "local-voice".to_string(),
            model_id: None,
            speed: 1.0,
            with_word_timings: false,
        });
        tokio::pin!(future);
        assert!(futures::poll!(&mut future).is_pending());

        engine.switch_provider(TtsProvider::Groq).await.unwrap();

        assert_eq!(
            future.await.unwrap_err(),
            "TTS_CANCELLED: synthesis was cancelled"
        );
        assert_eq!(engine.active_provider().await, Some(TtsProvider::Groq));
    }
}
