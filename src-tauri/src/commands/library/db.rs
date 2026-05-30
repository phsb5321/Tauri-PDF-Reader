//! Database helpers for library commands
//!
//! Contains database access, row mapping, and file operations.

use crate::db::models::Document;
use sha2::{Digest, Sha256};
use sqlx::{Pool, Sqlite};
use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

/// Get SQLite pool from Tauri state
pub async fn get_pool(db: &State<'_, DbInstances>) -> Result<Pool<Sqlite>, String> {
    let instances = db.0.read().await;
    let db_pool = instances
        .get("sqlite:pdf-reader.db")
        .ok_or_else(|| "DATABASE_ERROR: Database not initialized".to_string())?;

    match db_pool {
        DbPool::Sqlite(pool) => Ok(pool.clone()),
        #[allow(unreachable_patterns)]
        _ => Err("DATABASE_ERROR: Expected SQLite database".to_string()),
    }
}

/// Resolve and validate a path before the backend file-ingest commands read it.
///
/// Custom Tauri commands run native `std::fs` and therefore BYPASS the
/// `tauri-plugin-fs` capability scope. Without this guard a compromised WebView
/// could `invoke("library_add_document", { filePath })` against any path:
/// `/dev/zero` would hang `compute_file_hash` forever (a regular file never
/// returns 0 bytes), and arbitrary system files (e.g. `/etc/passwd`) could be
/// confirmed via a guess-and-hash oracle.
///
/// The path is canonicalized FIRST so the symlink TARGET is validated, not the
/// link name — this defeats `/tmp/passwd.pdf -> /etc/passwd`. Only a regular
/// file whose resolved name ends in `.pdf` is accepted. Returns the canonical
/// path so callers open the resolved target; `compute_file_hash` additionally
/// re-stats the OPEN fd, closing the validate->open race for the read path.
pub(crate) fn validate_pdf_path(file_path: &str) -> Result<PathBuf, String> {
    let canonical = std::fs::canonicalize(file_path)
        .map_err(|e| format!("FILE_READ_ERROR: Cannot resolve file: {}", e))?;
    let metadata = std::fs::metadata(&canonical)
        .map_err(|e| format!("FILE_READ_ERROR: Cannot stat file: {}", e))?;
    if !metadata.is_file() {
        return Err("INVALID_FILE: Path is not a regular file".to_string());
    }
    let is_pdf = canonical
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"));
    if !is_pdf {
        return Err("INVALID_FILE: Only .pdf files can be added to the library".to_string());
    }
    Ok(canonical)
}

/// Compute SHA-256 hash of a file for content-based identification
pub fn compute_file_hash(file_path: &str) -> Result<String, String> {
    let canonical = validate_pdf_path(file_path)?;

    let mut file =
        File::open(&canonical).map_err(|e| format!("FILE_READ_ERROR: Cannot open file: {}", e))?;

    // Re-stat the OPEN fd: we hash exactly the inode we just stat'd here, so a
    // path swapped between canonicalize() and open() can never make us stream a
    // device such as /dev/zero (closes the read-path TOCTOU).
    if !file
        .metadata()
        .map_err(|e| format!("FILE_READ_ERROR: Cannot stat opened file: {}", e))?
        .is_file()
    {
        return Err("INVALID_FILE: Path is not a regular file".to_string());
    }

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file
            .read(&mut buffer)
            .map_err(|e| format!("FILE_READ_ERROR: Cannot read file: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Implement FromRow for Document to work with sqlx
impl<'r> sqlx::FromRow<'r, sqlx::sqlite::SqliteRow> for Document {
    fn from_row(row: &'r sqlx::sqlite::SqliteRow) -> Result<Self, sqlx::Error> {
        use sqlx::Row;
        Ok(Document {
            id: row.get("id"),
            file_path: row.get("file_path"),
            title: row.get("title"),
            page_count: row.get("page_count"),
            current_page: row.get("current_page"),
            scroll_position: row.get("scroll_position"),
            last_tts_chunk_id: row.get("last_tts_chunk_id"),
            last_opened_at: row.get("last_opened_at"),
            file_hash: row.get("file_hash"),
            created_at: row.get("created_at"),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{compute_file_hash, validate_pdf_path};
    use std::fs;
    use std::path::PathBuf;

    /// Unique temp path per case (cargo test runs single-threaded here, but
    /// keep names distinct to be safe and self-cleaning).
    fn tmp(name: &str) -> PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!("lectrice_test_{}_{}", std::process::id(), name));
        p
    }

    #[test]
    fn validate_accepts_regular_pdf() {
        let path = tmp("ok.pdf");
        fs::write(&path, b"%PDF-1.7 stub").unwrap();
        let result = validate_pdf_path(path.to_str().unwrap());
        let _ = fs::remove_file(&path);
        assert!(result.is_ok(), "regular .pdf must be accepted: {result:?}");
    }

    #[test]
    fn validate_rejects_non_pdf_extension() {
        let path = tmp("note.txt");
        fs::write(&path, b"not a pdf").unwrap();
        let result = validate_pdf_path(path.to_str().unwrap());
        let _ = fs::remove_file(&path);
        assert!(result.is_err(), "non-.pdf extension must be rejected");
    }

    #[test]
    fn validate_rejects_missing_path() {
        let path = tmp("does_not_exist.pdf");
        assert!(validate_pdf_path(path.to_str().unwrap()).is_err());
    }

    #[test]
    fn validate_rejects_directory() {
        let path = tmp("a_dir.pdf");
        fs::create_dir_all(&path).unwrap();
        let result = validate_pdf_path(path.to_str().unwrap());
        let _ = fs::remove_dir(&path);
        assert!(result.is_err(), "a directory is not a regular file");
    }

    #[test]
    fn compute_hash_is_deterministic_sha256() {
        // SHA-256("hello") is a well-known fixed digest.
        let path = tmp("hello.pdf");
        fs::write(&path, b"hello").unwrap();
        let hash = compute_file_hash(path.to_str().unwrap());
        let _ = fs::remove_file(&path);
        assert_eq!(
            hash.unwrap(),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn compute_hash_rejects_non_pdf() {
        let path = tmp("evil.conf");
        fs::write(&path, b"secret").unwrap();
        let result = compute_file_hash(path.to_str().unwrap());
        let _ = fs::remove_file(&path);
        assert!(result.is_err(), "compute_file_hash must enforce the guard");
    }

    #[test]
    fn validate_rejects_symlink_to_non_pdf() {
        // A `.pdf`-named symlink pointing at a non-PDF regular file must be
        // rejected: canonicalization resolves and validates the real target.
        let target = tmp("real_secret");
        let link = tmp("masquerade.pdf");
        fs::write(&target, b"sensitive").unwrap();
        let _ = fs::remove_file(&link);
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let result = validate_pdf_path(link.to_str().unwrap());
        let _ = fs::remove_file(&link);
        let _ = fs::remove_file(&target);
        assert!(
            result.is_err(),
            "symlink to a non-.pdf target must be rejected (got {result:?})"
        );
    }

    #[test]
    fn validate_accepts_uppercase_pdf_extension() {
        let path = tmp("BOOK.PDF");
        fs::write(&path, b"%PDF-1.7").unwrap();
        let result = validate_pdf_path(path.to_str().unwrap());
        let _ = fs::remove_file(&path);
        assert!(
            result.is_ok(),
            "uppercase .PDF must be accepted: {result:?}"
        );
    }
}
