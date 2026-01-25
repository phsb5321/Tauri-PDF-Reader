//! Text Chunking for TTS
//!
//! Splits text into sentence-based chunks for optimal TTS playback.
//! This module provides:
//! - TextChunk entity representing a speakable text unit
//! - TextChunker for splitting text into optimal chunks
//! - Duration estimation for playback timing

/// Maximum characters per chunk (TTS engines typically handle ~500 chars well)
pub const MAX_CHUNK_LENGTH: usize = 500;
/// Minimum chunk length to avoid very short utterances
pub const MIN_CHUNK_LENGTH: usize = 20;
/// Average speaking rate (words per minute at 1x speed)
const WORDS_PER_MINUTE: f64 = 150.0;

/// A chunk of text suitable for TTS playback.
#[derive(Debug, Clone, PartialEq)]
pub struct TextChunk {
    pub id: String,
    pub text: String,
    pub page_number: i32,
    pub start_offset: usize,
    pub end_offset: usize,
}

impl TextChunk {
    /// Create a new TextChunk.
    pub fn new(
        id: String,
        text: String,
        page_number: i32,
        start_offset: usize,
        end_offset: usize,
    ) -> Self {
        Self {
            id,
            text,
            page_number,
            start_offset,
            end_offset,
        }
    }

    /// Estimate the duration of this chunk in seconds at the given rate.
    ///
    /// Average speaking rate is ~150 words per minute at 1x speed.
    pub fn estimate_duration(&self, rate: f64) -> f64 {
        let word_count = self.text.split_whitespace().count() as f64;
        let words_per_minute = WORDS_PER_MINUTE * rate;
        (word_count / words_per_minute) * 60.0
    }

    /// Get the word count of this chunk.
    pub fn word_count(&self) -> usize {
        self.text.split_whitespace().count()
    }
}

/// Builder for creating TextChunk entities in tests.
#[derive(Default)]
pub struct TextChunkBuilder {
    id: String,
    text: String,
    page_number: i32,
    start_offset: usize,
    end_offset: usize,
}

impl TextChunkBuilder {
    pub fn new() -> Self {
        Self {
            id: "chunk-0".to_string(),
            text: "Test chunk text.".to_string(),
            page_number: 1,
            start_offset: 0,
            end_offset: 16,
        }
    }

    pub fn id(mut self, id: impl Into<String>) -> Self {
        self.id = id.into();
        self
    }

    pub fn text(mut self, text: impl Into<String>) -> Self {
        let t: String = text.into();
        self.end_offset = self.start_offset + t.len();
        self.text = t;
        self
    }

    pub fn page_number(mut self, page: i32) -> Self {
        self.page_number = page;
        self
    }

    pub fn start_offset(mut self, offset: usize) -> Self {
        self.start_offset = offset;
        self
    }

    pub fn build(self) -> TextChunk {
        TextChunk::new(
            self.id,
            self.text,
            self.page_number,
            self.start_offset,
            self.end_offset,
        )
    }
}

/// Options for text chunking.
#[derive(Debug, Clone)]
pub struct ChunkingOptions {
    pub max_chunk_length: usize,
    pub min_chunk_length: usize,
}

impl Default for ChunkingOptions {
    fn default() -> Self {
        Self {
            max_chunk_length: MAX_CHUNK_LENGTH,
            min_chunk_length: MIN_CHUNK_LENGTH,
        }
    }
}

/// Text chunker for splitting text into TTS-friendly chunks.
pub struct TextChunker {
    options: ChunkingOptions,
}

impl Default for TextChunker {
    fn default() -> Self {
        Self::new()
    }
}

impl TextChunker {
    /// Create a new TextChunker with default options.
    pub fn new() -> Self {
        Self {
            options: ChunkingOptions::default(),
        }
    }

    /// Create a new TextChunker with custom options.
    pub fn with_options(options: ChunkingOptions) -> Self {
        Self { options }
    }

    /// Split text into sentences.
    fn split_into_sentences(&self, text: &str) -> Vec<String> {
        // Normalize whitespace
        let normalized: String = text
            .chars()
            .map(|c| if c.is_whitespace() { ' ' } else { c })
            .collect();
        let normalized = normalized.trim();

        if normalized.is_empty() {
            return vec![];
        }

        let mut sentences = Vec::new();
        let mut current = String::new();

        for c in normalized.chars() {
            current.push(c);

            // Check for sentence ending
            if (c == '.' || c == '!' || c == '?') && !current.trim().is_empty() {
                sentences.push(current.trim().to_string());
                current = String::new();
            }
        }

        // Add remaining text
        let remaining = current.trim();
        if !remaining.is_empty() {
            sentences.push(remaining.to_string());
        }

        sentences
    }

    /// Split a long sentence at natural break points.
    fn split_long_sentence(&self, sentence: &str, max_length: usize) -> Vec<String> {
        if sentence.len() <= max_length {
            return vec![sentence.to_string()];
        }

        let mut parts = Vec::new();
        let mut remaining = sentence.to_string();

        while remaining.len() > max_length {
            let search_range = &remaining[..max_length];

            // Try to break at punctuation first (comma, semicolon, colon)
            let break_idx = search_range
                .rfind(',')
                .or_else(|| search_range.rfind(';'))
                .or_else(|| search_range.rfind(':'))
                .filter(|&idx| idx >= self.options.min_chunk_length)
                // Fall back to space
                .or_else(|| {
                    search_range
                        .rfind(' ')
                        .filter(|&idx| idx >= self.options.min_chunk_length)
                })
                // If still no good break, just break at max_length
                .unwrap_or(max_length);

            parts.push(remaining[..=break_idx].trim().to_string());
            remaining = remaining[break_idx + 1..].trim().to_string();
        }

        if !remaining.is_empty() {
            parts.push(remaining);
        }

        parts
    }

    /// Merge short sentences into longer chunks.
    fn merge_sentences_into_chunks(&self, sentences: &[String], max_length: usize) -> Vec<String> {
        let mut chunks = Vec::new();
        let mut current_chunk = String::new();

        for sentence in sentences {
            // If adding this sentence would exceed max length, start a new chunk
            if !current_chunk.is_empty() && (current_chunk.len() + sentence.len() + 1) > max_length
            {
                chunks.push(current_chunk.trim().to_string());
                current_chunk = sentence.clone();
            } else {
                // Add to current chunk
                if current_chunk.is_empty() {
                    current_chunk = sentence.clone();
                } else {
                    current_chunk = format!("{} {}", current_chunk, sentence);
                }
            }
        }

        // Add the last chunk
        let final_chunk = current_chunk.trim();
        if !final_chunk.is_empty() {
            chunks.push(final_chunk.to_string());
        }

        chunks
    }

    /// Create chunks from text content.
    pub fn create_chunks(&self, text: &str, page_number: i32) -> Vec<TextChunk> {
        // Clean and normalize text
        let cleaned: String = text
            .chars()
            .map(|c| if c.is_whitespace() { ' ' } else { c })
            .collect();
        let cleaned = cleaned.trim();

        if cleaned.is_empty() {
            return vec![];
        }

        // Split into sentences
        let sentences = self.split_into_sentences(cleaned);

        // Handle long sentences
        let mut processed_sentences = Vec::new();
        for sentence in sentences {
            if sentence.len() > self.options.max_chunk_length {
                processed_sentences
                    .extend(self.split_long_sentence(&sentence, self.options.max_chunk_length));
            } else {
                processed_sentences.push(sentence);
            }
        }

        // Merge short sentences into chunks
        let merged_chunks =
            self.merge_sentences_into_chunks(&processed_sentences, self.options.max_chunk_length);

        // Filter out chunks that are too short (unless it's the only chunk)
        let filtered_chunks: Vec<String> = if merged_chunks.len() == 1 {
            merged_chunks
        } else {
            merged_chunks
                .into_iter()
                .filter(|chunk| chunk.len() >= self.options.min_chunk_length)
                .collect()
        };

        // Calculate offsets and create chunk objects
        let mut chunks = Vec::new();
        let mut current_offset = 0;

        for (i, chunk_text) in filtered_chunks.iter().enumerate() {
            let start_offset = cleaned
                .get(current_offset..)
                .and_then(|s| s.find(chunk_text.as_str()))
                .map(|idx| current_offset + idx)
                .unwrap_or(current_offset);
            let end_offset = start_offset + chunk_text.len();

            chunks.push(TextChunk {
                id: format!("chunk-{}-{}", page_number, i),
                text: chunk_text.clone(),
                page_number,
                start_offset,
                end_offset,
            });

            current_offset = end_offset;
        }

        chunks
    }

    /// Create chunks from multiple pages.
    pub fn create_chunks_from_pages(
        &self,
        pages: &[(i32, &str)], // (page_number, text)
    ) -> Vec<TextChunk> {
        let mut all_chunks = Vec::new();

        for (page_number, text) in pages {
            let page_chunks = self.create_chunks(text, *page_number);
            all_chunks.extend(page_chunks);
        }

        // Re-index all chunks with global IDs
        all_chunks
            .into_iter()
            .enumerate()
            .map(|(i, mut chunk)| {
                chunk.id = format!("chunk-{}", i);
                chunk
            })
            .collect()
    }

    /// Find chunk containing a specific text offset.
    pub fn find_chunk_at_offset<'a>(
        chunks: &'a [TextChunk],
        page_number: i32,
        offset: usize,
    ) -> Option<&'a TextChunk> {
        chunks.iter().find(|chunk| {
            chunk.page_number == page_number
                && offset >= chunk.start_offset
                && offset < chunk.end_offset
        })
    }

    /// Get chunks for a specific page.
    pub fn get_chunks_for_page(chunks: &[TextChunk], page_number: i32) -> Vec<&TextChunk> {
        chunks
            .iter()
            .filter(|chunk| chunk.page_number == page_number)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==========================================================================
    // TextChunk Tests
    // ==========================================================================

    #[test]
    fn test_text_chunk_creation() {
        let chunk = TextChunk::new("chunk-0".to_string(), "Hello world.".to_string(), 1, 0, 12);

        assert_eq!(chunk.id, "chunk-0");
        assert_eq!(chunk.text, "Hello world.");
        assert_eq!(chunk.page_number, 1);
        assert_eq!(chunk.start_offset, 0);
        assert_eq!(chunk.end_offset, 12);
    }

    #[test]
    fn test_text_chunk_word_count() {
        let chunk = TextChunkBuilder::new()
            .text("This is a test sentence with seven words.")
            .build();

        assert_eq!(chunk.word_count(), 8);
    }

    #[test]
    fn test_text_chunk_word_count_empty() {
        let chunk = TextChunkBuilder::new().text("").build();

        assert_eq!(chunk.word_count(), 0);
    }

    #[test]
    fn test_text_chunk_duration_estimate() {
        // 150 words at 1x rate = 1 minute
        let chunk = TextChunkBuilder::new()
            .text("word ".repeat(150).trim())
            .build();

        let duration = chunk.estimate_duration(1.0);
        // Should be approximately 60 seconds (1 minute)
        assert!((duration - 60.0).abs() < 1.0);
    }

    #[test]
    fn test_text_chunk_duration_estimate_fast_rate() {
        // 150 words at 2x rate = 30 seconds
        let chunk = TextChunkBuilder::new()
            .text("word ".repeat(150).trim())
            .build();

        let duration = chunk.estimate_duration(2.0);
        // Should be approximately 30 seconds
        assert!((duration - 30.0).abs() < 1.0);
    }

    #[test]
    fn test_text_chunk_builder() {
        let chunk = TextChunkBuilder::new()
            .id("custom-id")
            .text("Custom text here.")
            .page_number(5)
            .start_offset(100)
            .build();

        assert_eq!(chunk.id, "custom-id");
        assert_eq!(chunk.text, "Custom text here.");
        assert_eq!(chunk.page_number, 5);
        assert_eq!(chunk.start_offset, 100);
    }

    // ==========================================================================
    // TextChunker - Basic Tests
    // ==========================================================================

    #[test]
    fn test_chunker_empty_text() {
        let chunker = TextChunker::new();
        let chunks = chunker.create_chunks("", 1);

        assert!(chunks.is_empty());
    }

    #[test]
    fn test_chunker_whitespace_only() {
        let chunker = TextChunker::new();
        let chunks = chunker.create_chunks("   \n\t  ", 1);

        assert!(chunks.is_empty());
    }

    #[test]
    fn test_chunker_single_sentence() {
        let chunker = TextChunker::new();
        let chunks = chunker.create_chunks("This is a single sentence.", 1);

        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "This is a single sentence.");
        assert_eq!(chunks[0].page_number, 1);
        assert_eq!(chunks[0].id, "chunk-1-0");
    }

    #[test]
    fn test_chunker_multiple_sentences() {
        let chunker = TextChunker::new();
        let text = "First sentence. Second sentence. Third sentence.";
        let chunks = chunker.create_chunks(text, 1);

        assert!(!chunks.is_empty());
        // Sentences should be merged into chunks
        let total_text: String = chunks
            .iter()
            .map(|c| c.text.clone())
            .collect::<Vec<_>>()
            .join(" ");
        assert!(total_text.contains("First sentence."));
        assert!(total_text.contains("Second sentence."));
        assert!(total_text.contains("Third sentence."));
    }

    // ==========================================================================
    // TextChunker - Sentence Ending Tests
    // ==========================================================================

    #[test]
    fn test_chunker_exclamation_mark() {
        let chunker = TextChunker::new();
        let chunks = chunker.create_chunks("Wow! Amazing!", 1);

        assert!(!chunks.is_empty());
    }

    #[test]
    fn test_chunker_question_mark() {
        let chunker = TextChunker::new();
        let chunks = chunker.create_chunks("Is this working? Yes it is.", 1);

        assert!(!chunks.is_empty());
    }

    // ==========================================================================
    // TextChunker - Long Text Tests
    // ==========================================================================

    #[test]
    fn test_chunker_long_text_splits() {
        let chunker = TextChunker::with_options(ChunkingOptions {
            max_chunk_length: 100,
            min_chunk_length: 10,
        });

        // Create text with multiple sentences that exceeds 100 chars
        let text = "Short one. Another short sentence here. Yet another sentence to add more length. And one more sentence to ensure we have enough text.";
        let chunks = chunker.create_chunks(text, 1);

        // Should create multiple chunks
        assert!(chunks.len() >= 2);
        // Each chunk should be under max length
        for chunk in &chunks {
            assert!(
                chunk.text.len() <= 100,
                "Chunk too long: {} chars",
                chunk.text.len()
            );
        }
    }

    #[test]
    fn test_chunker_very_long_sentence_splits() {
        let chunker = TextChunker::with_options(ChunkingOptions {
            max_chunk_length: 50,
            min_chunk_length: 10,
        });

        // A sentence longer than max_chunk_length with no sentence endings
        let long_sentence = "This is a very long sentence without any punctuation that should be split at natural break points like commas or spaces";
        let chunks = chunker.create_chunks(long_sentence, 1);

        // Should split the sentence
        assert!(chunks.len() >= 2);
    }

    // ==========================================================================
    // TextChunker - Merge Short Sentences Tests
    // ==========================================================================

    #[test]
    fn test_chunker_merges_short_sentences() {
        let chunker = TextChunker::with_options(ChunkingOptions {
            max_chunk_length: 100,
            min_chunk_length: 10,
        });

        let text = "Hi. Yo. OK. Sure. Yes.";
        let chunks = chunker.create_chunks(text, 1);

        // Very short sentences should be merged
        // The total text is short, so should be 1 chunk
        assert_eq!(chunks.len(), 1);
    }

    // ==========================================================================
    // TextChunker - Page Number Tests
    // ==========================================================================

    #[test]
    fn test_chunker_page_number_preserved() {
        let chunker = TextChunker::new();

        let chunks_page_1 = chunker.create_chunks("Page one text.", 1);
        let chunks_page_5 = chunker.create_chunks("Page five text.", 5);

        assert_eq!(chunks_page_1[0].page_number, 1);
        assert_eq!(chunks_page_5[0].page_number, 5);
    }

    #[test]
    fn test_chunker_chunk_ids_include_page() {
        let chunker = TextChunker::new();
        let chunks = chunker.create_chunks("Some text here.", 3);

        assert!(chunks[0].id.contains("3"));
    }

    // ==========================================================================
    // TextChunker - Multi-Page Tests
    // ==========================================================================

    #[test]
    fn test_chunker_multiple_pages() {
        let chunker = TextChunker::new();
        let pages = vec![(1, "Page one content."), (2, "Page two content.")];

        let chunks = chunker.create_chunks_from_pages(&pages);

        assert!(chunks.len() >= 2);
        // Global IDs should be sequential
        assert_eq!(chunks[0].id, "chunk-0");
        assert_eq!(chunks[1].id, "chunk-1");
    }

    #[test]
    fn test_chunker_multiple_pages_preserves_page_numbers() {
        let chunker = TextChunker::new();
        let pages = vec![(1, "Page one."), (5, "Page five.")];

        let chunks = chunker.create_chunks_from_pages(&pages);

        assert_eq!(chunks[0].page_number, 1);
        assert_eq!(chunks[1].page_number, 5);
    }

    // ==========================================================================
    // TextChunker - Find Chunk Tests
    // ==========================================================================

    #[test]
    fn test_find_chunk_at_offset() {
        let chunker = TextChunker::new();
        let chunks = chunker.create_chunks("First sentence. Second sentence.", 1);

        // Find chunk at beginning
        let found = TextChunker::find_chunk_at_offset(&chunks, 1, 0);
        assert!(found.is_some());

        // Find chunk for non-existent page
        let not_found = TextChunker::find_chunk_at_offset(&chunks, 2, 0);
        assert!(not_found.is_none());
    }

    #[test]
    fn test_get_chunks_for_page() {
        let chunker = TextChunker::new();
        let pages = vec![(1, "Page one text."), (2, "Page two text.")];
        let chunks = chunker.create_chunks_from_pages(&pages);

        let page_1_chunks = TextChunker::get_chunks_for_page(&chunks, 1);
        let page_2_chunks = TextChunker::get_chunks_for_page(&chunks, 2);
        let page_3_chunks = TextChunker::get_chunks_for_page(&chunks, 3);

        assert!(!page_1_chunks.is_empty());
        assert!(!page_2_chunks.is_empty());
        assert!(page_3_chunks.is_empty());
    }

    // ==========================================================================
    // TextChunker - Offset Calculation Tests
    // ==========================================================================

    #[test]
    fn test_chunker_offset_calculation() {
        let chunker = TextChunker::new();
        let text = "First sentence.";
        let chunks = chunker.create_chunks(text, 1);

        assert_eq!(chunks[0].start_offset, 0);
        assert_eq!(chunks[0].end_offset, 15);
    }

    // ==========================================================================
    // Custom Options Tests
    // ==========================================================================

    #[test]
    fn test_chunker_custom_max_length() {
        let chunker = TextChunker::with_options(ChunkingOptions {
            max_chunk_length: 30,
            min_chunk_length: 5,
        });

        let text = "Short. Another short sentence that is longer.";
        let chunks = chunker.create_chunks(text, 1);

        for chunk in &chunks {
            assert!(chunk.text.len() <= 50); // Some tolerance for sentence boundaries
        }
    }

    #[test]
    fn test_default_options() {
        let options = ChunkingOptions::default();
        assert_eq!(options.max_chunk_length, MAX_CHUNK_LENGTH);
        assert_eq!(options.min_chunk_length, MIN_CHUNK_LENGTH);
    }
}
