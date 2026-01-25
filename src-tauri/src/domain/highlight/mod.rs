//! Highlight Domain Module
//!
//! Contains the Highlight domain entity and validation logic.
//! This module defines:
//! - Highlight entity with invariants
//! - Rect value object for highlight positioning
//! - Validation rules for highlight fields
//! - Builder pattern for highlight creation

use crate::domain::DomainError;

/// Represents a rectangle in page coordinate space.
///
/// Invariants:
/// - `width` must be > 0
/// - `height` must be > 0
#[derive(Debug, Clone, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Rect {
    /// Create a new Rect with validation.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if width or height is not positive.
    pub fn new(x: f64, y: f64, width: f64, height: f64) -> Result<Self, DomainError> {
        if width <= 0.0 {
            return Err(DomainError::validation("Width must be positive"));
        }
        if height <= 0.0 {
            return Err(DomainError::validation("Height must be positive"));
        }
        Ok(Self {
            x,
            y,
            width,
            height,
        })
    }

    /// Check if two rectangles overlap.
    pub fn overlaps(&self, other: &Rect) -> bool {
        self.x < other.x + other.width
            && self.x + self.width > other.x
            && self.y < other.y + other.height
            && self.y + self.height > other.y
    }

    /// Check if two rectangles are adjacent (touch but don't overlap).
    pub fn is_adjacent(&self, other: &Rect) -> bool {
        // Same row (overlapping y ranges) and touching x edges
        let same_row = self.y < other.y + other.height && self.y + self.height > other.y;
        let touching_x = (self.x + self.width - other.x).abs() < 0.1
            || (other.x + other.width - self.x).abs() < 0.1;

        same_row && touching_x && !self.overlaps(other)
    }

    /// Merge two adjacent or overlapping rectangles into a bounding box.
    pub fn merge(&self, other: &Rect) -> Rect {
        let min_x = self.x.min(other.x);
        let min_y = self.y.min(other.y);
        let max_x = (self.x + self.width).max(other.x + other.width);
        let max_y = (self.y + self.height).max(other.y + other.height);

        Rect {
            x: min_x,
            y: min_y,
            width: max_x - min_x,
            height: max_y - min_y,
        }
    }
}

/// Highlight entity representing a text annotation within a document.
///
/// Invariants:
/// - `rects` must have at least one element
/// - `color` must be a valid hex color (#RRGGBB)
/// - `page_number` must be >= 1
#[derive(Debug, Clone, PartialEq)]
pub struct Highlight {
    pub id: String,
    pub document_id: String,
    pub page_number: i32,
    pub rects: Vec<Rect>,
    pub color: String,
    pub text_content: Option<String>,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

/// Regex-free hex color validation
fn is_valid_hex_color(color: &str) -> bool {
    if !color.starts_with('#') || color.len() != 7 {
        return false;
    }
    color[1..].chars().all(|c| c.is_ascii_hexdigit())
}

impl Highlight {
    /// Create a new Highlight with validation.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if any invariant is violated.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: String,
        document_id: String,
        page_number: i32,
        rects: Vec<Rect>,
        color: String,
        text_content: Option<String>,
        note: Option<String>,
        created_at: String,
        updated_at: Option<String>,
    ) -> Result<Self, DomainError> {
        // Validate rects non-empty
        if rects.is_empty() {
            return Err(DomainError::validation("At least one rect required"));
        }

        // Validate page_number >= 1
        if page_number < 1 {
            return Err(DomainError::validation("Page must be positive"));
        }

        // Validate color format
        if !is_valid_hex_color(&color) {
            return Err(DomainError::validation("Invalid color format"));
        }

        Ok(Self {
            id,
            document_id,
            page_number,
            rects,
            color,
            text_content,
            note,
            created_at,
            updated_at,
        })
    }

    /// Update the highlight's color.
    ///
    /// # Errors
    /// Returns `DomainError::Validation` if the color format is invalid.
    pub fn update_color(&mut self, color: String) -> Result<(), DomainError> {
        if !is_valid_hex_color(&color) {
            return Err(DomainError::validation("Invalid color format"));
        }
        self.color = color;
        Ok(())
    }

    /// Update the highlight's note.
    pub fn update_note(&mut self, note: Option<String>) {
        self.note = note;
    }

    /// Add rects to this highlight (for merging).
    pub fn add_rects(&mut self, new_rects: Vec<Rect>) {
        self.rects.extend(new_rects);
    }

    /// Get the bounding box of all rects.
    pub fn bounding_box(&self) -> Option<Rect> {
        if self.rects.is_empty() {
            return None;
        }

        let mut min_x = f64::MAX;
        let mut min_y = f64::MAX;
        let mut max_x = f64::MIN;
        let mut max_y = f64::MIN;

        for rect in &self.rects {
            min_x = min_x.min(rect.x);
            min_y = min_y.min(rect.y);
            max_x = max_x.max(rect.x + rect.width);
            max_y = max_y.max(rect.y + rect.height);
        }

        Some(Rect {
            x: min_x,
            y: min_y,
            width: max_x - min_x,
            height: max_y - min_y,
        })
    }
}

/// Builder for creating Highlight entities in tests.
pub struct HighlightBuilder {
    id: String,
    document_id: String,
    page_number: i32,
    rects: Vec<Rect>,
    color: String,
    text_content: Option<String>,
    note: Option<String>,
    created_at: String,
    updated_at: Option<String>,
}

impl Default for HighlightBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl HighlightBuilder {
    pub fn new() -> Self {
        Self {
            id: "test-highlight-id".to_string(),
            document_id: "test-doc-id".to_string(),
            page_number: 1,
            rects: vec![Rect {
                x: 0.0,
                y: 0.0,
                width: 100.0,
                height: 20.0,
            }],
            color: "#FFEB3B".to_string(),
            text_content: None,
            note: None,
            created_at: "2026-01-13T00:00:00Z".to_string(),
            updated_at: None,
        }
    }

    pub fn id(mut self, id: impl Into<String>) -> Self {
        self.id = id.into();
        self
    }

    pub fn document_id(mut self, id: impl Into<String>) -> Self {
        self.document_id = id.into();
        self
    }

    pub fn page_number(mut self, page: i32) -> Self {
        self.page_number = page;
        self
    }

    pub fn rects(mut self, rects: Vec<Rect>) -> Self {
        self.rects = rects;
        self
    }

    pub fn add_rect(mut self, rect: Rect) -> Self {
        self.rects.push(rect);
        self
    }

    pub fn color(mut self, color: impl Into<String>) -> Self {
        self.color = color.into();
        self
    }

    pub fn text_content(mut self, text: impl Into<String>) -> Self {
        self.text_content = Some(text.into());
        self
    }

    pub fn note(mut self, note: impl Into<String>) -> Self {
        self.note = Some(note.into());
        self
    }

    pub fn build(self) -> Result<Highlight, DomainError> {
        Highlight::new(
            self.id,
            self.document_id,
            self.page_number,
            self.rects,
            self.color,
            self.text_content,
            self.note,
            self.created_at,
            self.updated_at,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==========================================================================
    // Rect Creation Tests
    // ==========================================================================

    #[test]
    fn test_rect_valid() {
        let rect = Rect::new(10.0, 20.0, 100.0, 50.0);
        assert!(rect.is_ok());
        let rect = rect.unwrap();
        assert_eq!(rect.x, 10.0);
        assert_eq!(rect.y, 20.0);
        assert_eq!(rect.width, 100.0);
        assert_eq!(rect.height, 50.0);
    }

    #[test]
    fn test_rect_zero_width_rejected() {
        let rect = Rect::new(10.0, 20.0, 0.0, 50.0);
        assert!(rect.is_err());
    }

    #[test]
    fn test_rect_negative_width_rejected() {
        let rect = Rect::new(10.0, 20.0, -10.0, 50.0);
        assert!(rect.is_err());
    }

    #[test]
    fn test_rect_zero_height_rejected() {
        let rect = Rect::new(10.0, 20.0, 100.0, 0.0);
        assert!(rect.is_err());
    }

    #[test]
    fn test_rect_negative_height_rejected() {
        let rect = Rect::new(10.0, 20.0, 100.0, -5.0);
        assert!(rect.is_err());
    }

    #[test]
    fn test_rect_negative_coordinates_accepted() {
        // Negative x, y coordinates are valid (just position)
        let rect = Rect::new(-10.0, -20.0, 100.0, 50.0);
        assert!(rect.is_ok());
    }

    // ==========================================================================
    // Rect Overlap Tests
    // ==========================================================================

    #[test]
    fn test_rect_overlaps() {
        let rect1 = Rect::new(0.0, 0.0, 100.0, 50.0).unwrap();
        let rect2 = Rect::new(50.0, 25.0, 100.0, 50.0).unwrap();
        assert!(rect1.overlaps(&rect2));
        assert!(rect2.overlaps(&rect1));
    }

    #[test]
    fn test_rect_no_overlap() {
        let rect1 = Rect::new(0.0, 0.0, 50.0, 50.0).unwrap();
        let rect2 = Rect::new(100.0, 100.0, 50.0, 50.0).unwrap();
        assert!(!rect1.overlaps(&rect2));
        assert!(!rect2.overlaps(&rect1));
    }

    #[test]
    fn test_rect_adjacent_not_overlapping() {
        let rect1 = Rect::new(0.0, 0.0, 50.0, 50.0).unwrap();
        let rect2 = Rect::new(50.0, 0.0, 50.0, 50.0).unwrap();
        // Touching but not overlapping
        assert!(!rect1.overlaps(&rect2));
    }

    // ==========================================================================
    // Rect Merge Tests
    // ==========================================================================

    #[test]
    fn test_rect_merge() {
        let rect1 = Rect::new(0.0, 0.0, 50.0, 50.0).unwrap();
        let rect2 = Rect::new(50.0, 0.0, 50.0, 50.0).unwrap();
        let merged = rect1.merge(&rect2);

        assert_eq!(merged.x, 0.0);
        assert_eq!(merged.y, 0.0);
        assert_eq!(merged.width, 100.0);
        assert_eq!(merged.height, 50.0);
    }

    #[test]
    fn test_rect_merge_overlapping() {
        let rect1 = Rect::new(0.0, 0.0, 100.0, 50.0).unwrap();
        let rect2 = Rect::new(50.0, 25.0, 100.0, 50.0).unwrap();
        let merged = rect1.merge(&rect2);

        assert_eq!(merged.x, 0.0);
        assert_eq!(merged.y, 0.0);
        assert_eq!(merged.width, 150.0);
        assert_eq!(merged.height, 75.0);
    }

    // ==========================================================================
    // Highlight Creation Tests
    // ==========================================================================

    #[test]
    fn test_highlight_valid() {
        let highlight = HighlightBuilder::new()
            .id("h1")
            .document_id("doc1")
            .page_number(5)
            .color("#FF0000")
            .text_content("Selected text")
            .build();

        assert!(highlight.is_ok());
        let h = highlight.unwrap();
        assert_eq!(h.id, "h1");
        assert_eq!(h.document_id, "doc1");
        assert_eq!(h.page_number, 5);
        assert_eq!(h.color, "#FF0000");
        assert_eq!(h.text_content, Some("Selected text".to_string()));
    }

    #[test]
    fn test_highlight_without_optional_fields() {
        let highlight = HighlightBuilder::new().build();

        assert!(highlight.is_ok());
        let h = highlight.unwrap();
        assert!(h.text_content.is_none());
        assert!(h.note.is_none());
    }

    // ==========================================================================
    // Highlight Validation Tests - Color
    // ==========================================================================

    #[test]
    fn test_highlight_valid_colors() {
        let colors = [
            "#FFEB3B", "#4CAF50", "#2196F3", "#F44336", "#000000", "#ffffff",
        ];
        for color in colors {
            let highlight = HighlightBuilder::new().color(color).build();
            assert!(highlight.is_ok(), "Color {} should be valid", color);
        }
    }

    #[test]
    fn test_highlight_invalid_color_no_hash() {
        let highlight = HighlightBuilder::new().color("FFEB3B").build();
        assert!(highlight.is_err());
    }

    #[test]
    fn test_highlight_invalid_color_too_short() {
        let highlight = HighlightBuilder::new().color("#FFF").build();
        assert!(highlight.is_err());
    }

    #[test]
    fn test_highlight_invalid_color_too_long() {
        let highlight = HighlightBuilder::new().color("#FFEB3BFF").build();
        assert!(highlight.is_err());
    }

    #[test]
    fn test_highlight_invalid_color_bad_hex() {
        let highlight = HighlightBuilder::new().color("#GGGGGG").build();
        assert!(highlight.is_err());
    }

    // ==========================================================================
    // Highlight Validation Tests - Page Number
    // ==========================================================================

    #[test]
    fn test_highlight_page_one_valid() {
        let highlight = HighlightBuilder::new().page_number(1).build();
        assert!(highlight.is_ok());
    }

    #[test]
    fn test_highlight_page_zero_rejected() {
        let highlight = HighlightBuilder::new().page_number(0).build();
        assert!(highlight.is_err());
    }

    #[test]
    fn test_highlight_page_negative_rejected() {
        let highlight = HighlightBuilder::new().page_number(-1).build();
        assert!(highlight.is_err());
    }

    // ==========================================================================
    // Highlight Validation Tests - Rects
    // ==========================================================================

    #[test]
    fn test_highlight_empty_rects_rejected() {
        let highlight = HighlightBuilder::new().rects(vec![]).build();
        assert!(highlight.is_err());
    }

    #[test]
    fn test_highlight_multiple_rects_valid() {
        let highlight = HighlightBuilder::new()
            .rects(vec![
                Rect::new(0.0, 0.0, 100.0, 20.0).unwrap(),
                Rect::new(0.0, 20.0, 80.0, 20.0).unwrap(),
            ])
            .build();

        assert!(highlight.is_ok());
        assert_eq!(highlight.unwrap().rects.len(), 2);
    }

    // ==========================================================================
    // Highlight Update Tests
    // ==========================================================================

    #[test]
    fn test_highlight_update_color_valid() {
        let mut highlight = HighlightBuilder::new().build().unwrap();

        let result = highlight.update_color("#00FF00".to_string());

        assert!(result.is_ok());
        assert_eq!(highlight.color, "#00FF00");
    }

    #[test]
    fn test_highlight_update_color_invalid() {
        let mut highlight = HighlightBuilder::new().build().unwrap();

        let result = highlight.update_color("invalid".to_string());

        assert!(result.is_err());
        // Original color should be unchanged
        assert_eq!(highlight.color, "#FFEB3B");
    }

    #[test]
    fn test_highlight_update_note() {
        let mut highlight = HighlightBuilder::new().build().unwrap();

        highlight.update_note(Some("My note".to_string()));

        assert_eq!(highlight.note, Some("My note".to_string()));
    }

    #[test]
    fn test_highlight_clear_note() {
        let mut highlight = HighlightBuilder::new()
            .note("Existing note")
            .build()
            .unwrap();

        highlight.update_note(None);

        assert!(highlight.note.is_none());
    }

    // ==========================================================================
    // Highlight Bounding Box Tests
    // ==========================================================================

    #[test]
    fn test_highlight_bounding_box_single_rect() {
        let highlight = HighlightBuilder::new()
            .rects(vec![Rect::new(10.0, 20.0, 100.0, 50.0).unwrap()])
            .build()
            .unwrap();

        let bbox = highlight.bounding_box().unwrap();
        assert_eq!(bbox.x, 10.0);
        assert_eq!(bbox.y, 20.0);
        assert_eq!(bbox.width, 100.0);
        assert_eq!(bbox.height, 50.0);
    }

    #[test]
    fn test_highlight_bounding_box_multiple_rects() {
        let highlight = HighlightBuilder::new()
            .rects(vec![
                Rect::new(0.0, 0.0, 50.0, 20.0).unwrap(),
                Rect::new(100.0, 50.0, 50.0, 20.0).unwrap(),
            ])
            .build()
            .unwrap();

        let bbox = highlight.bounding_box().unwrap();
        assert_eq!(bbox.x, 0.0);
        assert_eq!(bbox.y, 0.0);
        assert_eq!(bbox.width, 150.0);
        assert_eq!(bbox.height, 70.0);
    }

    // ==========================================================================
    // Highlight Add Rects Tests
    // ==========================================================================

    #[test]
    fn test_highlight_add_rects() {
        let mut highlight = HighlightBuilder::new()
            .rects(vec![Rect::new(0.0, 0.0, 50.0, 20.0).unwrap()])
            .build()
            .unwrap();

        highlight.add_rects(vec![Rect::new(50.0, 0.0, 50.0, 20.0).unwrap()]);

        assert_eq!(highlight.rects.len(), 2);
    }
}
