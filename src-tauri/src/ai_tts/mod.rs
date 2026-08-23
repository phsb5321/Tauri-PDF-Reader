//! AI-powered Text-to-Speech module
//!
//! Provides TTS functionality using cloud providers like ElevenLabs.
//! Audio is played directly through the system using rodio.
//! Includes audio caching for instant playback of previously generated audio.

mod elevenlabs;
mod player;
mod stretch; // pitch-preserving playback speed (spec 039)

pub use elevenlabs::{ElevenLabsClient, TtsWithTimings, WordTiming};
pub use player::AudioPlayer;

use crate::adapters::{
    AudioCacheAdapter, CacheInfo, CachedWordTiming, ClearResult, LocalTtsClient,
};
use crate::ports::{
    AudioMediaType, SynthesisProvider, SynthesisRequest, SynthesisVoice, SynthesizerPort,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{watch, RwLock};

/// Supported TTS providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum TtsProvider {
    #[default]
    ElevenLabs,
    Local,
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

/// Result of pre-buffering TTS audio
pub struct PrebufferResult {
    pub was_cached: bool,
    pub word_count: usize,
    pub total_duration: f64,
}

/// Main TTS engine that coordinates providers and playback
pub struct AiTtsEngine {
    config: Arc<RwLock<TtsConfig>>,
    state: Arc<RwLock<TtsState>>,
    player: Arc<AudioPlayer>,
    synthesizer: Option<Arc<dyn SynthesizerPort>>,
    cancel_tx: watch::Sender<u64>,
    cache: Option<AudioCacheAdapter>,
}

impl AiTtsEngine {
    pub fn new() -> Self {
        let (cancel_tx, _) = watch::channel(0_u64);
        Self {
            config: Arc::new(RwLock::new(TtsConfig::default())),
            state: Arc::new(RwLock::new(TtsState::default())),
            player: Arc::new(AudioPlayer::new()),
            synthesizer: None,
            cancel_tx,
            cache: None,
        }
    }

    /// Rebuild the audio player so it invokes `on_finished` when playback ends
    /// naturally (the sink drains without an explicit stop). Wired in `lib.rs`
    /// setup to emit `ai-tts:finished`, so the frontend completes on the real
    /// audio-end signal instead of a timer estimate.
    ///
    /// Called once at startup before any playback, so swapping the player (the
    /// `new()` one was idle) is safe — its dropped thread joins cleanly.
    pub fn set_finished_callback(&mut self, on_finished: Box<dyn Fn() + Send>) {
        self.player = Arc::new(AudioPlayer::with_finished_callback(on_finished));
    }

    /// Initialize cache with app cache directory
    pub fn init_cache(&mut self, cache_dir: PathBuf) {
        self.cache = Some(AudioCacheAdapter::new(cache_dir));
        tracing::info!("TTS audio cache initialized");
    }

    /// Initialize with an ElevenLabs API key.
    pub async fn init(&mut self, api_key: String) -> Result<(), String> {
        let client = Arc::new(ElevenLabsClient::new(api_key.clone()));
        client
            .list_voices()
            .await
            .map_err(|e| format!("Failed to initialize ElevenLabs: {e}"))?;
        self.synthesizer = Some(client);
        let mut config = self.config.write().await;
        config.provider = TtsProvider::ElevenLabs;
        config.api_key = Some(api_key);
        tracing::info!("AI TTS engine initialized with ElevenLabs");
        Ok(())
    }

    /// Initialize the account-free local provider from native config.
    pub async fn init_local(&mut self, base_url: &str) -> Result<(), String> {
        let client = Arc::new(LocalTtsClient::connect(base_url).await?);
        let voices = client.list_voices().await?;
        let first_voice = voices
            .first()
            .map(|voice| voice.id.clone())
            .ok_or("LOCAL_TTS_NO_VOICES")?;
        self.synthesizer = Some(client);
        let mut config = self.config.write().await;
        config.provider = TtsProvider::Local;
        config.api_key = None;
        if !voices
            .iter()
            .any(|voice| config.voice_id.as_deref() == Some(&voice.id))
        {
            config.voice_id = Some(first_voice);
        }
        tracing::info!("AI TTS engine initialized with local provider");
        Ok(())
    }

    /// Check if initialized.
    pub async fn is_initialized(&self) -> bool {
        self.synthesizer.is_some()
    }

    pub fn supports_word_timings(&self) -> bool {
        self.synthesizer
            .as_ref()
            .is_some_and(|provider| provider.supports_word_timings())
    }

    fn voice_info(voice: SynthesisVoice) -> VoiceInfo {
        VoiceInfo {
            id: voice.id,
            name: voice.name,
            provider: match voice.provider {
                SynthesisProvider::ElevenLabs => TtsProvider::ElevenLabs,
                SynthesisProvider::Local => TtsProvider::Local,
            },
            preview_url: voice.preview_url,
            labels: voice.labels,
        }
    }

    /// Get available voices.
    pub async fn list_voices(&self) -> Result<Vec<VoiceInfo>, String> {
        let provider = self
            .synthesizer
            .as_ref()
            .ok_or("NOT_INITIALIZED: initialize a TTS provider first")?;
        provider
            .list_voices()
            .await
            .map(|voices| voices.into_iter().map(Self::voice_info).collect())
    }

    async fn synthesize(
        &self,
        request: SynthesisRequest,
    ) -> Result<crate::ports::SynthesisResult, String> {
        let provider = Arc::clone(
            self.synthesizer
                .as_ref()
                .ok_or("NOT_INITIALIZED: initialize a TTS provider first")?,
        );
        let mut cancelled = self.cancel_tx.subscribe();
        tokio::select! {
            result = provider.synthesize(request) => result,
            changed = cancelled.changed() => {
                let _ = changed;
                Err("TTS_CANCELLED: synthesis was cancelled".to_string())
            }
        }
    }

    fn cache_coordinates(
        &self,
        text: &str,
        voice: &str,
        config: &TtsConfig,
        with_word_timings: bool,
    ) -> Result<(String, AudioMediaType), String> {
        let provider = self
            .synthesizer
            .as_ref()
            .ok_or("NOT_INITIALIZED: initialize a TTS provider first")?;
        if provider.provider() == SynthesisProvider::ElevenLabs {
            let model_id = config
                .model_id
                .clone()
                .unwrap_or_else(|| "eleven_monolingual_v1".to_string());
            let suffix = if with_word_timings { "_ts" } else { "" };
            let settings_hash = format!(
                "{:.2}_{:.2}{suffix}",
                config.stability, config.similarity_boost
            );
            return Ok((
                AudioCacheAdapter::generate_cache_key(text, voice, &model_id, &settings_hash),
                AudioMediaType::Mp3,
            ));
        }
        let settings_hash = format!(
            "local_{}_{}",
            config.speed,
            AudioMediaType::Wav.content_type()
        );
        Ok((
            AudioCacheAdapter::generate_cache_key(
                text,
                voice,
                provider.provider_revision(),
                &settings_hash,
            ),
            AudioMediaType::Wav,
        ))
    }

    /// Speak text (with provider-aware caching support).
    pub async fn speak(&self, text: &str, voice_id: Option<&str>) -> Result<(), String> {
        let config = self.config.read().await.clone();
        let voice = voice_id
            .map(str::to_string)
            .or_else(|| config.voice_id.clone())
            .ok_or("NO_VOICE: No voice ID specified")?;
        let (cache_key, expected_media) = self.cache_coordinates(text, &voice, &config, false)?;

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
                let result = self
                    .synthesize(SynthesisRequest {
                        text: text.to_string(),
                        voice_id: voice,
                        speed: config.speed,
                        with_word_timings: false,
                    })
                    .await?;
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
        self.player.play_mp3(&audio_data)?;
        Ok(())
    }

    /// Synthesize audio plus provider marks when available.
    pub async fn speak_with_timestamps(
        &self,
        text: &str,
        voice_id: Option<&str>,
    ) -> Result<TtsWithTimings, String> {
        let config = self.config.read().await.clone();
        let voice = voice_id
            .map(str::to_string)
            .or_else(|| config.voice_id.clone())
            .ok_or("NO_VOICE: No voice ID specified")?;
        let (cache_key, media_type) = self.cache_coordinates(text, &voice, &config, true)?;

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
                    return Ok(TtsWithTimings {
                        audio_data: cached.audio_data,
                        word_timings,
                        total_duration: cached.total_duration,
                    });
                }
                Ok(None) => {}
                Err(error) => tracing::warn!("Disk cache error: {error}"),
            }
        }

        let result = self
            .synthesize(SynthesisRequest {
                text: text.to_string(),
                voice_id: voice,
                speed: config.speed,
                with_word_timings: true,
            })
            .await?;
        if result.media_type != media_type {
            return Err("TTS_MEDIA_MISMATCH: provider returned an unexpected format".into());
        }
        let tts_result = TtsWithTimings {
            audio_data: result.audio_data,
            word_timings: result.word_timings,
            total_duration: result.total_duration,
        };
        if let Some(cache) = &self.cache {
            let cached_timings = tts_result
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
                &tts_result.audio_data,
                &cached_timings,
                tts_result.total_duration,
                media_type,
            ) {
                tracing::warn!("Failed to cache TTS: {error}");
            }
        }
        Ok(tts_result)
    }

    /// Play raw MP3 audio data
    ///
    /// This is called after speak_with_timestamps returns, allowing the command
    /// to emit a sync event right before playback starts.
    pub fn play_audio(&self, audio_data: &[u8]) -> Result<(), String> {
        self.player.play_mp3(audio_data)
    }

    fn cancel_synthesis(&self) {
        let next = self.cancel_tx.borrow().wrapping_add(1);
        let _ = self.cancel_tx.send(next);
    }

    /// Stop playback
    pub async fn stop(&self) -> Result<(), String> {
        self.cancel_synthesis();
        let result = self.player.stop();
        if result.is_ok() {
            let mut state = self.state.write().await;
            state.is_playing = false;
            state.is_paused = false;
            tracing::debug!("TTS state: stop -> is_playing=false, is_paused=false");
        }
        result
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

    /// Set voice
    pub async fn set_voice(&self, voice_id: &str) -> Result<(), String> {
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

    /// Pre-buffer TTS audio without playing
    ///
    /// Fetches audio from ElevenLabs API (or cache) and stores in disk cache.
    /// Does NOT play the audio - just ensures it's cached for instant playback later.
    pub async fn prebuffer(
        &self,
        text: &str,
        voice_id: Option<&str>,
    ) -> Result<PrebufferResult, String> {
        let config = self.config.read().await.clone();
        let voice = voice_id
            .map(str::to_string)
            .or_else(|| config.voice_id.clone())
            .ok_or("NO_VOICE: No voice ID specified")?;
        let (cache_key, media_type) = self.cache_coordinates(text, &voice, &config, true)?;
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
            .synthesize(SynthesisRequest {
                text: text.to_string(),
                voice_id: voice,
                speed: config.speed,
                with_word_timings: true,
            })
            .await?;
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
            Ok(Vec::new())
        }
        async fn synthesize(&self, _request: SynthesisRequest) -> Result<SynthesisResult, String> {
            std::future::pending().await
        }
    }

    #[tokio::test]
    async fn cancellation_drops_a_pending_provider_without_fallback() {
        let mut engine = AiTtsEngine::new();
        engine.synthesizer = Some(Arc::new(PendingSynthesizer));
        let future = engine.synthesize(SynthesisRequest {
            text: "cancel me".to_string(),
            voice_id: "F1-pt".to_string(),
            speed: 1.0,
            with_word_timings: false,
        });
        tokio::pin!(future);
        assert!(futures::poll!(&mut future).is_pending());

        engine.cancel_synthesis();

        assert_eq!(
            future.await.unwrap_err(),
            "TTS_CANCELLED: synthesis was cancelled"
        );
    }
}
