//! Synthetic native settings privacy falsifier. No app, profile or real DB.

use std::io::{self, Write};
use std::sync::{Arc, Mutex};

use sqlx::sqlite::SqlitePoolOptions;
use tauri_pdf_reader_lib::{adapters::SqliteSettingsRepo, application::SettingsService};

#[derive(Clone)]
struct Capture(Arc<Mutex<Vec<u8>>>);

impl Write for Capture {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0.lock().unwrap().extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[tokio::test(flavor = "current_thread")]
async fn settings_values_are_not_traced() {
    let output = Arc::new(Mutex::new(Vec::new()));
    let writer = Capture(Arc::clone(&output));
    let subscriber = tracing_subscriber::fmt()
        .without_time()
        .with_ansi(false)
        .with_max_level(tracing::Level::TRACE)
        .with_writer(move || writer.clone())
        .finish();
    // The current-thread runtime keeps the thread-local subscriber across awaits.
    let _guard = tracing::subscriber::set_default(subscriber);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::query(
        "CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
    )
    .execute(&pool)
    .await
    .unwrap();
    let service = SettingsService::new(SqliteSettingsRepo::new(pool.clone()));
    let single = serde_json::json!({ "page": "synthetic single page 263" }).to_string();
    let batch = serde_json::json!({ "page": "synthetic batch page 263" }).to_string();
    let overwrite = serde_json::json!({ "page": "synthetic updated page 263" }).to_string();

    service.set("synthetic.single", &single).await.unwrap();
    assert_eq!(service.get("synthetic.single").await.unwrap(), Some(single));
    service
        .set_batch(vec![
            ("synthetic.batch".into(), batch.clone()),
            ("synthetic.single".into(), overwrite.clone()),
        ])
        .await
        .unwrap();
    assert_eq!(service.get("synthetic.batch").await.unwrap(), Some(batch));
    assert_eq!(
        service.get("synthetic.single").await.unwrap(),
        Some(overwrite)
    );
    // Failure must still be returned normally, without logging rejected content.
    assert!(service
        .set("theme", "\"synthetic rejected page 263\"")
        .await
        .is_err());
    pool.close().await;

    tracing::debug!("synthetic settings capture is active");
    let captured = String::from_utf8(output.lock().unwrap().clone()).unwrap();
    assert!(captured.contains("synthetic settings capture is active"));
    for sentinel in [
        "synthetic single page 263",
        "synthetic batch page 263",
        "synthetic updated page 263",
        "synthetic rejected page 263",
    ] {
        assert!(
            !captured.contains(sentinel),
            "settings value reached tracing"
        );
    }

    // The thin v2 handler cannot be invoked without app state. Its source guard
    // closes the handler-only regression hole; this is not packaged IPC proof.
    // Generic settings paths deliberately contain no logging at all.
    // ponytail: the legacy guard ends at its existing render-command separator;
    // moving that boundary must update this check, never silently skip it.
    let legacy = include_str!("../src/commands/settings.rs")
        .split_once("// Render Settings Commands (Type-Safe)")
        .expect("legacy generic settings boundary must exist")
        .0;
    for source in [
        include_str!("../src/tauri_api/settings.rs"),
        include_str!("../src/adapters/sqlite/settings_repo.rs"),
        legacy,
    ] {
        for logging in [
            "tracing",
            "log::",
            "println!",
            "eprintln!",
            "print!",
            "eprint!",
            "dbg!",
        ] {
            assert!(
                !source.contains(logging),
                "generic settings write path gained logging"
            );
        }
    }
}
