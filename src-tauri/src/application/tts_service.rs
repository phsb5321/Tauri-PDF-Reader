//! TTS Application Service
//!
//! Provides use cases for text-to-speech operations.
//! Uses generic trait bounds to allow dependency injection of the engine.

use crate::domain::DomainError;
use crate::ports::{TtsCapabilities, TtsChunk, TtsEngine, TtsInitResponse, TtsState, VoiceInfo};

/// Application service for TTS operations.
///
/// This service:
/// - Validates TTS operation parameters
/// - Delegates to the injected TTS engine
/// - Provides domain-level TTS orchestration
pub struct TtsService<E: TtsEngine> {
    engine: E,
}

impl<E: TtsEngine> TtsService<E> {
    /// Create a new TtsService with the given engine.
    pub fn new(engine: E) -> Self {
        Self { engine }
    }

    /// Initialize the TTS engine.
    pub async fn init(&self) -> Result<TtsInitResponse, DomainError> {
        self.engine.init().await
    }

    /// List available voices.
    pub async fn list_voices(&self) -> Result<Vec<VoiceInfo>, DomainError> {
        self.engine.list_voices().await
    }

    /// Speak a single text chunk.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if text is empty.
    pub async fn speak(&self, text: String, chunk_id: Option<String>) -> Result<(), DomainError> {
        // Validate text is not empty
        if text.trim().is_empty() {
            return Err(DomainError::validation("Text cannot be empty"));
        }

        self.engine.speak(text, chunk_id).await
    }

    /// Speak multiple chunks sequentially.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if chunks list is empty or any chunk has empty text.
    pub async fn speak_long(&self, chunks: Vec<TtsChunk>) -> Result<(), DomainError> {
        // Validate chunks list
        if chunks.is_empty() {
            return Err(DomainError::validation("Chunks list cannot be empty"));
        }

        // Validate each chunk
        for (i, chunk) in chunks.iter().enumerate() {
            if chunk.text.trim().is_empty() {
                return Err(DomainError::validation(format!(
                    "Chunk {} has empty text",
                    i
                )));
            }
        }

        self.engine.speak_long(chunks).await
    }

    /// Stop all speech.
    pub async fn stop(&self) -> Result<(), DomainError> {
        self.engine.stop().await
    }

    /// Pause current speech.
    pub async fn pause(&self) -> Result<(), DomainError> {
        self.engine.pause().await
    }

    /// Resume paused speech.
    pub async fn resume(&self) -> Result<(), DomainError> {
        self.engine.resume().await
    }

    /// Set the active voice.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if voice_id is empty.
    pub async fn set_voice(&self, voice_id: String) -> Result<(), DomainError> {
        if voice_id.trim().is_empty() {
            return Err(DomainError::validation("Voice ID cannot be empty"));
        }

        self.engine.set_voice(voice_id).await
    }

    /// Set playback rate.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if rate is not in [0.5, 3.0].
    pub async fn set_rate(&self, rate: f64) -> Result<(), DomainError> {
        if !(0.5..=3.0).contains(&rate) {
            return Err(DomainError::validation("Rate must be between 0.5 and 3.0"));
        }

        self.engine.set_rate(rate).await
    }

    /// Get current TTS state.
    pub async fn get_state(&self) -> Result<TtsState, DomainError> {
        self.engine.get_state().await
    }

    /// Check engine capabilities.
    pub async fn check_capabilities(&self) -> Result<TtsCapabilities, DomainError> {
        self.engine.check_capabilities().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ports::MockTtsEngine;
    use mockall::predicate::*;

    // ==========================================================================
    // Init Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_init_success() {
        let mut mock = MockTtsEngine::new();
        mock.expect_init().times(1).returning(|| {
            Ok(TtsInitResponse {
                available: true,
                backend: Some("native".to_string()),
                default_voice: Some("voice-1".to_string()),
                error: None,
            })
        });

        let service = TtsService::new(mock);
        let result = service.init().await;

        assert!(result.is_ok());
        assert!(result.unwrap().available);
    }

    #[tokio::test]
    async fn test_init_unavailable() {
        let mut mock = MockTtsEngine::new();
        mock.expect_init().times(1).returning(|| {
            Ok(TtsInitResponse {
                available: false,
                backend: None,
                default_voice: None,
                error: Some("TTS not available".to_string()),
            })
        });

        let service = TtsService::new(mock);
        let result = service.init().await;

        assert!(result.is_ok());
        assert!(!result.unwrap().available);
    }

    // ==========================================================================
    // List Voices Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_list_voices() {
        let mut mock = MockTtsEngine::new();
        mock.expect_list_voices().times(1).returning(|| {
            Ok(vec![
                VoiceInfo {
                    id: "voice-1".to_string(),
                    name: "Voice One".to_string(),
                    language: Some("en-US".to_string()),
                },
                VoiceInfo {
                    id: "voice-2".to_string(),
                    name: "Voice Two".to_string(),
                    language: Some("en-GB".to_string()),
                },
            ])
        });

        let service = TtsService::new(mock);
        let result = service.list_voices().await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 2);
    }

    // ==========================================================================
    // Speak Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_speak_success() {
        let mut mock = MockTtsEngine::new();
        mock.expect_speak()
            .with(
                eq("Hello world".to_string()),
                eq(Some("chunk-1".to_string())),
            )
            .times(1)
            .returning(|_, _| Ok(()));

        let service = TtsService::new(mock);
        let result = service
            .speak("Hello world".to_string(), Some("chunk-1".to_string()))
            .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_speak_empty_text_rejected() {
        let mock = MockTtsEngine::new();

        let service = TtsService::new(mock);
        let result = service.speak("".to_string(), None).await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DomainError::Validation(_)));
    }

    #[tokio::test]
    async fn test_speak_whitespace_text_rejected() {
        let mock = MockTtsEngine::new();

        let service = TtsService::new(mock);
        let result = service.speak("   ".to_string(), None).await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Speak Long Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_speak_long_success() {
        let mut mock = MockTtsEngine::new();
        mock.expect_speak_long().times(1).returning(|_| Ok(()));

        let service = TtsService::new(mock);
        let chunks = vec![
            TtsChunk {
                id: "chunk-1".to_string(),
                text: "First chunk.".to_string(),
            },
            TtsChunk {
                id: "chunk-2".to_string(),
                text: "Second chunk.".to_string(),
            },
        ];
        let result = service.speak_long(chunks).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_speak_long_empty_chunks_rejected() {
        let mock = MockTtsEngine::new();

        let service = TtsService::new(mock);
        let result = service.speak_long(vec![]).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_speak_long_empty_text_chunk_rejected() {
        let mock = MockTtsEngine::new();

        let service = TtsService::new(mock);
        let chunks = vec![
            TtsChunk {
                id: "chunk-1".to_string(),
                text: "Valid text.".to_string(),
            },
            TtsChunk {
                id: "chunk-2".to_string(),
                text: "".to_string(), // Invalid
            },
        ];
        let result = service.speak_long(chunks).await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Control Tests (Stop, Pause, Resume)
    // ==========================================================================

    #[tokio::test]
    async fn test_stop() {
        let mut mock = MockTtsEngine::new();
        mock.expect_stop().times(1).returning(|| Ok(()));

        let service = TtsService::new(mock);
        let result = service.stop().await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_pause() {
        let mut mock = MockTtsEngine::new();
        mock.expect_pause().times(1).returning(|| Ok(()));

        let service = TtsService::new(mock);
        let result = service.pause().await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_resume() {
        let mut mock = MockTtsEngine::new();
        mock.expect_resume().times(1).returning(|| Ok(()));

        let service = TtsService::new(mock);
        let result = service.resume().await;

        assert!(result.is_ok());
    }

    // ==========================================================================
    // Set Voice Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_set_voice_success() {
        let mut mock = MockTtsEngine::new();
        mock.expect_set_voice()
            .with(eq("voice-1".to_string()))
            .times(1)
            .returning(|_| Ok(()));

        let service = TtsService::new(mock);
        let result = service.set_voice("voice-1".to_string()).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_set_voice_empty_rejected() {
        let mock = MockTtsEngine::new();

        let service = TtsService::new(mock);
        let result = service.set_voice("".to_string()).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_set_voice_whitespace_rejected() {
        let mock = MockTtsEngine::new();

        let service = TtsService::new(mock);
        let result = service.set_voice("   ".to_string()).await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Set Rate Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_set_rate_valid_range() {
        let mut mock = MockTtsEngine::new();
        mock.expect_set_rate()
            .with(eq(1.5))
            .times(1)
            .returning(|_| Ok(()));

        let service = TtsService::new(mock);
        let result = service.set_rate(1.5).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_set_rate_min_boundary() {
        let mut mock = MockTtsEngine::new();
        mock.expect_set_rate()
            .with(eq(0.5))
            .times(1)
            .returning(|_| Ok(()));

        let service = TtsService::new(mock);
        let result = service.set_rate(0.5).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_set_rate_max_boundary() {
        let mut mock = MockTtsEngine::new();
        mock.expect_set_rate()
            .with(eq(3.0))
            .times(1)
            .returning(|_| Ok(()));

        let service = TtsService::new(mock);
        let result = service.set_rate(3.0).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_set_rate_below_min_rejected() {
        let mock = MockTtsEngine::new();

        let service = TtsService::new(mock);
        let result = service.set_rate(0.4).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_set_rate_above_max_rejected() {
        let mock = MockTtsEngine::new();

        let service = TtsService::new(mock);
        let result = service.set_rate(3.1).await;

        assert!(result.is_err());
    }

    // ==========================================================================
    // Get State Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_get_state() {
        let mut mock = MockTtsEngine::new();
        mock.expect_get_state().times(1).returning(|| {
            Ok(TtsState {
                initialized: true,
                is_speaking: false,
                is_paused: false,
                current_chunk_id: None,
                current_voice: Some(VoiceInfo {
                    id: "voice-1".to_string(),
                    name: "Voice One".to_string(),
                    language: Some("en-US".to_string()),
                }),
                rate: 1.0,
            })
        });

        let service = TtsService::new(mock);
        let result = service.get_state().await;

        assert!(result.is_ok());
        let state = result.unwrap();
        assert!(state.initialized);
        assert!(!state.is_speaking);
    }

    // ==========================================================================
    // Check Capabilities Tests
    // ==========================================================================

    #[tokio::test]
    async fn test_check_capabilities() {
        let mut mock = MockTtsEngine::new();
        mock.expect_check_capabilities().times(1).returning(|| {
            Ok(TtsCapabilities {
                supports_utterance: true,
                supports_rate: true,
                supports_pitch: true,
                supports_volume: true,
            })
        });

        let service = TtsService::new(mock);
        let result = service.check_capabilities().await;

        assert!(result.is_ok());
        let caps = result.unwrap();
        assert!(caps.supports_rate);
    }
}
