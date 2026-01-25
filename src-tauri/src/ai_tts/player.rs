//! Audio playback using rodio
//!
//! Handles MP3 decoding and playback to system audio output.
//!
//! Note: This module is prepared for ElevenLabs TTS integration but not yet active.

#![allow(dead_code)]

use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use std::io::Cursor;
use std::sync::{Arc, Mutex};

/// Audio player state
struct PlayerState {
    sink: Option<Sink>,
    _stream: Option<OutputStream>,
    _stream_handle: Option<OutputStreamHandle>,
}

/// Audio player for TTS output
pub struct AudioPlayer {
    state: Arc<Mutex<PlayerState>>,
}

impl AudioPlayer {
    /// Create a new audio player
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(PlayerState {
                sink: None,
                _stream: None,
                _stream_handle: None,
            })),
        }
    }

    /// Initialize audio output stream
    fn ensure_stream(&self) -> Result<(), String> {
        let mut state = self
            .state
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?;

        if state._stream.is_none() {
            let (stream, stream_handle) =
                OutputStream::try_default().map_err(|e| format!("AUDIO_INIT_ERROR: {}", e))?;

            state._stream = Some(stream);
            state._stream_handle = Some(stream_handle);
        }

        Ok(())
    }

    /// Play MP3 audio data
    pub fn play_mp3(&self, data: &[u8]) -> Result<(), String> {
        tracing::info!("play_mp3 called with {} bytes of audio data", data.len());
        
        self.ensure_stream()?;

        let mut state = self
            .state
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?;

        // Stop any existing playback
        if let Some(sink) = state.sink.take() {
            tracing::debug!("Stopping existing playback");
            sink.stop();
        }

        // Get stream handle
        let stream_handle = state
            ._stream_handle
            .as_ref()
            .ok_or("AUDIO_NOT_INITIALIZED")?;

        // Create cursor from data for decoding
        let cursor = Cursor::new(data.to_vec());

        // Decode MP3
        tracing::debug!("Decoding MP3 audio...");
        let source = Decoder::new(cursor)
            .map_err(|e| format!("DECODE_ERROR: Failed to decode MP3: {}", e))?;

        // Create sink and play
        tracing::debug!("Creating audio sink...");
        let sink = Sink::try_new(stream_handle).map_err(|e| format!("SINK_ERROR: {}", e))?;

        sink.append(source);
        tracing::info!("Audio playback started successfully, sink empty={}", sink.empty());

        state.sink = Some(sink);

        Ok(())
    }

    /// Play MP3 and wait for completion
    pub fn play_mp3_blocking(&self, data: &[u8]) -> Result<(), String> {
        self.play_mp3(data)?;

        // Wait for playback to complete
        let state = self
            .state
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?;

        if let Some(ref sink) = state.sink {
            sink.sleep_until_end();
        }

        Ok(())
    }

    /// Stop playback
    pub fn stop(&self) -> Result<(), String> {
        let mut state = self
            .state
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?;

        if let Some(sink) = state.sink.take() {
            sink.stop();
            tracing::debug!("Stopped audio playback");
        }

        Ok(())
    }

    /// Pause playback
    pub fn pause(&self) -> Result<(), String> {
        let state = self
            .state
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?;

        if let Some(ref sink) = state.sink {
            sink.pause();
            tracing::debug!("Paused audio playback");
        }

        Ok(())
    }

    /// Resume playback
    pub fn resume(&self) -> Result<(), String> {
        let state = self
            .state
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?;

        if let Some(ref sink) = state.sink {
            sink.play();
            tracing::debug!("Resumed audio playback");
        }

        Ok(())
    }

    /// Set volume (0.0 to 1.0)
    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        let state = self
            .state
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?;

        if let Some(ref sink) = state.sink {
            sink.set_volume(volume.clamp(0.0, 1.0));
        }

        Ok(())
    }

    /// Set playback speed (0.5 to 2.0)
    pub fn set_speed(&self, speed: f32) -> Result<(), String> {
        let state = self
            .state
            .lock()
            .map_err(|e| format!("LOCK_ERROR: {}", e))?;

        if let Some(ref sink) = state.sink {
            sink.set_speed(speed.clamp(0.5, 2.0));
        }

        Ok(())
    }

    /// Check if currently playing
    pub fn is_playing(&self) -> bool {
        let state = match self.state.lock() {
            Ok(s) => s,
            Err(_) => return false,
        };

        state
            .sink
            .as_ref()
            .map(|s| !s.is_paused() && !s.empty())
            .unwrap_or(false)
    }

    /// Check if paused
    pub fn is_paused(&self) -> bool {
        let state = match self.state.lock() {
            Ok(s) => s,
            Err(_) => return false,
        };

        state.sink.as_ref().map(|s| s.is_paused()).unwrap_or(false)
    }
}

impl Default for AudioPlayer {
    fn default() -> Self {
        Self::new()
    }
}

// Safety: AudioPlayer can be shared across threads via Arc<Mutex>
unsafe impl Send for AudioPlayer {}
unsafe impl Sync for AudioPlayer {}
