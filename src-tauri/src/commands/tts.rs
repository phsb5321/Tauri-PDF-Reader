use crate::db::models::{TtsInitResponse, VoiceInfo};
use crate::tts::{TtsCapabilities, TtsEngine, TtsStateResponse};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakResponse {
    pub chunk_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StopResponse {
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PauseResponse {
    pub success: bool,
    pub supported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumeResponse {
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetVoiceResponse {
    pub success: bool,
    pub voice: VoiceInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetRateResponse {
    pub success: bool,
    pub rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListVoicesResponse {
    pub voices: Vec<VoiceInfo>,
}

/// Initialize the TTS engine
#[tauri::command]
#[specta::specta]
pub fn tts_init(state: State<'_, TtsEngine>) -> Result<TtsInitResponse, String> {
    state.init()
}

/// List available voices
#[tauri::command]
#[specta::specta]
pub fn tts_list_voices(state: State<'_, TtsEngine>) -> Result<ListVoicesResponse, String> {
    let voices = state.list_voices()?;
    Ok(ListVoicesResponse { voices })
}

/// Speak text
#[tauri::command]
#[specta::specta]
pub fn tts_speak(
    state: State<'_, TtsEngine>,
    text: String,
    interrupt: Option<bool>,
) -> Result<SpeakResponse, String> {
    let chunk_id = state.speak(&text, interrupt.unwrap_or(false))?;
    Ok(SpeakResponse { chunk_id })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakLongResponse {
    pub total_chunks: usize,
}

/// Speak long text by splitting into chunks with progress events
#[tauri::command]
#[specta::specta]
pub fn tts_speak_long(
    app: AppHandle,
    state: State<'_, TtsEngine>,
    text: String,
    interrupt: Option<bool>,
) -> Result<SpeakLongResponse, String> {
    let total_chunks = state.speak_long(app, text, interrupt.unwrap_or(false))?;
    Ok(SpeakLongResponse { total_chunks })
}

/// Stop speaking
#[tauri::command]
#[specta::specta]
pub fn tts_stop(state: State<'_, TtsEngine>) -> Result<StopResponse, String> {
    let success = state.stop()?;
    Ok(StopResponse { success })
}

/// Pause speaking
#[tauri::command]
#[specta::specta]
pub fn tts_pause(state: State<'_, TtsEngine>) -> Result<PauseResponse, String> {
    let (success, supported) = state.pause()?;
    Ok(PauseResponse { success, supported })
}

/// Resume speaking
#[tauri::command]
#[specta::specta]
pub fn tts_resume(state: State<'_, TtsEngine>) -> Result<ResumeResponse, String> {
    let success = state.resume()?;
    Ok(ResumeResponse { success })
}

/// Set voice
#[tauri::command]
#[specta::specta]
pub fn tts_set_voice(
    state: State<'_, TtsEngine>,
    voice_id: String,
) -> Result<SetVoiceResponse, String> {
    let voice = state.set_voice(&voice_id)?;
    Ok(SetVoiceResponse {
        success: true,
        voice,
    })
}

/// Set speech rate
#[tauri::command]
#[specta::specta]
pub fn tts_set_rate(state: State<'_, TtsEngine>, rate: f64) -> Result<SetRateResponse, String> {
    let rate = state.set_rate(rate)?;
    Ok(SetRateResponse {
        success: true,
        rate,
    })
}

/// Get current TTS state
#[tauri::command]
#[specta::specta]
pub fn tts_get_state(state: State<'_, TtsEngine>) -> Result<TtsStateResponse, String> {
    state.get_state()
}

/// Check TTS capabilities
#[tauri::command]
#[specta::specta]
pub fn tts_check_capabilities(state: State<'_, TtsEngine>) -> Result<TtsCapabilities, String> {
    state.get_capabilities()
}
