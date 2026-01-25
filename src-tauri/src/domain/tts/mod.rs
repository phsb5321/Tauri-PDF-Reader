//! TTS Domain Module
//!
//! Contains text-to-speech domain logic including text chunking.
//! This module defines:
//! - TextChunk entity for TTS playback
//! - Text chunking algorithms for optimal TTS
//! - Duration estimation utilities

pub mod text_chunking;

pub use text_chunking::{TextChunk, TextChunkBuilder, TextChunker};
