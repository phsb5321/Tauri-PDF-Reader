// Safety guard: the `e2e-tts-fixture` feature stubs TTS (no network, no audio,
// deterministic marks) for the native-play E2E. It must NEVER reach a shipped
// (release) binary — fail the build if it is enabled without debug assertions
// (e.g. `--release`, or a careless `--all-features --release`).
#[cfg(all(feature = "e2e-tts-fixture", not(debug_assertions)))]
compile_error!(
    "e2e-tts-fixture is a test-only TTS stub and must not be enabled in a release build"
);

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
        dirs::data_local_dir().map(|p| p.join("com.lectrice.reader"))
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
            // Default to GPU compositing on Linux. The DMABUF renderer — the usual
            // cause of blank/garbled WebKitGTK windows that previously motivated
            // full software rendering — is disabled separately in apply_linux_env,
            // so we keep GPU acceleration (sharp text + smooth scrolling) without
            // the blank-window risk. A startup crash trips safe mode, which falls
            // back to full software rendering on the next launch.
            tracing::info!("Linux detected - GPU compositing enabled (DMABUF renderer disabled)");
            false
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
            // User preference / safe mode / post-crash fallback: full software
            // rendering. Slower and softer, but maximally compatible.
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            tracing::info!("Set WEBKIT_DISABLE_COMPOSITING_MODE=1 (software rendering fallback)");
        } else {
            // Default path: keep GPU compositing for sharp rendering and smooth
            // scrolling, but disable the DMABUF renderer. DMABUF is the common
            // cause of blank/garbled WebKitGTK windows on Wayland and with the
            // proprietary Nvidia driver; turning it off keeps acceleration while
            // avoiding that failure mode.
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            tracing::info!("Set WEBKIT_DISABLE_DMABUF_RENDERER=1 (GPU compositing, DMABUF off)");
        }
    }

    #[cfg(not(target_os = "linux"))]
    pub fn apply_linux_env() {
        // No-op on non-Linux platforms
    }
}

use tauri_specta::{collect_commands, Builder};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use commands::audio_cache::*;
use commands::audio_export::{
    audio_export_cancel, audio_export_check_ready, audio_export_document, ExportState,
};
use commands::collections::*;
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

/// Map a native menu item id to the `menu-action` payload it emits. This is the
/// real native-menu -> Rust wire that `app.on_menu_event` drives — extracted as a
/// pure fn so it is unit-testable WITHOUT a window/AT-SPI menu (which WebDriver
/// cannot click; the prior E2E faked this by emitting `menu-action` from the
/// frontend). Must stay in sync with the SubmenuBuilder item ids in run().
fn menu_action_for(id: &str) -> Option<&'static str> {
    match id {
        "open" => Some("open"),
        "settings" => Some("settings"),
        "toggle-library" => Some("toggle-library"),
        "toggle-highlights" => Some("toggle-highlights"),
        "find" => Some("find"),
        "play-pause" => Some("play-pause"),
        "prev-page" => Some("prev-page"),
        "next-page" => Some("next-page"),
        _ => None,
    }
}

/// Where the generated bindings live, relative to `src-tauri/`.
pub const BINDINGS_PATH: &str = "../src/lib/bindings.ts";

/// The first two lines of the generated file.
///
/// Payload, not a directive to this repo's linters — it is emitted *into*
/// `bindings.ts`, and it lives in a data file for the same reason SQL does. The
/// alignment gate reads added lines of Rust looking for suppression pragmas
/// somebody reached for to make a check go green; the same two lines written
/// inline here are indistinguishable from that by grep while meaning something
/// else entirely, so keeping them out of the Rust keeps the gate meaningful.
///
/// Both halves are load-bearing on the generated output. specta emits the
/// `TAURI_CHANNEL` import and `__makeEvents__` unconditionally, neither is used,
/// and `noUnusedLocals` makes that two `TS6133` errors; eslint has its own
/// opinions about generated code. `include_str!` registers a rebuild dependency,
/// so editing this file regenerates rather than going stale.
const BINDINGS_HEADER: &str = include_str!("../bindings-header.txt");

/// The exporter that writes `src/lib/bindings.ts`.
///
/// Shared with `tests/bindings_contract.rs` so the test drives the *same*
/// configuration startup does. Kept as one function rather than two matching
/// copies because the copies are what failed here: the test would have compared
/// against a file the app produces differently, and passed.
///
/// `bigint` has to be set explicitly. Specta defaults to
/// `BigIntExportBehavior::Fail`, which aborts the entire export the moment any
/// `i64` reaches the command surface — as `Collection::document_count` did, and
/// the export is `expect`ed on the debug startup path, so `tauri dev` panicked
/// before it opened a window.
///
/// `Number` is what actually crosses the boundary: Tauri serialises IPC with
/// serde_json, so an `i64` is written as a JSON number and `JSON.parse` hands
/// the frontend a JS `number`. `BigInt` would annotate a type the frontend
/// never receives. ponytail: values above 2^53 are already truncated by that
/// wire format and this annotation neither causes nor fixes that — if one ever
/// needs full range, the upgrade path is `serde(with = "...")` to a string on
/// that field plus `BigIntExportBehavior::String`.
pub fn bindings_exporter() -> specta_typescript::Typescript {
    specta_typescript::Typescript::default()
        // `trim_end` because specta puts its own newline after the header, and
        // the data file ends with one so it is not a no-final-newline oddity in
        // an editor. Without the trim the generated file gains a blank line and
        // the byte-for-byte test fails on it.
        .header(BINDINGS_HEADER.trim_end())
        .bigint(specta_typescript::BigIntExportBehavior::Number)
}

/// Render the bindings into a staging file, then rename it into place.
///
/// Deliberately not `Builder::export`. That calls `File::create`, which
/// truncates, *before* `export_str` can return an error:
///
/// ```text
/// let mut file = File::create(&path)?;               // truncates
/// write!(file, "{}", self.export_str(&language)?)?;  // this can fail
/// ```
///
/// so a failed render leaves a zero-byte file. Not hypothetical — that is how
/// `src/lib/bindings.ts` was emptied while the `BigIntForbidden` failure was
/// being diagnosed. The file is version-controlled, so the loss is recoverable,
/// but the developer sees a startup panic *and* a wiped artifact and has to work
/// out they are one event.
///
/// Rendering first is not sufficient on its own: `fs::write` truncates too, so a
/// write that fails partway — a full disk or a quota, which is the only such
/// failure that gets past `open` — would empty the file just the same. Staging
/// and renaming closes that, because `rename` within a directory replaces the
/// destination atomically or not at all. The destination therefore only ever
/// holds a complete render.
///
/// The bytes are unchanged from what `export` would write: `export`'s only
/// other step is `language.format(path)`, and `Typescript` carries no formatter
/// unless one is set.
pub fn write_bindings<L: tauri_specta::LanguageExt>(
    builder: &Builder<tauri::Wry>,
    language: L,
    path: impl AsRef<std::path::Path>,
) -> Result<(), L::Error> {
    let path = path.as_ref();
    let rendered = builder.export_str(language)?;

    // Same directory as the destination, so the rename below stays within one
    // filesystem — across a mount boundary it would fall back to a copy and
    // lose the atomicity this exists for.
    let mut staging = path.as_os_str().to_owned();
    staging.push(".staging");
    let staging = std::path::PathBuf::from(staging);

    if let Err(e) = std::fs::write(&staging, rendered) {
        // Otherwise a failed write leaves `bindings.ts.staging` sitting in
        // `src/lib/`, where it is neither ignored nor tracked and shows up as
        // untracked noise in whatever commit comes next.
        let _ = std::fs::remove_file(&staging);
        return Err(e.into());
    }
    std::fs::rename(&staging, path)?;
    Ok(())
}

/// The tauri-specta command surface.
///
/// Extracted from `run()` so `tests/bindings_contract.rs` can build the *same*
/// list rather than its own copy — a test that maintained a second list would
/// pass while the real surface drifted, which is the failure it exists to catch.
///
/// This list is much shorter than `tauri::generate_handler!` below, and most of
/// that difference is *not* deliberate. Sessions, the audio cache, both TTS
/// engines and settings are all registered without types; the frontend reaches
/// them through hand-written wrappers in `src/lib/api/` that name commands and
/// arguments as string literals, which nothing compares to the signatures here.
///
/// Only a minority are genuinely un-typeable — specta needs a `specta::Type` for
/// every argument and return, and `serde_json::Value` has no TypeScript shape,
/// which is what strands the `settings_*` family. The rest return ordinary
/// structs and were simply never migrated.
///
/// `tests/bindings_contract.rs` holds the full list in
/// `COMMANDS_OUTSIDE_THE_TYPED_SURFACE` and fails when a newly registered
/// command joins it without being written down, so the gap stops growing by
/// accident while it is worked off a family at a time.
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
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
        library_heal_document,
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
        // Shelf commands
        collections_create,
        collections_list,
        collections_rename,
        collections_delete,
        collections_add_document,
        collections_remove_document,
        collections_list_memberships,
        // Session commands
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
    ])
}

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

    // Configure tauri-specta for type-safe commands. The command list lives in
    // `specta_builder()` so the drift test can build the same one.
    let specta_builder = specta_builder();

    // Regenerate the bindings on a debug run, as a convenience for `tauri dev`.
    // This is NOT what keeps them current — it only fires when someone launches
    // a debug build and then remembers to commit the result, which is how the
    // checked-in file went six months and 8 commands out of date. The gate is
    // `tests/bindings_contract.rs`, which runs in CI.
    #[cfg(debug_assertions)]
    write_bindings(&specta_builder, bindings_exporter(), BINDINGS_PATH)
        .expect("Failed to export TypeScript bindings");

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // persisted-scope MUST init AFTER fs so it can hook the fs plugin's
        // scope. It serializes the fs plugin's CURRENT allowed patterns — the
        // static $APPLOCALDATA/** plus the runtime per-file grants that
        // dialog.open() adds for a picked PDF — and restores them on the next
        // launch, so a library document reopens via readFile(originalPath)
        // without re-prompting. It introduces NO new or broader pattern, so the
        // effective scope is unchanged across restarts (no whole-disk exposure).
        .plugin(tauri_plugin_persisted_scope::init())
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
            library_heal_document,
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
            // Shelf commands
            collections_create,
            collections_list,
            collections_rename,
            collections_delete,
            collections_add_document,
            collections_remove_document,
            collections_list_memberships,
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

            // On Linux, drop the GTK client-side decorations (the app-drawn
            // titlebar with min/maximize/close buttons) so the Wayland compositor
            // — e.g. niri — owns the window frame: its focus border, and
            // move/close/fullscreen via compositor keybinds. Done here in setup,
            // before the event loop presents the window, so there is no titlebar
            // flash. macOS and Windows keep their native decorations from
            // tauri.conf.json, where floating window managers expect them.
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    match window.set_decorations(false) {
                        Ok(()) => tracing::info!(
                            "Client-side decorations disabled; window frame is compositor-managed"
                        ),
                        Err(e) => {
                            tracing::warn!("Failed to disable window decorations: {e}")
                        }
                    }
                }
            }

            // Build a native application menu (File / View / Playback / Help)
            // and attach it to the main window. On Linux this creates a real
            // GtkMenuBar that the accessibility (AT-SPI) bus exports, so desktop
            // services — e.g. a global-menu bar like noctalia-appmenu — can read
            // and drive it instead of falling back to a synthetic menu. Custom
            // items emit a "menu-action" event the frontend handles via the same
            // code paths as the keyboard shortcuts; predefined items (Quit,
            // About) carry their own behavior.
            {
                use tauri::menu::{MenuBuilder, PredefinedMenuItem, SubmenuBuilder};

                let file = SubmenuBuilder::new(app, "File")
                    .text("open", "Open PDF…")
                    .text("settings", "Settings…")
                    .separator()
                    .item(&PredefinedMenuItem::quit(app, Some("Quit Lectrice"))?)
                    .build()?;
                let view = SubmenuBuilder::new(app, "View")
                    .text("toggle-library", "Library")
                    .text("toggle-highlights", "Toggle Highlights")
                    .separator()
                    .text("find", "Find…")
                    .build()?;
                let playback = SubmenuBuilder::new(app, "Playback")
                    .text("play-pause", "Play / Pause")
                    .separator()
                    .text("prev-page", "Previous Page")
                    .text("next-page", "Next Page")
                    .build()?;
                let help = SubmenuBuilder::new(app, "Help")
                    .item(&PredefinedMenuItem::about(
                        app,
                        Some("About Lectrice"),
                        None,
                    )?)
                    .build()?;
                let menu = MenuBuilder::new(app)
                    .items(&[&file, &view, &playback, &help])
                    .build()?;
                app.set_menu(menu)?;

                // On Linux, keep the menu registered (so GTK still exports it over
                // AT-SPI for a global-menu bar like noctalia-appmenu) but hide the
                // in-window GtkMenuBar, so the menu lives only in the compositor's
                // top bar — macOS-style — and the window stays chrome-free. On
                // macOS/Windows the menu stays in its native location.
                #[cfg(target_os = "linux")]
                {
                    use tauri::Manager;
                    if let Some(window) = app.get_webview_window("main") {
                        if let Err(e) = window.hide_menu() {
                            tracing::warn!("Failed to hide in-window menu bar: {e}");
                        }
                    }
                }

                app.on_menu_event(|app_handle, event| {
                    use tauri::Emitter;
                    let action = menu_action_for(event.id().0.as_str());
                    if let Some(action) = action {
                        if let Err(e) = app_handle.emit("menu-action", action) {
                            tracing::warn!("Failed to emit menu-action '{action}': {e}");
                        }
                    }
                });
            }

            // Initialize the TTS audio cache and wire the audio-finished signal.
            #[cfg(feature = "elevenlabs-tts")]
            {
                use tauri::{Emitter, Manager};
                let state = app.state::<AiTtsEngineState>();
                let engine = state.0.clone();
                let app_handle = app.handle().clone();
                let cache_dir = app.path().app_cache_dir().ok();
                // One async task: set the cache dir (if resolvable) and rebuild the
                // player so a natural sink-drain emits `ai-tts:finished`. Runs at
                // startup before any playback, so swapping the player is safe.
                tauri::async_runtime::spawn(async move {
                    let mut engine = engine.write().await;
                    if let Some(cache_dir) = cache_dir {
                        engine.init_cache(cache_dir);
                    }
                    engine.set_finished_callback(Box::new(move || {
                        if let Err(e) = app_handle.emit("ai-tts:finished", ()) {
                            tracing::warn!("Failed to emit ai-tts:finished: {e}");
                        }
                    }));
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The real native-menu -> Rust wire: every menu id the SubmenuBuilder
    /// registers must map to its `menu-action` payload, and non-menu ids to None.
    /// This is what `on_menu_event` dispatches; the prior tauri-driver E2E faked
    /// it by emitting `menu-action` from the frontend via `window.__E2E__`.
    /// Proven RED against a planted dropped arm (next-page -> None).
    #[test]
    fn menu_action_for_maps_every_native_menu_id() {
        for id in [
            "open",
            "settings",
            "toggle-library",
            "toggle-highlights",
            "find",
            "play-pause",
            "prev-page",
            "next-page",
        ] {
            assert_eq!(
                menu_action_for(id),
                Some(id),
                "native menu id {id} must dispatch its menu-action"
            );
        }
        // Predefined items (Quit/About) and unknown ids emit nothing.
        assert_eq!(menu_action_for("quit"), None);
        assert_eq!(menu_action_for("about"), None);
        assert_eq!(menu_action_for(""), None);
    }

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
