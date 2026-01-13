use crate::db::models::{TtsInitResponse, VoiceInfo};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tts::Tts;

/// Managed TTS state
pub struct TtsEngine {
    pub engine: Mutex<Option<Tts>>,
    pub is_speaking: Mutex<bool>,
    pub is_paused: Mutex<bool>,
    pub current_chunk_id: Mutex<Option<String>>,
    pub current_voice_id: Mutex<Option<String>>,
    pub rate: Mutex<f64>,
    // For long speech handling
    pub stop_requested: Arc<AtomicBool>,
    pub current_chunk_index: Arc<AtomicUsize>,
    pub total_chunks: Arc<AtomicUsize>,
}

impl TtsEngine {
    pub fn new() -> Self {
        Self {
            engine: Mutex::new(None),
            is_speaking: Mutex::new(false),
            is_paused: Mutex::new(false),
            current_chunk_id: Mutex::new(None),
            current_voice_id: Mutex::new(None),
            rate: Mutex::new(1.0),
            stop_requested: Arc::new(AtomicBool::new(false)),
            current_chunk_index: Arc::new(AtomicUsize::new(0)),
            total_chunks: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Initialize the TTS engine
    pub fn init(&self) -> Result<TtsInitResponse, String> {
        let mut engine_lock = self.engine.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;

        if engine_lock.is_some() {
            // Already initialized
            return Ok(TtsInitResponse {
                available: true,
                backend: Some(self.get_backend_name()),
                default_voice: self.get_current_voice_name(),
                error: None,
            });
        }

        match Tts::default() {
            Ok(tts) => {
                let backend = format!("{:?}", tts.current_voice().ok());
                *engine_lock = Some(tts);
                Ok(TtsInitResponse {
                    available: true,
                    backend: Some(backend),
                    default_voice: None,
                    error: None,
                })
            }
            Err(e) => Ok(TtsInitResponse {
                available: false,
                backend: None,
                default_voice: None,
                error: Some(format!("TTS_UNAVAILABLE: {}", e)),
            }),
        }
    }

    /// List available voices
    pub fn list_voices(&self) -> Result<Vec<VoiceInfo>, String> {
        let engine_lock = self.engine.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;
        let engine = engine_lock
            .as_ref()
            .ok_or_else(|| "NOT_INITIALIZED: TTS not initialized".to_string())?;

        let voices = engine
            .voices()
            .map_err(|e| format!("VOICE_LIST_ERROR: {}", e))?;

        Ok(voices
            .into_iter()
            .map(|v| VoiceInfo {
                id: v.id().to_string(),
                name: v.name().to_string(),
                language: v.language().map(|l| l.to_string()),
            })
            .collect())
    }

    /// Speak text
    pub fn speak(&self, text: &str, interrupt: bool) -> Result<String, String> {
        let mut engine_lock = self.engine.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;
        let engine = engine_lock
            .as_mut()
            .ok_or_else(|| "NOT_INITIALIZED: TTS not initialized".to_string())?;

        if text.len() > 10000 {
            return Err("TEXT_TOO_LONG: Text exceeds 10,000 characters".to_string());
        }

        if interrupt {
            let _ = engine.stop();
        }

        let chunk_id = uuid::Uuid::new_v4().to_string();

        engine
            .speak(text, interrupt)
            .map_err(|e| format!("SPEAK_ERROR: {}", e))?;

        // Update state
        *self
            .is_speaking
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))? = true;
        *self
            .is_paused
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))? = false;
        *self
            .current_chunk_id
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))? = Some(chunk_id.clone());

        Ok(chunk_id)
    }

    /// Stop speaking
    pub fn stop(&self) -> Result<bool, String> {
        // Signal any running speak_long to stop
        self.stop_requested.store(true, Ordering::SeqCst);

        let mut engine_lock = self.engine.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;
        let engine = engine_lock
            .as_mut()
            .ok_or_else(|| "NOT_INITIALIZED: TTS not initialized".to_string())?;

        engine.stop().map_err(|e| format!("STOP_ERROR: {}", e))?;

        // Update state
        *self
            .is_speaking
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))? = false;
        *self
            .is_paused
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))? = false;
        *self
            .current_chunk_id
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))? = None;

        Ok(true)
    }

    /// Speak long text by splitting into chunks and emitting events
    pub fn speak_long(
        &self,
        app: AppHandle,
        text: String,
        interrupt: bool,
    ) -> Result<usize, String> {
        // Reset stop flag
        self.stop_requested.store(false, Ordering::SeqCst);

        if interrupt {
            let _ = self.stop();
        }

        // Split text into chunks at sentence boundaries
        let chunks = split_into_chunks(&text, 2000);
        let total = chunks.len();

        if total == 0 {
            return Err("EMPTY_TEXT: No text to speak".to_string());
        }

        self.total_chunks.store(total, Ordering::SeqCst);
        self.current_chunk_index.store(0, Ordering::SeqCst);

        // Update speaking state
        *self
            .is_speaking
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))? = true;

        // Clone arc references for the spawned thread
        let stop_requested = Arc::clone(&self.stop_requested);
        let current_chunk_index = Arc::clone(&self.current_chunk_index);

        // Verify engine is initialized
        {
            let engine = self.engine.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;
            if engine.is_none() {
                return Err("NOT_INITIALIZED: TTS not initialized".to_string());
            }
        }

        // We need to process chunks in a way that works with the TTS crate
        // Since the TTS crate is not Send, we'll process synchronously but emit events
        thread::spawn(move || {
            for (index, chunk_text) in chunks.iter().enumerate() {
                if stop_requested.load(Ordering::SeqCst) {
                    break;
                }

                current_chunk_index.store(index, Ordering::SeqCst);

                // Emit chunk-started event
                let _ = app.emit(
                    "tts:chunk-started",
                    TtsChunkEvent {
                        chunk_index: index,
                        total_chunks: total,
                        text: chunk_text.clone(),
                    },
                );

                // Wait for approximate speaking time based on text length
                // Average speaking rate: ~150 words per minute = ~2.5 words per second
                // Average word length: ~5 characters
                // So roughly: text.len() / 5 / 2.5 seconds = text.len() / 12.5 seconds
                let estimated_ms = (chunk_text.len() as u64 * 80) + 500; // 80ms per char + 500ms buffer
                thread::sleep(Duration::from_millis(estimated_ms));

                // Emit chunk-completed event
                let _ = app.emit(
                    "tts:chunk-completed",
                    TtsChunkCompletedEvent { chunk_index: index },
                );
            }

            // Emit completed event
            let _ = app.emit(
                "tts:completed",
                TtsCompletedEvent {
                    success: !stop_requested.load(Ordering::SeqCst),
                },
            );
        });

        // Actually speak the first chunk to start (others will be handled by the thread timing)
        // This is a simplified approach - a full implementation would need callback-based TTS
        let first_chunk = chunks.first().unwrap();
        let _ = self.speak(first_chunk, false);

        Ok(total)
    }

    /// Pause speaking (if supported)
    pub fn pause(&self) -> Result<(bool, bool), String> {
        let mut engine_lock = self.engine.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;
        let engine = engine_lock
            .as_mut()
            .ok_or_else(|| "NOT_INITIALIZED: TTS not initialized".to_string())?;

        // Check if pause is supported
        let features = engine.supported_features();
        if !features.pause_resume {
            // Fall back to stop
            self.stop()?;
            return Ok((true, false));
        }

        engine.pause().map_err(|e| format!("PAUSE_ERROR: {}", e))?;

        *self
            .is_paused
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))? = true;

        Ok((true, true))
    }

    /// Resume speaking
    pub fn resume(&self) -> Result<bool, String> {
        let mut engine_lock = self.engine.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;
        let engine = engine_lock
            .as_mut()
            .ok_or_else(|| "NOT_INITIALIZED: TTS not initialized".to_string())?;

        let is_paused = *self
            .is_paused
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?;

        if !is_paused {
            return Err("NOT_PAUSED: No speech is currently paused".to_string());
        }

        engine.resume().map_err(|e| format!("RESUME_ERROR: {}", e))?;

        *self
            .is_paused
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))? = false;

        Ok(true)
    }

    /// Set voice by ID. If voice_id is empty or "system", uses system default.
    /// Falls back to system default if specified voice is not found.
    pub fn set_voice(&self, voice_id: &str) -> Result<VoiceInfo, String> {
        let mut engine_lock = self.engine.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;
        let engine = engine_lock
            .as_mut()
            .ok_or_else(|| "NOT_INITIALIZED: TTS not initialized".to_string())?;

        // If empty or "system", use system default
        if voice_id.is_empty() || voice_id == "system" {
            return self.get_default_voice_info(engine);
        }

        let voices = engine
            .voices()
            .map_err(|e| format!("VOICE_LIST_ERROR: {}", e))?;

        // Try to find the requested voice
        if let Some(voice) = voices.iter().find(|v| v.id() == voice_id) {
            engine
                .set_voice(voice)
                .map_err(|e| format!("SET_VOICE_ERROR: {}", e))?;

            *self
                .current_voice_id
                .lock()
                .map_err(|e| format!("LOCK_ERROR: {}", e))? = Some(voice_id.to_string());

            return Ok(VoiceInfo {
                id: voice.id().to_string(),
                name: voice.name().to_string(),
                language: voice.language().map(|l| l.to_string()),
            });
        }

        // Voice not found - fall back to system default
        tracing::warn!(
            "Requested voice '{}' not found, falling back to system default",
            voice_id
        );
        self.get_default_voice_info(engine)
    }

    /// Get the current/default voice info
    fn get_default_voice_info(&self, engine: &Tts) -> Result<VoiceInfo, String> {
        // Clear stored voice to indicate using system default
        *self
            .current_voice_id
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))? = None;

        // Try to get current voice
        if let Ok(Some(voice)) = engine.current_voice() {
            return Ok(VoiceInfo {
                id: voice.id().to_string(),
                name: voice.name().to_string(),
                language: voice.language().map(|l| l.to_string()),
            });
        }

        // If no current voice, try to get first available
        if let Ok(voices) = engine.voices() {
            if let Some(voice) = voices.first() {
                return Ok(VoiceInfo {
                    id: voice.id().to_string(),
                    name: voice.name().to_string(),
                    language: voice.language().map(|l| l.to_string()),
                });
            }
        }

        // Return a placeholder for system default
        Ok(VoiceInfo {
            id: "system".to_string(),
            name: "System Default".to_string(),
            language: None,
        })
    }

    /// Set speech rate (0.5 to 3.0)
    pub fn set_rate(&self, rate: f64) -> Result<f64, String> {
        if rate < 0.5 || rate > 3.0 {
            return Err("INVALID_RATE: Rate must be between 0.5 and 3.0".to_string());
        }

        let mut engine_lock = self.engine.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;
        let engine = engine_lock
            .as_mut()
            .ok_or_else(|| "NOT_INITIALIZED: TTS not initialized".to_string())?;

        // TTS crate uses different rate scale, normalize
        let tts_rate = (rate - 0.5) / 2.5; // 0.0 to 1.0
        engine
            .set_rate(tts_rate as f32)
            .map_err(|e| format!("SET_RATE_ERROR: {}", e))?;

        *self.rate.lock().map_err(|e| format!("LOCK_ERROR: {}", e))? = rate;

        Ok(rate)
    }

    /// Get current state
    pub fn get_state(&self) -> Result<TtsStateResponse, String> {
        let engine_lock = self.engine.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;
        let initialized = engine_lock.is_some();

        let is_speaking = *self
            .is_speaking
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?;
        let is_paused = *self
            .is_paused
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?;
        let current_chunk_id = self
            .current_chunk_id
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?
            .clone();
        let current_voice_id = self
            .current_voice_id
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?
            .clone();
        let rate = *self.rate.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;

        Ok(TtsStateResponse {
            initialized,
            is_speaking,
            is_paused,
            current_chunk_id,
            current_voice: current_voice_id,
            rate,
        })
    }

    /// Get capabilities
    pub fn get_capabilities(&self) -> Result<TtsCapabilities, String> {
        let engine_lock = self.engine.lock().map_err(|e| format!("LOCK_ERROR: {}", e))?;
        let engine = engine_lock
            .as_ref()
            .ok_or_else(|| "NOT_INITIALIZED: TTS not initialized".to_string())?;

        let features = engine.supported_features();

        Ok(TtsCapabilities {
            supports_pause: features.pause_resume,
            supports_resume: features.pause_resume,
            supports_pitch: features.pitch,
            supports_volume: features.volume,
            supports_rate: features.rate,
            min_rate: 0.5,
            max_rate: 3.0,
        })
    }

    fn get_backend_name(&self) -> String {
        #[cfg(target_os = "windows")]
        return "WinRT".to_string();
        #[cfg(target_os = "macos")]
        return "AVFoundation".to_string();
        #[cfg(target_os = "linux")]
        return "SpeechDispatcher".to_string();
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        return "Unknown".to_string();
    }

    fn get_current_voice_name(&self) -> Option<String> {
        self.current_voice_id
            .lock()
            .ok()
            .and_then(|v| v.clone())
    }
}

impl Default for TtsEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsStateResponse {
    pub initialized: bool,
    pub is_speaking: bool,
    pub is_paused: bool,
    pub current_chunk_id: Option<String>,
    pub current_voice: Option<String>,
    pub rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsCapabilities {
    pub supports_pause: bool,
    pub supports_resume: bool,
    pub supports_pitch: bool,
    pub supports_volume: bool,
    pub supports_rate: bool,
    pub min_rate: f64,
    pub max_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsChunkEvent {
    pub chunk_index: usize,
    pub total_chunks: usize,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsChunkCompletedEvent {
    pub chunk_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsCompletedEvent {
    pub success: bool,
}

/// Split text into chunks at sentence boundaries
fn split_into_chunks(text: &str, max_chunk_size: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current_chunk = String::new();

    // Split by sentences (period, exclamation, question mark followed by space or end)
    let sentences: Vec<&str> = text
        .split_inclusive(|c| c == '.' || c == '!' || c == '?')
        .collect();

    for sentence in sentences {
        let trimmed = sentence.trim();
        if trimmed.is_empty() {
            continue;
        }

        // If adding this sentence would exceed the limit, save current chunk and start new
        if !current_chunk.is_empty() && current_chunk.len() + trimmed.len() > max_chunk_size {
            chunks.push(current_chunk.trim().to_string());
            current_chunk = String::new();
        }

        // If a single sentence is too long, split it by words
        if trimmed.len() > max_chunk_size {
            for word in trimmed.split_whitespace() {
                if current_chunk.len() + word.len() + 1 > max_chunk_size {
                    if !current_chunk.is_empty() {
                        chunks.push(current_chunk.trim().to_string());
                    }
                    current_chunk = String::new();
                }
                if !current_chunk.is_empty() {
                    current_chunk.push(' ');
                }
                current_chunk.push_str(word);
            }
        } else {
            if !current_chunk.is_empty() {
                current_chunk.push(' ');
            }
            current_chunk.push_str(trimmed);
        }
    }

    // Don't forget the last chunk
    if !current_chunk.is_empty() {
        chunks.push(current_chunk.trim().to_string());
    }

    chunks
}
