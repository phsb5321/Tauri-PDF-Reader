//! Highlight export functionality
//!
//! Formatting highlights for markdown and JSON export.

use crate::db::models::{ExportResponse, Highlight};
use chrono::Utc;

/// Get human-readable color name from hex code
pub fn color_name(hex: &str) -> &str {
    match hex.to_uppercase().as_str() {
        "#FFEB3B" => "Yellow",
        "#4CAF50" => "Green",
        "#2196F3" => "Blue",
        "#F44336" => "Red",
        "#FF9800" => "Orange",
        "#9C27B0" => "Purple",
        _ => hex,
    }
}

/// Format highlights as JSON export
pub fn format_json(document_id: &str, doc_title: &str, highlights: &[Highlight]) -> String {
    let export = serde_json::json!({
        "documentId": document_id,
        "documentTitle": doc_title,
        "exportedAt": Utc::now().to_rfc3339(),
        "highlights": highlights.iter().map(|h| {
            serde_json::json!({
                "pageNumber": h.page_number,
                "textContent": h.text_content,
                "color": h.color,
                "note": h.note
            })
        }).collect::<Vec<_>>()
    });
    serde_json::to_string_pretty(&export).unwrap()
}

/// Format highlights as Markdown export
pub fn format_markdown(doc_title: &str, highlights: &[Highlight]) -> String {
    let mut md = format!("# Highlights: {}\n\n", doc_title);
    let mut current_page = 0;

    for h in highlights {
        if h.page_number != current_page {
            md.push_str(&format!("\n## Page {}\n\n", h.page_number));
            current_page = h.page_number;
        }

        if let Some(ref text) = h.text_content {
            md.push_str(&format!("> \"{}\"\n", text));
        }
        md.push_str(&format!("- Color: {}\n", color_name(&h.color)));
        if let Some(ref note) = h.note {
            md.push_str(&format!("- Note: {}\n", note));
        }
        md.push('\n');
    }
    md
}

/// Build export response with appropriate filename
pub fn build_export_response(
    document_id: &str,
    doc_title: &str,
    highlights: &[Highlight],
    format: &str,
) -> ExportResponse {
    let (content, ext) = match format {
        "json" => (format_json(document_id, doc_title, highlights), "json"),
        _ => (format_markdown(doc_title, highlights), "md"),
    };

    let safe_title = doc_title.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let filename = format!("{}_highlights.{}", safe_title, ext);

    ExportResponse { content, filename }
}
