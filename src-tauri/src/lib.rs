mod commands;
mod db;
mod services;

#[cfg(feature = "native-tts")]
mod tts;

#[cfg(feature = "elevenlabs-tts")]
mod ai_tts;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_models_document_serialization() {
        use db::models::Document;
        let doc = Document {
            id: "abc123".to_string(),
            file_path: "/path/to/file.pdf".to_string(),
            title: "Test Document".to_string(),
            page_count: 10,
            current_page: 1,
            scroll_position: 0.0,
            last_tts_chunk_id: None,
            last_opened_at: "2026-01-12T00:00:00Z".to_string(),
            created_at: "2026-01-12T00:00:00Z".to_string(),
        };
        let json = serde_json::to_string(&doc).unwrap();
        // Verify camelCase serialization
        assert!(json.contains("filePath"));
        assert!(json.contains("pageCount"));
        assert!(json.contains("currentPage"));
        assert!(!json.contains("file_path"));
    }

    #[test]
    fn test_db_models_highlight_serialization() {
        use db::models::{Highlight, Rect};
        let highlight = Highlight {
            id: "uuid-123".to_string(),
            document_id: "doc-456".to_string(),
            page_number: 1,
            rects: vec![Rect {
                x: 0.0,
                y: 0.0,
                width: 100.0,
                height: 20.0,
            }],
            color: "#FFEB3B".to_string(),
            text_content: Some("highlighted text".to_string()),
            note: None,
            created_at: "2026-01-12T00:00:00Z".to_string(),
            updated_at: None,
        };
        let json = serde_json::to_string(&highlight).unwrap();
        // Verify camelCase serialization
        assert!(json.contains("documentId"));
        assert!(json.contains("pageNumber"));
        assert!(json.contains("textContent"));
        assert!(!json.contains("document_id"));
    }

    #[test]
    fn test_db_models_rect_serialization() {
        use db::models::Rect;
        let rect = Rect {
            x: 10.5,
            y: 20.3,
            width: 50.0,
            height: 15.0,
        };
        let json = serde_json::to_string(&rect).unwrap();
        let deserialized: Rect = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.x, rect.x);
        assert_eq!(deserialized.y, rect.y);
        assert_eq!(deserialized.width, rect.width);
        assert_eq!(deserialized.height, rect.height);
    }

    #[test]
    fn test_create_highlight_input_serialization() {
        use db::models::{CreateHighlightInput, Rect};
        let input = CreateHighlightInput {
            document_id: "doc-123".to_string(),
            page_number: 5,
            rects: vec![Rect {
                x: 0.0,
                y: 0.0,
                width: 100.0,
                height: 20.0,
            }],
            color: "#4CAF50".to_string(),
            text_content: Some("test text".to_string()),
        };
        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("documentId"));
        assert!(json.contains("pageNumber"));
    }

    #[test]
    fn test_update_highlight_input_serialization() {
        use db::models::UpdateHighlightInput;
        let input = UpdateHighlightInput {
            color: Some("#F44336".to_string()),
            note: Some("Updated note".to_string()),
        };
        let json = serde_json::to_string(&input).unwrap();
        let deserialized: UpdateHighlightInput = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.color, input.color);
        assert_eq!(deserialized.note, input.note);
    }

    #[test]
    fn test_voice_info_serialization() {
        use db::models::VoiceInfo;
        let voice = VoiceInfo {
            id: "voice-1".to_string(),
            name: "English Voice".to_string(),
            language: Some("en-US".to_string()),
        };
        let json = serde_json::to_string(&voice).unwrap();
        let deserialized: VoiceInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, voice.id);
        assert_eq!(deserialized.name, voice.name);
        assert_eq!(deserialized.language, voice.language);
    }
}

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use commands::library::*;
use commands::highlights::*;
use commands::settings::*;
use services::logging::{get_debug_logs, clear_debug_logs, export_debug_logs};

#[cfg(feature = "native-tts")]
use commands::tts::*;

#[cfg(feature = "elevenlabs-tts")]
use commands::ai_tts::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tauri_pdf_reader=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init());

    // Register TTS state if feature enabled
    #[cfg(feature = "native-tts")]
    {
        builder = builder.manage(tts::TtsEngine::new());
    }

    // Register AI TTS state if feature enabled
    #[cfg(feature = "elevenlabs-tts")]
    {
        use std::sync::Arc;
        use tokio::sync::RwLock;
        builder = builder.manage(AiTtsEngineState(Arc::new(RwLock::new(
            ai_tts::AiTtsEngine::new(),
        ))));
    }

    builder
        .invoke_handler(tauri::generate_handler![
            // Library commands
            library_add_document,
            library_get_document,
            library_get_document_by_path,
            library_update_progress,
            library_update_document,
            library_list_documents,
            library_remove_document,
            library_open_document,
            library_check_file_exists,
            library_update_title,
            library_relocate_document,
            // Highlights commands
            highlights_create,
            highlights_batch_create,
            highlights_list_for_page,
            highlights_list_for_document,
            highlights_get,
            highlights_update,
            highlights_delete,
            highlights_delete_for_document,
            highlights_export,
            // Settings commands
            settings_get,
            settings_set,
            settings_get_all,
            settings_delete,
            settings_set_batch,
            // Debug/logging commands
            get_debug_logs,
            clear_debug_logs,
            export_debug_logs,
            // TTS commands (when feature enabled)
            #[cfg(feature = "native-tts")]
            tts_init,
            #[cfg(feature = "native-tts")]
            tts_list_voices,
            #[cfg(feature = "native-tts")]
            tts_speak,
            #[cfg(feature = "native-tts")]
            tts_speak_long,
            #[cfg(feature = "native-tts")]
            tts_stop,
            #[cfg(feature = "native-tts")]
            tts_pause,
            #[cfg(feature = "native-tts")]
            tts_resume,
            #[cfg(feature = "native-tts")]
            tts_set_voice,
            #[cfg(feature = "native-tts")]
            tts_set_rate,
            #[cfg(feature = "native-tts")]
            tts_get_state,
            #[cfg(feature = "native-tts")]
            tts_check_capabilities,
            // AI TTS commands (ElevenLabs)
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_init,
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_list_voices,
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_speak,
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_stop,
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_pause,
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_resume,
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_set_voice,
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_set_speed,
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_get_state,
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_get_config,
        ])
        .setup(|_app| {
            tracing::info!("PDF Reader starting...");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
