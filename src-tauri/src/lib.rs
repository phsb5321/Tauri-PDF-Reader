// Hexagonal architecture layers
pub mod adapters;
pub mod application;
pub mod domain;
pub mod ports;
pub mod tauri_api;

// Legacy modules (to be migrated)
mod commands;
mod db;
mod services;

#[cfg(feature = "native-tts")]
mod tts;

#[cfg(feature = "elevenlabs-tts")]
mod ai_tts;

/// Hardware acceleration configuration module
/// Handles platform-specific GPU acceleration settings and safe boot fallback
mod hw_accel {
    use std::fs;
    use std::path::PathBuf;

    /// Configuration file names
    const HW_ACCEL_DISABLED_FLAG: &str = ".hw_accel_disabled";
    const CRASH_FLAG: &str = ".crash_flag";
    const SAFE_MODE_FLAG: &str = ".safe_mode";

    /// Get the app data directory for storing configuration flags
    fn get_config_dir() -> Option<PathBuf> {
        dirs::data_local_dir().map(|p| p.join("com.voxpage.pdf-reader"))
    }

    /// Check if hardware acceleration should be disabled
    /// Returns true if HW accel should be DISABLED (i.e., software rendering)
    pub fn should_disable_hw_accel() -> bool {
        let config_dir = match get_config_dir() {
            Some(dir) => dir,
            None => return false, // Default to enabled if can't determine
        };

        // Check for explicit disable flag
        let disabled_flag = config_dir.join(HW_ACCEL_DISABLED_FLAG);
        if disabled_flag.exists() {
            tracing::info!("Hardware acceleration disabled by user preference");
            return true;
        }

        // Check for safe mode (after crash)
        let safe_mode_flag = config_dir.join(SAFE_MODE_FLAG);
        if safe_mode_flag.exists() {
            tracing::warn!("Safe mode enabled - hardware acceleration disabled");
            return true;
        }

        // Check platform-specific defaults
        #[cfg(target_os = "linux")]
        {
            // Default to software rendering on Linux due to WebKitGTK issues
            tracing::info!("Linux detected - using software rendering by default");
            return true;
        }

        #[cfg(not(target_os = "linux"))]
        {
            false
        }
    }

    /// Set crash flag before potential crash-causing operation
    pub fn set_crash_flag() {
        if let Some(config_dir) = get_config_dir() {
            let _ = fs::create_dir_all(&config_dir);
            let crash_flag = config_dir.join(CRASH_FLAG);
            let _ = fs::write(&crash_flag, "starting");
        }
    }

    /// Clear crash flag after successful startup
    pub fn clear_crash_flag() {
        if let Some(config_dir) = get_config_dir() {
            let crash_flag = config_dir.join(CRASH_FLAG);
            let _ = fs::remove_file(crash_flag);
        }
    }

    /// Check if app crashed on last startup and enable safe mode
    /// Returns true if safe mode was activated
    pub fn check_and_handle_crash() -> bool {
        let config_dir = match get_config_dir() {
            Some(dir) => dir,
            None => return false,
        };

        let crash_flag = config_dir.join(CRASH_FLAG);
        if crash_flag.exists() {
            tracing::warn!("Crash flag detected from previous startup");

            // Enable safe mode
            let safe_mode_flag = config_dir.join(SAFE_MODE_FLAG);
            let _ = fs::write(&safe_mode_flag, "enabled due to crash");

            // Clean up crash flag
            let _ = fs::remove_file(crash_flag);

            return true;
        }

        false
    }

    /// Clear safe mode flag (called when user explicitly re-enables HW accel)
    pub fn clear_safe_mode() {
        if let Some(config_dir) = get_config_dir() {
            let safe_mode_flag = config_dir.join(SAFE_MODE_FLAG);
            let _ = fs::remove_file(safe_mode_flag);
        }
    }

    /// Set hardware acceleration preference
    pub fn set_hw_accel_enabled(enabled: bool) {
        if let Some(config_dir) = get_config_dir() {
            let _ = fs::create_dir_all(&config_dir);
            let disabled_flag = config_dir.join(HW_ACCEL_DISABLED_FLAG);

            if enabled {
                // Remove the disabled flag
                let _ = fs::remove_file(&disabled_flag);
                // Also clear safe mode when explicitly enabling
                clear_safe_mode();
            } else {
                // Create the disabled flag
                let _ = fs::write(&disabled_flag, "disabled by user");
            }
        }
    }

    /// Check if safe mode is currently active
    pub fn is_safe_mode_active() -> bool {
        get_config_dir()
            .map(|dir| dir.join(SAFE_MODE_FLAG).exists())
            .unwrap_or(false)
    }

    /// Apply Linux-specific environment variables for WebKitGTK
    #[cfg(target_os = "linux")]
    pub fn apply_linux_env() {
        if should_disable_hw_accel() {
            // Disable GPU compositing for WebKitGTK
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            tracing::info!("Set WEBKIT_DISABLE_COMPOSITING_MODE=1 for software rendering");
        }
    }

    #[cfg(not(target_os = "linux"))]
    pub fn apply_linux_env() {
        // No-op on non-Linux platforms
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_models_document_serialization() {
        use db::models::Document;
        let doc = Document {
            id: "abc123".to_string(),
            file_path: "/path/to/file.pdf".to_string(),
            title: Some("Test Document".to_string()),
            page_count: Some(10),
            current_page: 1,
            scroll_position: 0.0,
            last_tts_chunk_id: None,
            last_opened_at: Some("2026-01-12T00:00:00Z".to_string()),
            file_hash: Some("hash123".to_string()),
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

use tauri_specta::{collect_commands, Builder};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use commands::audio_cache::*;
use commands::audio_export::{
    audio_export_cancel, audio_export_check_ready, audio_export_document, ExportState,
};
use commands::highlights::*;
use commands::library::*;
use commands::settings::*;
use services::logging::{clear_debug_logs, export_debug_logs, get_debug_logs};

// Hexagonal architecture imports (v2 commands using new architecture)
use tauri_api::{
    session_add_document, session_create, session_delete, session_get, session_list,
    session_remove_document, session_restore, session_touch, session_update,
    session_update_document, settings_delete_v2, settings_get_all_v2, settings_get_v2,
    settings_set_batch_v2, settings_set_v2,
};

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

    // Check for crash from previous startup and enable safe mode if needed (FR-015)
    let crashed_last_time = hw_accel::check_and_handle_crash();
    if crashed_last_time {
        tracing::warn!("Application crashed on last startup - entering safe mode");
    }

    // Apply Linux-specific environment variables before WebView creation
    hw_accel::apply_linux_env();

    // Set crash flag before WebView creation (cleared on successful startup)
    hw_accel::set_crash_flag();

    // Configure tauri-specta for type-safe commands
    // Note: Commands using serde_json::Value are excluded as they're not compatible with specta type generation
    // The v2 settings and logging commands will be added once their types are fully migrated
    let specta_builder = Builder::<tauri::Wry>::new().commands(collect_commands![
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
    ]);

    // Generate TypeScript bindings in development
    // Using header to disable strict type checking for auto-generated code
    #[cfg(debug_assertions)]
    specta_builder
        .export(
            specta_typescript::Typescript::default().header("// @ts-nocheck\n/* eslint-disable */"),
            "../src/lib/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(ExportState::new());

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
            // Settings commands (legacy)
            settings_get,
            settings_set,
            settings_get_all,
            settings_delete,
            settings_set_batch,
            // Settings commands (v2 - hexagonal architecture)
            settings_get_v2,
            settings_set_v2,
            settings_get_all_v2,
            settings_delete_v2,
            settings_set_batch_v2,
            // Render settings commands (type-safe)
            get_render_settings,
            update_render_settings,
            // Hardware acceleration status commands
            get_hw_accel_status,
            clear_safe_mode,
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
            ai_tts_speak_with_timestamps,
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
            // AI TTS cache commands
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_cache_info,
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_cache_clear,
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_cache_invalidate_voice,
            // AI TTS pre-buffering
            #[cfg(feature = "elevenlabs-tts")]
            ai_tts_prebuffer,
            // Audio cache commands
            audio_cache_get_coverage,
            audio_cache_clear_document,
            audio_cache_get_stats,
            audio_cache_set_limit,
            audio_cache_evict,
            audio_cache_get_limit,
            audio_cache_notify_coverage,
            // Session commands (T062-T065)
            session_create,
            session_get,
            session_list,
            session_update,
            session_delete,
            session_restore,
            session_add_document,
            session_remove_document,
            session_update_document,
            session_touch,
            // Audio export commands (T083-T084)
            audio_export_check_ready,
            audio_export_document,
            audio_export_cancel,
        ])
        .setup(|app| {
            tracing::info!("PDF Reader starting...");

            // Clear crash flag on successful startup (FR-015 safe boot recovery)
            hw_accel::clear_crash_flag();

            // Log hardware acceleration status
            if hw_accel::should_disable_hw_accel() {
                tracing::info!("Running with software rendering (hardware acceleration disabled)");
            } else {
                tracing::info!("Running with hardware acceleration enabled");
            }

            if hw_accel::is_safe_mode_active() {
                tracing::warn!("Safe mode is active - some features may be limited");
            }

            // Initialize TTS audio cache with app cache directory
            #[cfg(feature = "elevenlabs-tts")]
            {
                use tauri::Manager;
                if let Some(cache_dir) = app.path().app_cache_dir().ok() {
                    let state = app.state::<AiTtsEngineState>();
                    let engine = state.0.clone();
                    // Spawn async task to initialize cache
                    tauri::async_runtime::spawn(async move {
                        let mut engine = engine.write().await;
                        engine.init_cache(cache_dir);
                    });
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
