//! AI TTS Tauri commands
//!
//! Provides commands for text-to-speech using AI providers like ElevenLabs.
//! Includes cache management commands for persisted audio.

use crate::adapters::{CacheInfo, ClearResult};
use crate::ai_tts::{AiTtsEngine, TtsConfig, VoiceInfo, WordTiming};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;

/// Wrapper for thread-safe TTS engine access
pub struct AiTtsEngineState(pub Arc<RwLock<AiTtsEngine>>);

// Response types

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitResponse {
    pub success: bool,
    pub voices_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoicesResponse {
    pub voices: Vec<VoiceInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakResponse {
    pub success: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StopResponse {
    pub success: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateResponse {
    pub initialized: bool,
    pub is_playing: bool,
    pub is_paused: bool,
    pub current_voice_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakWithTimestampsResponse {
    pub success: bool,
    pub word_timings: Vec<WordTiming>,
    pub total_duration: f64,
}

/// Response for prebuffer command
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrebufferResponse {
    pub success: bool,
    pub cached: bool,
    pub word_count: usize,
    pub total_duration: f64,
}

// TTS Events emitted to frontend

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TtsStartedEvent {
    text: String,
    voice_id: String,
}

/// Emitted right before audio playback begins - frontend should sync highlight timer to this
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TtsPlaybackStartingEvent {
    /// Duration of the audio in seconds
    duration: f64,
}

// Note: TtsCompletedEvent removed - completion is now handled by user stop/pause actions
// since play_mp3 is non-blocking and we can't detect when audio actually finishes

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TtsErrorEvent {
    error: String,
}

/// Initialize AI TTS with API key
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_init(
    state: State<'_, AiTtsEngineState>,
    api_key: String,
) -> Result<InitResponse, String> {
    let mut engine = state.0.write().await;

    engine.init(api_key).await?;

    let voices = engine.list_voices().await?;

    Ok(InitResponse {
        success: true,
        voices_count: voices.len(),
    })
}

/// List available voices
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_list_voices(
    state: State<'_, AiTtsEngineState>,
) -> Result<VoicesResponse, String> {
    let engine = state.0.read().await;

    let voices = engine.list_voices().await?;

    Ok(VoicesResponse { voices })
}

/// Speak text using AI TTS
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_speak(
    app: AppHandle,
    state: State<'_, AiTtsEngineState>,
    text: String,
    voice_id: Option<String>,
) -> Result<SpeakResponse, String> {
    let engine = state.0.read().await;

    // Emit started event
    let _ = app.emit(
        "ai-tts:started",
        TtsStartedEvent {
            text: text.clone(),
            voice_id: voice_id.clone().unwrap_or_default(),
        },
    );

    // Speak (audio plays in background, don't emit completed yet)
    let result = engine.speak(&text, voice_id.as_deref()).await;

    match result {
        Ok(_) => {
            // Note: Don't emit ai-tts:completed here because playback is async.
            // The completed event should be emitted when audio actually finishes,
            // or the user can use stop() to end playback.
            Ok(SpeakResponse { success: true })
        }
        Err(e) => {
            let _ = app.emit("ai-tts:error", TtsErrorEvent { error: e.clone() });
            Err(e)
        }
    }
}

/// Speak text with word-level timestamps for karaoke highlighting
///
/// Returns word timings that frontend can use to highlight text in sync with audio.
/// Emits `ai-tts:playback-starting` event RIGHT BEFORE audio begins so frontend can sync.
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_speak_with_timestamps(
    app: AppHandle,
    state: State<'_, AiTtsEngineState>,
    text: String,
    voice_id: Option<String>,
) -> Result<SpeakWithTimestampsResponse, String> {
    let engine = state.0.read().await;

    // Emit started event (indicates TTS request is being processed)
    let _ = app.emit(
        "ai-tts:started",
        TtsStartedEvent {
            text: text.clone(),
            voice_id: voice_id.clone().unwrap_or_default(),
        },
    );

    tracing::info!("Speaking with timestamps: {} chars", text.len());

    match engine
        .speak_with_timestamps(&text, voice_id.as_deref())
        .await
    {
        Ok(result) => {
            tracing::info!(
                "TTS with timestamps ready: {} words, {:.2}s duration",
                result.word_timings.len(),
                result.total_duration
            );

            // Emit playback-starting event RIGHT BEFORE starting audio
            // Frontend should use this to sync highlight timer
            let _ = app.emit(
                "ai-tts:playback-starting",
                TtsPlaybackStartingEvent {
                    duration: result.total_duration,
                },
            );

            // Now start audio playback
            if let Err(e) = engine.play_audio(&result.audio_data) {
                tracing::error!("Failed to play audio: {}", e);
                let _ = app.emit("ai-tts:error", TtsErrorEvent { error: e.clone() });
                return Err(e);
            }

            Ok(SpeakWithTimestampsResponse {
                success: true,
                word_timings: result.word_timings,
                total_duration: result.total_duration,
            })
        }
        Err(e) => {
            let _ = app.emit("ai-tts:error", TtsErrorEvent { error: e.clone() });
            Err(e)
        }
    }
}

/// Stop TTS playback
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_stop(
    app: AppHandle,
    state: State<'_, AiTtsEngineState>,
) -> Result<StopResponse, String> {
    let engine = state.0.read().await;

    engine.stop().await?;

    let _ = app.emit("ai-tts:stopped", ());
    tracing::debug!("Emitted ai-tts:stopped event");

    Ok(StopResponse { success: true })
}

/// Pause TTS playback
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_pause(
    app: AppHandle,
    state: State<'_, AiTtsEngineState>,
) -> Result<StopResponse, String> {
    let engine = state.0.read().await;

    engine.pause().await?;

    let _ = app.emit("ai-tts:paused", ());
    tracing::debug!("Emitted ai-tts:paused event");

    Ok(StopResponse { success: true })
}

/// Resume TTS playback
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_resume(
    app: AppHandle,
    state: State<'_, AiTtsEngineState>,
) -> Result<StopResponse, String> {
    let engine = state.0.read().await;

    engine.resume().await?;

    let _ = app.emit("ai-tts:resumed", ());
    tracing::debug!("Emitted ai-tts:resumed event");

    Ok(StopResponse { success: true })
}

/// Set voice for TTS
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_set_voice(
    state: State<'_, AiTtsEngineState>,
    voice_id: String,
) -> Result<StopResponse, String> {
    let engine = state.0.read().await;

    engine.set_voice(&voice_id).await?;

    Ok(StopResponse { success: true })
}

/// Set playback speed
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_set_speed(
    state: State<'_, AiTtsEngineState>,
    speed: f32,
) -> Result<StopResponse, String> {
    let engine = state.0.read().await;

    engine.set_speed(speed).await?;

    Ok(StopResponse { success: true })
}

/// Get current TTS state
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_get_state(state: State<'_, AiTtsEngineState>) -> Result<StateResponse, String> {
    let engine = state.0.read().await;

    let initialized = engine.is_initialized().await;
    let tts_state = engine.get_state().await;

    Ok(StateResponse {
        initialized,
        is_playing: tts_state.is_playing,
        is_paused: tts_state.is_paused,
        current_voice_id: tts_state.current_voice_id,
    })
}

/// Get current TTS configuration
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_get_config(state: State<'_, AiTtsEngineState>) -> Result<TtsConfig, String> {
    let engine = state.0.read().await;

    Ok(engine.get_config().await)
}

// =============================================================================
// Cache Management Commands (T031-T033)
// =============================================================================

/// Get TTS audio cache statistics
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_cache_info(state: State<'_, AiTtsEngineState>) -> Result<CacheInfo, String> {
    let engine = state.0.read().await;
    engine.get_cache_info()
}

/// Clear all cached TTS audio
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_cache_clear(state: State<'_, AiTtsEngineState>) -> Result<ClearResult, String> {
    let engine = state.0.read().await;
    let result = engine.clear_cache()?;

    tracing::info!(
        "TTS cache cleared: {} bytes, {} entries",
        result.bytes_cleared,
        result.entries_removed
    );

    Ok(result)
}

/// Invalidate cached audio for a specific voice
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_cache_invalidate_voice(
    state: State<'_, AiTtsEngineState>,
    voice_id: String,
) -> Result<ClearResult, String> {
    let engine = state.0.read().await;
    let result = engine.invalidate_voice_cache(&voice_id)?;

    tracing::info!(
        "TTS cache invalidated for voice {}: {} bytes, {} entries",
        voice_id,
        result.bytes_cleared,
        result.entries_removed
    );

    Ok(result)
}

// =============================================================================
// Pre-buffering Commands
// =============================================================================

/// Pre-generate and cache TTS audio without playing
///
/// This is called when a PDF page loads to ensure instant playback when user clicks play.
/// The audio is fetched from ElevenLabs and cached to disk, but not played.
#[tauri::command]
#[specta::specta]
pub async fn ai_tts_prebuffer(
    state: State<'_, AiTtsEngineState>,
    text: String,
    voice_id: Option<String>,
) -> Result<PrebufferResponse, String> {
    let engine = state.0.read().await;

    tracing::info!("Pre-buffering TTS: {} chars", text.len());

    match engine.prebuffer(&text, voice_id.as_deref()).await {
        Ok(result) => {
            tracing::info!(
                "Pre-buffered TTS: {} words, {:.2}s duration, cached={}",
                result.word_count,
                result.total_duration,
                result.was_cached
            );

            Ok(PrebufferResponse {
                success: true,
                cached: result.was_cached,
                word_count: result.word_count,
                total_duration: result.total_duration,
            })
        }
        Err(e) => {
            tracing::warn!("Pre-buffer failed (non-fatal): {}", e);
            // Return success=false but don't error - prebuffering is best-effort
            Ok(PrebufferResponse {
                success: false,
                cached: false,
                word_count: 0,
                total_duration: 0.0,
            })
        }
    }
}
