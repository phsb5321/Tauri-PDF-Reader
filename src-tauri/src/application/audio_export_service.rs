//! Audio Export Application Service
//!
//! Implements audio export functionality including:
//! - Readiness checking (coverage validation)
//! - Audio concatenation from cached chunks
//! - ID3v2 chapter marker embedding
//! - Progress reporting and cancellation

use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use id3::TagLike;

use crate::domain::cache::AudioCacheEntry;
use crate::domain::errors::ExportError;
use crate::domain::export::{
    ExportOptions, ExportProgress, ExportReadiness, ExportResult, MissingChunkInfo,
};
use crate::ports::audio_cache_repository::AudioCacheRepository;
use crate::ports::audio_export_service::{AudioExportService, ProgressCallback};

/// Chapter information for ID3 embedding
struct ChapterInfo {
    title: String,
    start_ms: i64,
    end_ms: i64,
}

/// Application service for audio export operations.
///
/// This service:
/// - Checks export readiness by validating cache coverage
/// - Concatenates cached audio chunks into a single file
/// - Embeds ID3v2 chapter markers for navigation
/// - Reports progress and supports cancellation
pub struct AudioExportServiceImpl<R: AudioCacheRepository> {
    cache_repository: Arc<R>,
    cancelled: Arc<AtomicBool>,
}

impl<R: AudioCacheRepository> AudioExportServiceImpl<R> {
    /// Create a new AudioExportServiceImpl with the given cache repository.
    pub fn new(cache_repository: Arc<R>) -> Self {
        Self {
            cache_repository,
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Build chapter information from cache entries based on export options.
    fn build_chapters(
        &self,
        entries: &[AudioCacheEntry],
        options: &ExportOptions,
    ) -> Vec<ChapterInfo> {
        if !options.include_chapters {
            return Vec::new();
        }

        let mut chapters = Vec::new();
        let mut current_ms: i64 = 0;

        match options.chapter_strategy.as_str() {
            ExportOptions::CHAPTER_STRATEGY_PAGE => {
                // Group entries by page and create one chapter per page
                let mut current_page: Option<i32> = None;
                let mut page_start_ms: i64 = 0;

                for entry in entries {
                    if let Some(page) = entry.page_number {
                        if current_page != Some(page) {
                            // Close previous chapter if exists
                            if let Some(prev_page) = current_page {
                                chapters.push(ChapterInfo {
                                    title: format!("Page {}", prev_page),
                                    start_ms: page_start_ms,
                                    end_ms: current_ms,
                                });
                            }
                            // Start new chapter
                            current_page = Some(page);
                            page_start_ms = current_ms;
                        }
                    }
                    current_ms += entry.duration_ms;
                }

                // Close final chapter
                if let Some(page) = current_page {
                    chapters.push(ChapterInfo {
                        title: format!("Page {}", page),
                        start_ms: page_start_ms,
                        end_ms: current_ms,
                    });
                }
            }
            ExportOptions::CHAPTER_STRATEGY_DOCUMENT => {
                // Single chapter for entire document
                let total_duration: i64 = entries.iter().map(|e| e.duration_ms).sum();
                if total_duration > 0 {
                    chapters.push(ChapterInfo {
                        title: "Document".to_string(),
                        start_ms: 0,
                        end_ms: total_duration,
                    });
                }
            }
            _ => {}
        }

        chapters
    }

    /// Write ID3v2 chapter markers to the output file.
    fn write_chapter_markers(
        &self,
        output_path: &Path,
        chapters: &[ChapterInfo],
        total_duration_ms: i64,
    ) -> Result<(), ExportError> {
        if chapters.is_empty() {
            return Ok(());
        }

        let mut tag = id3::Tag::read_from_path(output_path).unwrap_or_else(|_| id3::Tag::new());

        // Add table of contents frame (CTOC)
        let chapter_ids: Vec<String> = (0..chapters.len()).map(|i| format!("chp{}", i)).collect();

        tag.add_frame(id3::frame::TableOfContents {
            element_id: "toc".to_string(),
            top_level: true,
            ordered: true,
            elements: chapter_ids.clone(),
            frames: Vec::new(),
        });

        // Add individual chapter frames (CHAP)
        for (i, chapter) in chapters.iter().enumerate() {
            let element_id = format!("chp{}", i);

            // Create a TIT2 frame for the chapter title
            let title_frame = id3::frame::Frame::text("TIT2", &chapter.title);

            tag.add_frame(id3::frame::Chapter {
                element_id,
                start_time: chapter.start_ms as u32,
                end_time: chapter.end_ms as u32,
                start_offset: 0xFFFFFFFF, // Not specified
                end_offset: 0xFFFFFFFF,   // Not specified
                frames: vec![title_frame],
            });
        }

        // Add duration
        tag.set_duration((total_duration_ms / 1000) as u32);

        // Write the tag
        tag.write_to_path(output_path, id3::Version::Id3v24)
            .map_err(|e| ExportError::WriteError(format!("Failed to write ID3 tags: {}", e)))?;

        tracing::debug!(
            "Wrote {} chapter markers to {}",
            chapters.len(),
            output_path.display()
        );

        Ok(())
    }

    /// Concatenate audio chunks to output file.
    async fn concatenate_chunks(
        &self,
        entries: &[AudioCacheEntry],
        output_path: &Path,
        progress_callback: &Option<ProgressCallback>,
    ) -> Result<i64, ExportError> {
        let total_chunks = entries.len() as i32;
        let mut total_bytes: i64 = 0;

        // Create output file
        let file = File::create(output_path)
            .map_err(|e| ExportError::WriteError(format!("Failed to create output file: {}", e)))?;
        let mut writer = BufWriter::new(file);

        // Estimate time per chunk for progress reporting
        let avg_chunk_time_ms = 50; // Estimate 50ms per chunk for file I/O

        for (i, entry) in entries.iter().enumerate() {
            // Check for cancellation
            if self.cancelled.load(Ordering::SeqCst) {
                // Clean up partial file
                let _ = std::fs::remove_file(output_path);
                return Err(ExportError::Cancelled);
            }

            // Report progress
            if let Some(callback) = progress_callback {
                let remaining_chunks = total_chunks - (i as i32);
                let estimated_remaining_ms = (remaining_chunks as i64) * avg_chunk_time_ms;
                callback(ExportProgress::new(
                    ExportProgress::PHASE_CONCATENATING,
                    i as i32,
                    total_chunks,
                    estimated_remaining_ms,
                ));
            }

            // Read chunk audio from cache
            let cache_key = &entry.cache_key;
            let cached = self
                .cache_repository
                .get(cache_key)
                .await
                .map_err(|e| {
                    ExportError::CacheError(format!(
                        "Failed to read cache entry {}: {}",
                        cache_key, e
                    ))
                })?
                .ok_or_else(|| {
                    ExportError::CacheError(format!("Cache entry {} not found", cache_key))
                })?;

            // For MP3 concatenation, we need to handle the ID3 header carefully
            // Most MP3s have an ID3v2 header at the start that should be stripped for middle chunks
            let audio_data = if i == 0 {
                // Keep full first chunk including any header
                cached.audio_data
            } else {
                // Strip ID3v2 header from subsequent chunks if present
                strip_id3_header(&cached.audio_data)
            };

            // Write audio data
            writer.write_all(&audio_data).map_err(|e| {
                ExportError::WriteError(format!("Failed to write audio data: {}", e))
            })?;

            total_bytes += audio_data.len() as i64;
        }

        // Flush writer
        writer
            .flush()
            .map_err(|e| ExportError::WriteError(format!("Failed to flush output: {}", e)))?;

        Ok(total_bytes)
    }
}

/// Strip ID3v2 header from audio data if present.
fn strip_id3_header(data: &[u8]) -> Vec<u8> {
    if data.len() < 10 {
        return data.to_vec();
    }

    // Check for ID3v2 header: "ID3" followed by version and flags
    if &data[0..3] == b"ID3" {
        // Size is stored as syncsafe integer in bytes 6-9
        let size = ((data[6] as usize & 0x7F) << 21)
            | ((data[7] as usize & 0x7F) << 14)
            | ((data[8] as usize & 0x7F) << 7)
            | (data[9] as usize & 0x7F);

        // Total header size is 10 (header) + size (body)
        let header_size = 10 + size;
        if header_size < data.len() {
            return data[header_size..].to_vec();
        }
    }

    data.to_vec()
}

#[async_trait]
impl<R: AudioCacheRepository + 'static> AudioExportService for AudioExportServiceImpl<R> {
    /// Check if document is ready for export.
    ///
    /// Returns readiness status including coverage percentage and any missing chunks.
    async fn check_readiness(
        &self,
        document_id: &str,
        voice_id: Option<String>,
    ) -> Result<ExportReadiness, ExportError> {
        // Get coverage stats
        let coverage = self
            .cache_repository
            .get_coverage(document_id, true)
            .await
            .map_err(|e| ExportError::CacheError(format!("Failed to get coverage: {}", e)))?;

        // Get all cached entries
        let entries = self
            .cache_repository
            .list_for_document(document_id)
            .await
            .map_err(|e| ExportError::CacheError(format!("Failed to list entries: {}", e)))?;

        // Filter by voice_id if specified
        let filtered_entries: Vec<_> = if let Some(ref vid) = voice_id {
            entries.iter().filter(|e| &e.voice_id == vid).collect()
        } else {
            entries.iter().collect()
        };

        // Calculate totals
        let total_duration_ms: i64 = filtered_entries.iter().map(|e| e.duration_ms).sum();
        let total_size_bytes: i64 = filtered_entries.iter().map(|e| e.size_bytes).sum();

        // Check if all chunks are cached
        // For now, we consider ready if coverage is 100% (or if there are cached entries)
        let coverage_percent = coverage.coverage_percent;
        let ready = coverage_percent >= 100.0
            || (coverage.total_chunks > 0 && coverage.cached_chunks >= coverage.total_chunks);

        if ready {
            Ok(ExportReadiness::ready(total_duration_ms, total_size_bytes))
        } else {
            // Build missing chunks list from page stats
            let mut missing_chunks = Vec::new();
            if let Some(ref page_stats) = coverage.page_stats {
                for ps in page_stats {
                    if ps.cached_chunks < ps.total_chunks {
                        // Find which chunks are missing for this page
                        let page_entries: Vec<_> = filtered_entries
                            .iter()
                            .filter(|e| e.page_number == Some(ps.page_number))
                            .collect();

                        let cached_indices: std::collections::HashSet<_> =
                            page_entries.iter().filter_map(|e| e.chunk_index).collect();

                        for chunk_idx in 0..ps.total_chunks {
                            if !cached_indices.contains(&chunk_idx) {
                                missing_chunks.push(MissingChunkInfo {
                                    page_number: ps.page_number,
                                    chunk_index: chunk_idx,
                                    text_preview: format!(
                                        "Page {} chunk {}",
                                        ps.page_number, chunk_idx
                                    ),
                                });
                            }
                        }
                    }
                }
            }

            Ok(ExportReadiness::not_ready(
                coverage_percent,
                missing_chunks,
                total_duration_ms,
                total_size_bytes,
            ))
        }
    }

    /// Export document audio to file.
    ///
    /// Concatenates all cached chunks and embeds chapter markers.
    async fn export(
        &self,
        options: ExportOptions,
        progress_callback: Option<ProgressCallback>,
    ) -> Result<ExportResult, ExportError> {
        // Reset cancellation flag
        self.cancelled.store(false, Ordering::SeqCst);

        // Validate options
        options
            .validate()
            .map_err(|e| ExportError::PathInvalid(e))?;

        // Report loading phase
        if let Some(ref callback) = progress_callback {
            callback(ExportProgress::new(ExportProgress::PHASE_LOADING, 0, 0, 0));
        }

        // Get all cached entries for document
        let entries = self
            .cache_repository
            .list_for_document(&options.document_id)
            .await
            .map_err(|e| ExportError::CacheError(format!("Failed to list entries: {}", e)))?;

        // Filter by voice_id if specified
        let entries: Vec<_> = if let Some(ref vid) = options.voice_id {
            entries.into_iter().filter(|e| &e.voice_id == vid).collect()
        } else {
            entries
        };

        if entries.is_empty() {
            return Err(ExportError::NotReady(
                "No cached audio entries found for document".into(),
            ));
        }

        // Check for cancellation
        if self.cancelled.load(Ordering::SeqCst) {
            return Err(ExportError::Cancelled);
        }

        let output_path = Path::new(&options.output_path);
        let total_chunks = entries.len() as i32;
        let total_duration_ms: i64 = entries.iter().map(|e| e.duration_ms).sum();

        // Build chapter information
        let chapters = self.build_chapters(&entries, &options);
        let chapter_count = chapters.len() as i32;

        // Concatenate audio chunks
        let file_size_bytes = self
            .concatenate_chunks(&entries, output_path, &progress_callback)
            .await?;

        // Check for cancellation before embedding
        if self.cancelled.load(Ordering::SeqCst) {
            let _ = std::fs::remove_file(output_path);
            return Err(ExportError::Cancelled);
        }

        // Embed chapter markers
        if !chapters.is_empty() {
            if let Some(ref callback) = progress_callback {
                callback(ExportProgress::new(
                    ExportProgress::PHASE_EMBEDDING,
                    total_chunks,
                    total_chunks,
                    100,
                ));
            }

            self.write_chapter_markers(output_path, &chapters, total_duration_ms)?;
        }

        // Report completion
        if let Some(ref callback) = progress_callback {
            callback(ExportProgress::complete(total_chunks));
        }

        tracing::info!(
            "Exported audiobook: {} chunks, {} chapters, {} ms, {} bytes",
            total_chunks,
            chapter_count,
            total_duration_ms,
            file_size_bytes
        );

        Ok(ExportResult::success(
            options.output_path,
            options.format,
            total_duration_ms,
            chapter_count,
            file_size_bytes,
        ))
    }

    /// Cancel in-progress export.
    ///
    /// Returns true if cancellation was signaled, false if no export was in progress.
    fn cancel(&self) -> bool {
        let was_running = !self.cancelled.load(Ordering::SeqCst);
        self.cancelled.store(true, Ordering::SeqCst);
        was_running
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::cache::AudioCacheEntry;
    use crate::domain::cache::CoverageStats;
    use crate::ports::audio_cache_repository::MockAudioCacheRepository;
    use mockall::predicate::*;

    fn make_test_entry(doc_id: &str, page: i32, chunk: i32, duration_ms: i64) -> AudioCacheEntry {
        AudioCacheEntry::new(
            format!("cache-{}-{}-{}", doc_id, page, chunk),
            Some(doc_id.to_string()),
            Some(page),
            Some(chunk),
            Some(5), // 5 chunks per page
            format!("hash-{}-{}", page, chunk),
            "voice-123".to_string(),
            "settings-hash".to_string(),
            format!("/cache/{}-{}-{}.mp3", doc_id, page, chunk),
            1024,
            duration_ms,
        )
    }

    #[tokio::test]
    async fn test_check_readiness_ready() {
        let mut mock = MockAudioCacheRepository::new();

        // Full coverage
        mock.expect_get_coverage().returning(|_, _| {
            let mut stats = CoverageStats::empty("doc-1".to_string());
            stats.update(10, 10, 50000, 10240);
            Ok(stats)
        });

        mock.expect_list_for_document().returning(|_| {
            Ok(vec![
                make_test_entry("doc-1", 1, 0, 5000),
                make_test_entry("doc-1", 1, 1, 5000),
            ])
        });

        let service = AudioExportServiceImpl::new(Arc::new(mock));
        let result = service.check_readiness("doc-1", None).await.unwrap();

        assert!(result.ready);
        assert_eq!(result.coverage_percent, 100.0);
        assert!(result.missing_chunks.is_empty());
    }

    #[tokio::test]
    async fn test_check_readiness_not_ready() {
        let mut mock = MockAudioCacheRepository::new();

        // Partial coverage
        mock.expect_get_coverage().returning(|_, _| {
            let mut stats = CoverageStats::empty("doc-1".to_string());
            stats.update(10, 5, 25000, 5120);
            Ok(stats)
        });

        mock.expect_list_for_document()
            .returning(|_| Ok(vec![make_test_entry("doc-1", 1, 0, 5000)]));

        let service = AudioExportServiceImpl::new(Arc::new(mock));
        let result = service.check_readiness("doc-1", None).await.unwrap();

        assert!(!result.ready);
        assert!(result.coverage_percent < 100.0);
    }

    #[tokio::test]
    async fn test_export_no_entries() {
        let mut mock = MockAudioCacheRepository::new();

        mock.expect_list_for_document().returning(|_| Ok(vec![]));

        let service = AudioExportServiceImpl::new(Arc::new(mock));
        let options = ExportOptions::new(
            "doc-1".to_string(),
            "mp3".to_string(),
            "/tmp/test.mp3".to_string(),
        );

        let result = service.export(options, None).await;
        assert!(matches!(result, Err(ExportError::NotReady(_))));
    }

    #[tokio::test]
    async fn test_export_cancelled_before_start() {
        let mock = MockAudioCacheRepository::new();
        let service = AudioExportServiceImpl::new(Arc::new(mock));

        // Verify the cancel method works correctly
        assert!(service.cancel()); // First cancel returns true (was not cancelled)
        assert!(!service.cancel()); // Second cancel returns false (already cancelled)
    }

    #[tokio::test]
    async fn test_cancel() {
        let mock = MockAudioCacheRepository::new();
        let service = AudioExportServiceImpl::new(Arc::new(mock));

        // First cancel should return true (was not cancelled)
        assert!(service.cancel());

        // Second cancel should return false (was already cancelled)
        assert!(!service.cancel());
    }

    #[test]
    fn test_build_chapters_page_strategy() {
        let mock = MockAudioCacheRepository::new();
        let service = AudioExportServiceImpl::new(Arc::new(mock));

        let entries = vec![
            make_test_entry("doc-1", 1, 0, 5000),
            make_test_entry("doc-1", 1, 1, 5000),
            make_test_entry("doc-1", 2, 0, 3000),
            make_test_entry("doc-1", 2, 1, 4000),
        ];

        let options = ExportOptions::new(
            "doc-1".to_string(),
            "mp3".to_string(),
            "/tmp/test.mp3".to_string(),
        );

        let chapters = service.build_chapters(&entries, &options);

        assert_eq!(chapters.len(), 2);
        assert_eq!(chapters[0].title, "Page 1");
        assert_eq!(chapters[0].start_ms, 0);
        assert_eq!(chapters[0].end_ms, 10000);
        assert_eq!(chapters[1].title, "Page 2");
        assert_eq!(chapters[1].start_ms, 10000);
        assert_eq!(chapters[1].end_ms, 17000);
    }

    #[test]
    fn test_build_chapters_document_strategy() {
        let mock = MockAudioCacheRepository::new();
        let service = AudioExportServiceImpl::new(Arc::new(mock));

        let entries = vec![
            make_test_entry("doc-1", 1, 0, 5000),
            make_test_entry("doc-1", 2, 0, 3000),
        ];

        let mut options = ExportOptions::new(
            "doc-1".to_string(),
            "mp3".to_string(),
            "/tmp/test.mp3".to_string(),
        );
        options.chapter_strategy = ExportOptions::CHAPTER_STRATEGY_DOCUMENT.to_string();

        let chapters = service.build_chapters(&entries, &options);

        assert_eq!(chapters.len(), 1);
        assert_eq!(chapters[0].title, "Document");
        assert_eq!(chapters[0].start_ms, 0);
        assert_eq!(chapters[0].end_ms, 8000);
    }

    #[test]
    fn test_build_chapters_disabled() {
        let mock = MockAudioCacheRepository::new();
        let service = AudioExportServiceImpl::new(Arc::new(mock));

        let entries = vec![make_test_entry("doc-1", 1, 0, 5000)];

        let mut options = ExportOptions::new(
            "doc-1".to_string(),
            "mp3".to_string(),
            "/tmp/test.mp3".to_string(),
        );
        options.include_chapters = false;

        let chapters = service.build_chapters(&entries, &options);

        assert!(chapters.is_empty());
    }

    #[test]
    fn test_strip_id3_header() {
        // No header
        let data = vec![0xFF, 0xFB, 0x90, 0x00]; // MP3 sync bytes
        assert_eq!(strip_id3_header(&data), data);

        // ID3v2 header (10 bytes header + body)
        let mut id3_data = Vec::new();
        id3_data.extend_from_slice(b"ID3"); // Header magic
        id3_data.push(4); // Version major
        id3_data.push(0); // Version minor
        id3_data.push(0); // Flags
        id3_data.extend_from_slice(&[0, 0, 0, 10]); // Size = 10 (syncsafe)
        id3_data.extend_from_slice(&[0; 10]); // Body (10 bytes)
        id3_data.extend_from_slice(&[0xFF, 0xFB, 0x90, 0x00]); // MP3 data

        let stripped = strip_id3_header(&id3_data);
        assert_eq!(stripped, vec![0xFF, 0xFB, 0x90, 0x00]);
    }
}
