//! Text Chunking for TTS
//!
//! Splits text into sentence-based chunks for TTS playback.
//! This is a legacy module - prefer domain::tts::TextChunker for new code.

/// Split text into chunks at sentence boundaries
///
/// # Arguments
/// * `text` - The text to split
/// * `max_chunk_size` - Maximum characters per chunk
///
/// # Returns
/// Vector of text chunks, each under max_chunk_size
pub fn split_into_chunks(text: &str, max_chunk_size: usize) -> Vec<String> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_empty_text() {
        assert!(split_into_chunks("", 100).is_empty());
    }

    #[test]
    fn test_split_short_text() {
        let chunks = split_into_chunks("Hello world.", 100);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], "Hello world.");
    }

    #[test]
    fn test_split_multiple_sentences() {
        let chunks = split_into_chunks("First. Second. Third.", 15);
        assert!(chunks.len() >= 2);
    }

    #[test]
    fn test_split_long_sentence() {
        let long = "word ".repeat(50);
        let chunks = split_into_chunks(&long, 50);
        assert!(chunks.len() > 1);
        for chunk in &chunks {
            assert!(chunk.len() <= 55); // Some tolerance
        }
    }
}
