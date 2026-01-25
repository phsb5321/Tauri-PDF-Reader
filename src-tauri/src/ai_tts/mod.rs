//! AI-powered Text-to-Speech module
//!
//! Provides TTS functionality using cloud providers like ElevenLabs.
//! Audio is played directly through the system using rodio.
//! Includes audio caching for instant playback of previously generated audio.

mod elevenlabs;
mod player;

pub use elevenlabs::{ElevenLabsClient, TtsWithTimings, WordTiming};
pub use player::AudioPlayer;

use crate::adapters::{AudioCacheAdapter, CacheInfo, CachedWordTiming, ClearResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Supported TTS providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TtsProvider {
    ElevenLabs,
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
    elevenlabs: Option<ElevenLabsClient>,
    cache: Option<AudioCacheAdapter>,
}

impl AiTtsEngine {
    pub fn new() -> Self {
        Self {
            config: Arc::new(RwLock::new(TtsConfig::default())),
            state: Arc::new(RwLock::new(TtsState::default())),
            player: Arc::new(AudioPlayer::new()),
            elevenlabs: None,
            cache: None,
        }
    }

    /// Initialize cache with app cache directory
    pub fn init_cache(&mut self, cache_dir: PathBuf) {
        self.cache = Some(AudioCacheAdapter::new(cache_dir));
        tracing::info!("TTS audio cache initialized");
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

    /// Speak text (with caching support)
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

        let model_id = config.model_id.clone().unwrap_or_else(|| "eleven_monolingual_v1".to_string());

        // Update state
        {
            let mut state = self.state.write().await;
            state.is_playing = true;
            state.is_paused = false;
            state.current_text = Some(text.to_string());
            state.current_voice_id = Some(voice.clone());
            state.progress = 0.0;
        }

        // Generate cache key
        let settings_hash = format!("{:.2}_{:.2}", config.stability, config.similarity_boost);
        let cache_key = AudioCacheAdapter::generate_cache_key(text, &voice, &model_id, &settings_hash);

        // Check cache first
        let audio_data = if let Some(cache) = &self.cache {
            match cache.get(&cache_key) {
                Ok(Some(cached_data)) => {
                    tracing::info!("Cache hit for TTS audio, {} bytes", cached_data.len());
                    cached_data
                }
                Ok(None) => {
                    tracing::debug!("Cache miss, fetching from ElevenLabs");
                    let data = client
                        .text_to_speech(text, &voice, Some(&model_id))
                        .await?;

                    // Cache the audio (best-effort, ignore errors)
                    if let Err(e) = cache.set(&cache_key, &data) {
                        tracing::warn!("Failed to cache audio: {}", e);
                    }
                    data
                }
                Err(e) => {
                    tracing::warn!("Cache error, fetching from API: {}", e);
                    client
                        .text_to_speech(text, &voice, Some(&model_id))
                        .await?
                }
            }
        } else {
            client
                .text_to_speech(text, &voice, Some(&model_id))
                .await?
        };

        // Play audio (non-blocking)
        self.player.play_mp3(&audio_data)?;

        Ok(())
    }

    /// Speak text with word-level timestamps for karaoke highlighting
    /// Includes disk-based caching to save API tokens across app restarts
    pub async fn speak_with_timestamps(
        &self,
        text: &str,
        voice_id: Option<&str>,
    ) -> Result<TtsWithTimings, String> {
        let client = self
            .elevenlabs
            .as_ref()
            .ok_or("NOT_INITIALIZED: Call init() with API key first")?;

        let config = self.config.read().await;
        let voice = voice_id
            .map(|s| s.to_string())
            .or_else(|| config.voice_id.clone())
            .ok_or("NO_VOICE: No voice ID specified")?;

        let model_id = config.model_id.clone().unwrap_or_else(|| "eleven_monolingual_v1".to_string());

        // Update state
        {
            let mut state = self.state.write().await;
            state.is_playing = true;
            state.is_paused = false;
            state.current_text = Some(text.to_string());
            state.current_voice_id = Some(voice.clone());
            state.progress = 0.0;
        }

        // Generate cache key for timestamps
        let settings_hash = format!("{:.2}_{:.2}_ts", config.stability, config.similarity_boost);
        let cache_key = AudioCacheAdapter::generate_cache_key(text, &voice, &model_id, &settings_hash);

        // Check disk cache first (persists across app restarts)
        if let Some(disk_cache) = &self.cache {
            match disk_cache.get_with_timestamps(&cache_key) {
                Ok(Some(cached)) => {
                    tracing::info!(
                        "Disk cache hit for TTS with timestamps: {} bytes, {} words",
                        cached.audio_data.len(),
                        cached.word_timings.len()
                    );

                    // Play cached audio
                    self.player.play_mp3(&cached.audio_data)?;

                    // Convert CachedWordTiming to WordTiming
                    let word_timings: Vec<WordTiming> = cached
                        .word_timings
                        .into_iter()
                        .map(|wt| WordTiming {
                            word: wt.word,
                            start_time: wt.start_time,
                            end_time: wt.end_time,
                            char_start: wt.char_start,
                            char_end: wt.char_end,
                        })
                        .collect();

                    return Ok(TtsWithTimings {
                        audio_data: cached.audio_data,
                        word_timings,
                        total_duration: cached.total_duration,
                    });
                }
                Ok(None) => {
                    tracing::debug!("Disk cache miss for timestamps");
                }
                Err(e) => {
                    tracing::warn!("Disk cache error: {}", e);
                }
            }
        }

        tracing::info!("Fetching TTS with timestamps from ElevenLabs API");

        // Get TTS with timestamps from API
        let tts_result = client
            .text_to_speech_with_timestamps(text, &voice, Some(&model_id))
            .await?;

        // Cache the result to disk (persists across app restarts)
        if let Some(disk_cache) = &self.cache {
            // Convert WordTiming to CachedWordTiming for storage
            let cached_timings: Vec<CachedWordTiming> = tts_result
                .word_timings
                .iter()
                .map(|wt| CachedWordTiming {
                    word: wt.word.clone(),
                    start_time: wt.start_time,
                    end_time: wt.end_time,
                    char_start: wt.char_start,
                    char_end: wt.char_end,
                })
                .collect();

            if let Err(e) = disk_cache.set_with_timestamps(
                &cache_key,
                &tts_result.audio_data,
                &cached_timings,
                tts_result.total_duration,
            ) {
                tracing::warn!("Failed to cache TTS to disk: {}", e);
            } else {
                tracing::info!(
                    "Cached TTS with timestamps to disk: {} words, {:.2}s",
                    tts_result.word_timings.len(),
                    tts_result.total_duration
                );
            }
        }

        // NOTE: Audio playback is NOT started here anymore.
        // The command layer will emit ai-tts:playback-starting event THEN call play_audio()
        // This ensures frontend can sync highlight timer accurately.

        Ok(tts_result)
    }

    /// Play raw MP3 audio data
    /// 
    /// This is called after speak_with_timestamps returns, allowing the command
    /// to emit a sync event right before playback starts.
    pub fn play_audio(&self, audio_data: &[u8]) -> Result<(), String> {
        self.player.play_mp3(audio_data)
    }

    /// Stop playback
    pub async fn stop(&self) -> Result<(), String> {
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

    /// Pre-buffer TTS audio without playing
    /// 
    /// Fetches audio from ElevenLabs API (or cache) and stores in disk cache.
    /// Does NOT play the audio - just ensures it's cached for instant playback later.
    pub async fn prebuffer(
        &self,
        text: &str,
        voice_id: Option<&str>,
    ) -> Result<PrebufferResult, String> {
        let client = self
            .elevenlabs
            .as_ref()
            .ok_or("NOT_INITIALIZED: Call init() with API key first")?;

        let config = self.config.read().await;
        let voice = voice_id
            .map(|s| s.to_string())
            .or_else(|| config.voice_id.clone())
            .ok_or("NO_VOICE: No voice ID specified")?;

        let model_id = config.model_id.clone().unwrap_or_else(|| "eleven_monolingual_v1".to_string());

        // Generate cache key for timestamps
        let settings_hash = format!("{:.2}_{:.2}_ts", config.stability, config.similarity_boost);
        let cache_key = AudioCacheAdapter::generate_cache_key(text, &voice, &model_id, &settings_hash);

        // Check if already cached
        if let Some(disk_cache) = &self.cache {
            match disk_cache.get_with_timestamps(&cache_key) {
                Ok(Some(cached)) => {
                    tracing::info!(
                        "Pre-buffer: already cached ({} bytes, {} words)",
                        cached.audio_data.len(),
                        cached.word_timings.len()
                    );
                    return Ok(PrebufferResult {
                        was_cached: true,
                        word_count: cached.word_timings.len(),
                        total_duration: cached.total_duration,
                    });
                }
                Ok(None) => {
                    tracing::debug!("Pre-buffer: cache miss, fetching from API");
                }
                Err(e) => {
                    tracing::warn!("Pre-buffer: cache error: {}", e);
                }
            }
        }

        // Fetch from API
        tracing::info!("Pre-buffering TTS from ElevenLabs API ({} chars)", text.len());
        
        let tts_result = client
            .text_to_speech_with_timestamps(text, &voice, Some(&model_id))
            .await?;

        // Cache the result to disk
        if let Some(disk_cache) = &self.cache {
            let cached_timings: Vec<CachedWordTiming> = tts_result
                .word_timings
                .iter()
                .map(|wt| CachedWordTiming {
                    word: wt.word.clone(),
                    start_time: wt.start_time,
                    end_time: wt.end_time,
                    char_start: wt.char_start,
                    char_end: wt.char_end,
                })
                .collect();

            if let Err(e) = disk_cache.set_with_timestamps(
                &cache_key,
                &tts_result.audio_data,
                &cached_timings,
                tts_result.total_duration,
            ) {
                tracing::warn!("Failed to cache pre-buffered TTS: {}", e);
            } else {
                tracing::info!(
                    "Pre-buffered and cached TTS: {} words, {:.2}s",
                    tts_result.word_timings.len(),
                    tts_result.total_duration
                );
            }
        }

        Ok(PrebufferResult {
            was_cached: false,
            word_count: tts_result.word_timings.len(),
            total_duration: tts_result.total_duration,
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
