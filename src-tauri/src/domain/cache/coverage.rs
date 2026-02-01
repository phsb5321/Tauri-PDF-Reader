//! Coverage statistics domain entities
//!
//! Defines entities for tracking audio cache coverage per document.

use serde::{Deserialize, Serialize};

/// Coverage statistics for a document's audio cache
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CoverageStats {
    pub document_id: String,
    pub total_chunks: i32,
    pub cached_chunks: i32,
    pub coverage_percent: f64,
    pub total_duration_ms: i64,
    pub cached_size_bytes: i64,
    pub last_updated: String,
    pub page_stats: Option<Vec<PageCoverageStats>>,
}

impl CoverageStats {
    /// Create empty coverage stats for a document
    pub fn empty(document_id: String) -> Self {
        Self {
            document_id,
            total_chunks: 0,
            cached_chunks: 0,
            coverage_percent: 0.0,
            total_duration_ms: 0,
            cached_size_bytes: 0,
            last_updated: chrono::Utc::now().to_rfc3339(),
            page_stats: None,
        }
    }

    /// Check if the document is fully cached
    pub fn is_fully_cached(&self) -> bool {
        self.cached_chunks == self.total_chunks && self.total_chunks > 0
    }

    /// Calculate percentage from counts
    pub fn calculate_percent(cached: i32, total: i32) -> f64 {
        if total == 0 {
            return 0.0;
        }
        ((cached as f64 / total as f64) * 100.0).round()
    }

    /// Update coverage stats with new data
    pub fn update(
        &mut self,
        total_chunks: i32,
        cached_chunks: i32,
        total_duration_ms: i64,
        cached_size_bytes: i64,
    ) {
        self.total_chunks = total_chunks;
        self.cached_chunks = cached_chunks;
        self.coverage_percent = Self::calculate_percent(cached_chunks, total_chunks);
        self.total_duration_ms = total_duration_ms;
        self.cached_size_bytes = cached_size_bytes;
        self.last_updated = chrono::Utc::now().to_rfc3339();
    }
}

/// Coverage statistics for a single page
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PageCoverageStats {
    pub page_number: i32,
    pub total_chunks: i32,
    pub cached_chunks: i32,
    pub coverage_percent: f64,
    pub duration_ms: i64,
}

impl PageCoverageStats {
    /// Create new page coverage stats
    pub fn new(page_number: i32, total_chunks: i32, cached_chunks: i32, duration_ms: i64) -> Self {
        Self {
            page_number,
            total_chunks,
            cached_chunks,
            coverage_percent: CoverageStats::calculate_percent(cached_chunks, total_chunks),
            duration_ms,
        }
    }

    /// Check if the page is fully cached
    pub fn is_fully_cached(&self) -> bool {
        self.cached_chunks == self.total_chunks && self.total_chunks > 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_coverage() {
        let stats = CoverageStats::empty("doc-1".to_string());
        assert_eq!(stats.document_id, "doc-1");
        assert_eq!(stats.total_chunks, 0);
        assert_eq!(stats.cached_chunks, 0);
        assert_eq!(stats.coverage_percent, 0.0);
        assert!(!stats.is_fully_cached());
    }

    #[test]
    fn test_calculate_percent() {
        assert_eq!(CoverageStats::calculate_percent(0, 0), 0.0);
        assert_eq!(CoverageStats::calculate_percent(0, 10), 0.0);
        assert_eq!(CoverageStats::calculate_percent(5, 10), 50.0);
        assert_eq!(CoverageStats::calculate_percent(10, 10), 100.0);
        assert_eq!(CoverageStats::calculate_percent(1, 3), 33.0); // Rounded
    }

    #[test]
    fn test_is_fully_cached() {
        let mut stats = CoverageStats::empty("doc-1".to_string());

        // Empty is not fully cached
        assert!(!stats.is_fully_cached());

        // Partial coverage
        stats.total_chunks = 10;
        stats.cached_chunks = 5;
        assert!(!stats.is_fully_cached());

        // Full coverage
        stats.cached_chunks = 10;
        assert!(stats.is_fully_cached());
    }

    #[test]
    fn test_update_coverage() {
        let mut stats = CoverageStats::empty("doc-1".to_string());
        stats.update(100, 75, 300000, 1024000);

        assert_eq!(stats.total_chunks, 100);
        assert_eq!(stats.cached_chunks, 75);
        assert_eq!(stats.coverage_percent, 75.0);
        assert_eq!(stats.total_duration_ms, 300000);
        assert_eq!(stats.cached_size_bytes, 1024000);
    }

    #[test]
    fn test_page_coverage_stats() {
        let page = PageCoverageStats::new(1, 10, 8, 60000);

        assert_eq!(page.page_number, 1);
        assert_eq!(page.total_chunks, 10);
        assert_eq!(page.cached_chunks, 8);
        assert_eq!(page.coverage_percent, 80.0);
        assert_eq!(page.duration_ms, 60000);
        assert!(!page.is_fully_cached());
    }

    #[test]
    fn test_page_fully_cached() {
        let page = PageCoverageStats::new(1, 5, 5, 30000);
        assert!(page.is_fully_cached());
    }
}
