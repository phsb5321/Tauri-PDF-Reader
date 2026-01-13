//! AI TTS Tauri commands
//!
//! Provides commands for text-to-speech using AI providers like ElevenLabs.

use crate::ai_tts::{AiTtsEngine, TtsConfig, VoiceInfo};
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

// TTS Events emitted to frontend

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TtsStartedEvent {
    text: String,
    voice_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TtsCompletedEvent {
    success: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TtsErrorEvent {
    error: String,
}

/// Initialize AI TTS with API key
#[tauri::command]
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
pub async fn ai_tts_list_voices(
    state: State<'_, AiTtsEngineState>,
) -> Result<VoicesResponse, String> {
    let engine = state.0.read().await;

    let voices = engine.list_voices().await?;

    Ok(VoicesResponse { voices })
}

/// Speak text using AI TTS
#[tauri::command]
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

    // Speak
    let result = engine.speak(&text, voice_id.as_deref()).await;

    match result {
        Ok(_) => {
            let _ = app.emit("ai-tts:completed", TtsCompletedEvent { success: true });
            Ok(SpeakResponse { success: true })
        }
        Err(e) => {
            let _ = app.emit("ai-tts:error", TtsErrorEvent { error: e.clone() });
            Err(e)
        }
    }
}

/// Stop TTS playback
#[tauri::command]
pub async fn ai_tts_stop(
    app: AppHandle,
    state: State<'_, AiTtsEngineState>,
) -> Result<StopResponse, String> {
    let engine = state.0.read().await;

    engine.stop()?;

    let _ = app.emit("ai-tts:stopped", ());

    Ok(StopResponse { success: true })
}

/// Pause TTS playback
#[tauri::command]
pub async fn ai_tts_pause(state: State<'_, AiTtsEngineState>) -> Result<StopResponse, String> {
    let engine = state.0.read().await;

    engine.pause()?;

    Ok(StopResponse { success: true })
}

/// Resume TTS playback
#[tauri::command]
pub async fn ai_tts_resume(state: State<'_, AiTtsEngineState>) -> Result<StopResponse, String> {
    let engine = state.0.read().await;

    engine.resume()?;

    Ok(StopResponse { success: true })
}

/// Set voice for TTS
#[tauri::command]
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
pub async fn ai_tts_get_config(state: State<'_, AiTtsEngineState>) -> Result<TtsConfig, String> {
    let engine = state.0.read().await;

    Ok(engine.get_config().await)
}
