use serde::{Deserialize, Serialize};

/// Represents a PDF document in the user's library
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub file_path: String,
    pub title: Option<String>,
    pub page_count: Option<i32>,
    pub current_page: i32,
    pub scroll_position: f64,
    pub last_tts_chunk_id: Option<String>,
    pub last_opened_at: Option<String>,
    pub file_hash: Option<String>,
    pub created_at: String,
}

/// Represents a rectangle for highlight positioning (page coordinates)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Represents a text highlight within a document
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

/// Input for creating a new highlight
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHighlightInput {
    pub document_id: String,
    pub page_number: i32,
    pub rects: Vec<Rect>,
    pub color: String,
    pub text_content: Option<String>,
}

/// Input for updating a highlight
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateHighlightInput {
    pub color: Option<String>,
    pub note: Option<String>,
}

/// TTS voice information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceInfo {
    pub id: String,
    pub name: String,
    pub language: Option<String>,
}

/// TTS engine state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsState {
    pub is_speaking: bool,
    pub is_paused: bool,
    pub current_chunk_id: Option<String>,
    pub current_voice: Option<String>,
    pub rate: f64,
}

impl Default for TtsState {
    fn default() -> Self {
        Self {
            is_speaking: false,
            is_paused: false,
            current_chunk_id: None,
            current_voice: None,
            rate: 1.0,
        }
    }
}

/// TTS initialization response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsInitResponse {
    pub available: bool,
    pub backend: Option<String>,
    pub default_voice: Option<String>,
    pub error: Option<String>,
}

/// Response types for commands
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListHighlightsResponse {
    pub highlights: Vec<Highlight>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchCreateResponse {
    pub highlights: Vec<Highlight>,
    pub created: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub success: bool,
    pub deleted: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResponse {
    pub content: String,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileExistsResponse {
    pub exists: bool,
    pub file_path: String,
}
