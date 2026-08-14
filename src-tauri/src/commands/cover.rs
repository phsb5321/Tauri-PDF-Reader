//! Cover cache commands — the narrow Rust side of the cover pipeline.
//!
//! ONE command instead of a get/store pair: `cover_cache` with an optional
//! payload. `store=None` reads (a cache miss returns `Ok(None)`); `Some(bytes)`
//! writes. One registration, one binding, one validation block, one audit
//! surface — smaller than two commands, and the read/write split is expressed
//! in the type (`Option<Vec<u8>>`), not in duplicate handler plumbing.
//!
//! Custom commands bypass the fs-plugin scope by design (the #90 caveat
//! documents this), so covers add ZERO permission surface: no capability, CSP
//! or asset-protocol change. Files live under `app_cache_dir()/covers/` —
//! derived, regenerable data belongs in cache, mirroring the audio cache.
//!
//! Attack-surface guards (the cover cache is a fixed-path filesystem writer
//! reachable from a potentially compromised WebView):
//!   - the docId must be a 64-char lowercase hex SHA-256 (path injection),
//!   - the docId must EXIST in the library DB (no disk-fill with random ids),
//!   - the format version is pinned SERVER-SIDE (no client-chosen versions),
//!   - stored bytes must be a plausible PNG (signature + IHDR bounds) and are
//!     size-capped,
//!   - writes are write-once: an existing valid target is never deleted
//!     before its replacement is in place (no data-loss window), and
//!     concurrent writers of the same immutable key race safely.

use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use sqlx::Pool;
use sqlx::Sqlite;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_sql::DbInstances;

use crate::commands::library::db::get_pool;
use crate::domain::cover::{
    cover_file_name, covers_dir, is_valid_doc_id, COVER_FORMAT_VERSION, MAX_COVER_FILE_BYTES,
};

/// CRC-32 (IEEE, the PNG polynomial) — table-driven, pure std. A chunk's CRC
/// covers the chunk type + data; a corrupt cache entry fails it.
fn crc32(data: &[u8]) -> u32 {
    fn table() -> [u32; 256] {
        let mut t = [0u32; 256];
        for (i, entry) in t.iter_mut().enumerate() {
            let mut c = i as u32;
            for _ in 0..8 {
                c = if c & 1 != 0 {
                    0xEDB8_8320 ^ (c >> 1)
                } else {
                    c >> 1
                };
            }
            *entry = c;
        }
        t
    }
    static TABLE: std::sync::OnceLock<[u32; 256]> = std::sync::OnceLock::new();
    let t = TABLE.get_or_init(table);
    let mut c = 0xFFFF_FFFFu32;
    for &b in data {
        c = t[((c ^ b as u32) & 0xFF) as usize] ^ (c >> 8);
    }
    c ^ 0xFFFF_FFFF
}

/// Full PNG structure validation: the signature, then a chunk walk that
/// enforces every chunk's bounds, an IHDR first with sane dimensions, a
/// NON-EMPTY IDAT (the image data), a ZERO-LENGTH terminal IEND, and a valid
/// CRC-32 on every chunk. A truncated, corrupted, or data-less file is
/// REJECTED — it must read as a cache miss so the frontend regenerates
/// instead of serving a broken raster forever (the decoder is a real
/// renderer's first gate; CRC + structure is the honest std-only bar).
fn validate_cover_png(bytes: &[u8]) -> Result<(), String> {
    const SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    if bytes.len() < 8 || bytes[..8] != SIGNATURE {
        return Err("VALIDATION_ERROR: not a PNG".to_string());
    }
    let mut offset = 8usize;
    let mut first = true;
    let mut saw_idat = false;
    let mut saw_iend = false;
    while offset < bytes.len() {
        if offset + 8 > bytes.len() {
            return Err("VALIDATION_ERROR: truncated PNG chunk header".to_string());
        }
        let len = u32::from_be_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;
        let chunk_type = &bytes[offset + 4..offset + 8];
        let total = 8 + len + 4; // header + data + crc
        if offset + total > bytes.len() {
            return Err("VALIDATION_ERROR: truncated PNG chunk".to_string());
        }
        // The stored CRC must match the chunk type + data (a corrupt cache
        // entry — any flipped byte — fails this).
        let stored_crc = u32::from_be_bytes([
            bytes[offset + 8 + len],
            bytes[offset + 8 + len + 1],
            bytes[offset + 8 + len + 2],
            bytes[offset + 8 + len + 3],
        ]);
        let actual_crc = crc32(&bytes[offset + 4..offset + 8 + len]);
        if stored_crc != actual_crc {
            return Err("VALIDATION_ERROR: PNG chunk CRC mismatch".to_string());
        }
        if first {
            if chunk_type != b"IHDR" {
                return Err("VALIDATION_ERROR: missing PNG IHDR".to_string());
            }
            if len < 13 {
                return Err("VALIDATION_ERROR: short PNG IHDR".to_string());
            }
            let width = u32::from_be_bytes([
                bytes[offset + 8],
                bytes[offset + 9],
                bytes[offset + 10],
                bytes[offset + 11],
            ]);
            let height = u32::from_be_bytes([
                bytes[offset + 12],
                bytes[offset + 13],
                bytes[offset + 14],
                bytes[offset + 15],
            ]);
            if width == 0 || height == 0 || width > 4096 || height > 4096 {
                return Err("VALIDATION_ERROR: implausible PNG dimensions".to_string());
            }
            first = false;
        }
        if chunk_type == b"IDAT" {
            saw_idat = true;
            if len == 0 {
                return Err("VALIDATION_ERROR: PNG IDAT carries no data".to_string());
            }
        }
        if chunk_type == b"IEND" {
            saw_iend = true;
            if len != 0 {
                return Err("VALIDATION_ERROR: PNG IEND must be zero-length".to_string());
            }
            offset += total;
            break; // IEND is the TERMINAL chunk — anything after it is garbage
        }
        offset += total;
    }
    if !saw_iend {
        return Err("VALIDATION_ERROR: PNG missing terminal IEND".to_string());
    }
    // A PNG with no IDAT carries no image data — accepting it would cache a
    // permanently blank/broken cover (write_once never replaces it).
    if !saw_idat {
        return Err("VALIDATION_ERROR: PNG has no IDAT (no image data)".to_string());
    }
    if offset != bytes.len() {
        return Err("VALIDATION_ERROR: trailing bytes after PNG IEND".to_string());
    }
    Ok(())
}

/// Write-once: covers are immutable per (docId, format version), so an
/// existing valid target is kept as-is — the old file is never deleted before
/// its replacement exists (no data-loss window, the classic tmp+remove+rename
/// race). A fresh key writes `{name}.{pid}.{nanos}.tmp` then renames; two
/// concurrent writers of the same key race on the rename and both end with a
/// valid identical-content file (a Windows rename-over-existing error is
/// treated as the other writer having won).
fn write_once(dir: &Path, name: &str, bytes: &[u8]) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("IO_ERROR: {e}"))?;
    let target = dir.join(name);
    if target.exists() {
        return Ok(()); // immutable key already cached — nothing to do
    }
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = dir.join(format!("{name}.{}.{}.tmp", std::process::id(), nanos));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("IO_ERROR: {e}"))?;
        f.write_all(bytes).map_err(|e| format!("IO_ERROR: {e}"))?;
    }
    // Atomic NO-REPLACE publish (Codex gate 121): a rename would clobber a
    // concurrent winner on Unix. hard_link fails with AlreadyExists if the
    // target appeared between the exists() check and here — that is the
    // winner's file, and ours (identical immutable content by key) is
    // discarded. Filesystems without hard links fall back to rename with the
    // documented last-writer-wins race.
    match fs::hard_link(&tmp, &target) {
        Ok(()) => {
            let _ = fs::remove_file(&tmp);
            Ok(())
        }
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
            let _ = fs::remove_file(&tmp);
            Ok(()) // another writer won; same immutable content
        }
        Err(e) if e.kind() == std::io::ErrorKind::Unsupported => {
            fs::rename(&tmp, &target).map_err(|e| format!("IO_ERROR: {e}"))
        }
        Err(e) => {
            let _ = fs::remove_file(&tmp);
            Err(format!("IO_ERROR: {e}"))
        }
    }
}

fn read_cover(dir: &Path, name: &str) -> Result<Option<Vec<u8>>, String> {
    match fs::read(dir.join(name)) {
        Ok(bytes) => {
            if validate_cover_png(&bytes).is_ok() {
                Ok(Some(bytes))
            } else {
                // A truncated/corrupt cached file must not suppress
                // regeneration forever: remove it and report a miss, so the
                // frontend renders and rewrites the cover.
                let _ = fs::remove_file(dir.join(name));
                Ok(None)
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("IO_ERROR: {e}")),
    }
}

/// Best-effort removal of every cover file for one document (any format
/// version, including leftover `.tmp` files from a crashed writer — they all
/// share the `{docId}-` prefix). A failure is logged, never fatal — the
/// delete the user asked for must not be blocked by cache housekeeping (the
/// #107 audio-cache shape).
pub fn remove_covers_for_document(cache_root: &Path, doc_id: &str) -> Result<(), String> {
    // A malformed id must never reach the prefix matcher — an empty/short id
    // would prefix-match unrelated covers and wipe them (Codex gate 121).
    if !is_valid_doc_id(doc_id) {
        return Ok(());
    }
    let dir = covers_dir(cache_root);
    let entries = match fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(format!("IO_ERROR: {e}")),
    };
    let prefix = format!("{doc_id}-");
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if name.starts_with(&prefix) {
            fs::remove_file(entry.path()).map_err(|e| format!("IO_ERROR: {e}"))?;
        }
    }
    Ok(())
}

async fn document_exists(db: &State<'_, DbInstances>, id: &str) -> Result<bool, String> {
    let pool: Pool<Sqlite> = get_pool(db).await?;
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM documents WHERE id = ?")
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {e}"))?;
    Ok(count.0 > 0)
}

/// One narrow cover-cache command. `store=None` reads; `Some(bytes)` writes.
#[tauri::command]
#[specta::specta]
pub async fn cover_cache(
    app: AppHandle,
    db: State<'_, DbInstances>,
    doc_id: String,
    store: Option<Vec<u8>>,
) -> Result<Option<Vec<u8>>, String> {
    // The format version is the SERVER's constant — a client can never mint
    // additional versions of one document's cover.
    let name = cover_file_name(&doc_id, COVER_FORMAT_VERSION)
        .ok_or_else(|| "VALIDATION_ERROR: invalid document id".to_string())?;

    // Only real library documents get cache entries — a random valid-shaped
    // id must not be able to read or (worse) fill disk through this command.
    if !document_exists(&db, &doc_id).await? {
        return Err(format!("NOT_FOUND: no library document {doc_id}"));
    }

    let dir = covers_dir(&app.path().app_cache_dir().map_err(|e| e.to_string())?);

    if let Some(bytes) = store {
        if bytes.len() as u64 > MAX_COVER_FILE_BYTES {
            return Err(format!(
                "VALIDATION_ERROR: cover too large ({} bytes > {MAX_COVER_FILE_BYTES})",
                bytes.len()
            ));
        }
        validate_cover_png(&bytes)?;
        write_once(&dir, &name, &bytes)?;
        Ok(None)
    } else {
        read_cover(&dir, &name)
    }
}

/// Preflight the source file's size BEFORE the frontend reads a byte of it.
/// The cover pipeline skips oversized PDFs, and the skip must not cost a
/// whole-file read (Codex gate 121): the size is stat'd on the backend — no
/// fs-plugin permission surface; a custom command like the rest of the cover
/// API. Only library-registered paths can be stat'd (the WebView already
/// knows them; a stray path is rejected).
#[tauri::command]
#[specta::specta]
pub async fn cover_source_size(
    db: State<'_, DbInstances>,
    file_path: String,
) -> Result<u64, String> {
    let pool = get_pool(&db).await?;
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM documents WHERE file_path = ?")
        .bind(&file_path)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("DATABASE_ERROR: {e}"))?;
    if count.0 == 0 {
        return Err(format!("NOT_FOUND: no library document at {file_path}"));
    }
    std::fs::metadata(&file_path)
        .map(|m| m.len())
        .map_err(|e| format!("IO_ERROR: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;
    use std::path::PathBuf;

    fn scratch_dir(tag: &str) -> PathBuf {
        let dir = temp_dir().join(format!("lectrice-cover-test-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn chunk(chunk_type: &[u8; 4], data: &[u8]) -> Vec<u8> {
        // [len:u32][type:4][data][crc32(type+data)] — REAL CRCs (the
        // validator recomputes them, so fixtures must carry correct ones).
        let mut out = Vec::with_capacity(12 + data.len());
        out.extend_from_slice(&(data.len() as u32).to_be_bytes());
        out.extend_from_slice(chunk_type);
        out.extend_from_slice(data);
        let mut body = Vec::with_capacity(4 + data.len());
        body.extend_from_slice(chunk_type);
        body.extend_from_slice(data);
        out.extend_from_slice(&crc32(&body).to_be_bytes());
        out
    }

    fn tiny_png(w: u32, h: u32) -> Vec<u8> {
        // A structurally valid minimal PNG: signature + IHDR (13-byte data:
        // dims + bit depth/color type) + a NON-EMPTY IDAT (2 zlib header
        // bytes) + a zero-length terminal IEND, all with real CRCs.
        let mut ihdr = Vec::new();
        ihdr.extend_from_slice(&w.to_be_bytes());
        ihdr.extend_from_slice(&h.to_be_bytes());
        ihdr.extend_from_slice(&[8, 2, 0, 0, 0]);
        let mut bytes = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        bytes.extend_from_slice(&chunk(b"IHDR", &ihdr));
        bytes.extend_from_slice(&chunk(b"IDAT", &[0x78, 0x9c]));
        bytes.extend_from_slice(&chunk(b"IEND", &[]));
        bytes
    }

    #[test]
    fn png_validation_rejects_garbage_and_implausible_dims() {
        assert!(validate_cover_png(&tiny_png(300, 450)).is_ok());
        assert!(validate_cover_png(&tiny_png(4096, 4096)).is_ok());
        // Not a PNG at all.
        assert!(validate_cover_png(b"hello world, definitely not a png").is_err());
        // Right magic, zero / absurd dimensions.
        assert!(validate_cover_png(&tiny_png(0, 450)).is_err());
        assert!(validate_cover_png(&tiny_png(8192, 450)).is_err());
        // Too short to hold a chunk header.
        assert!(validate_cover_png(&[0x89, b'P', b'N', b'G']).is_err());
        // A valid header with NO terminal IEND is truncated — must be a miss,
        // never a served raster (the Codex gate's truncated-cache case).
        let mut truncated = tiny_png(300, 450);
        truncated.truncate(truncated.len() - 12); // cut the IEND chunk
        assert!(validate_cover_png(&truncated).is_err());
        // A chunk-length that overruns the buffer is corrupt.
        let mut corrupt = tiny_png(300, 450);
        corrupt[8..12].copy_from_slice(&1_000_000u32.to_be_bytes()); // bogus IDAT len
        assert!(validate_cover_png(&corrupt).is_err());

        // IHDR directly followed by IEND — structurally complete but carrying
        // NO image data; it must never be cached (blank-cover class). The
        // IDAT chunk sits at bytes 33..47 (sig 8 + IHDR 25 + IDAT 14).
        let mut no_idat = tiny_png(300, 450);
        no_idat.drain(33..47);
        assert_eq!(&no_idat[37..41], b"IEND", "test premise: IHDR then IEND");
        assert!(validate_cover_png(&no_idat).is_err());

        // A zero-data IDAT is rejected — no image bytes to render.
        let mut ihdr = Vec::new();
        ihdr.extend_from_slice(&300u32.to_be_bytes());
        ihdr.extend_from_slice(&450u32.to_be_bytes());
        ihdr.extend_from_slice(&[8, 2, 0, 0, 0]);
        let mut empty_idat = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        empty_idat.extend_from_slice(&chunk(b"IHDR", &ihdr));
        empty_idat.extend_from_slice(&chunk(b"IDAT", &[]));
        empty_idat.extend_from_slice(&chunk(b"IEND", &[]));
        assert!(validate_cover_png(&empty_idat).is_err());

        // A flipped byte anywhere breaks the chunk CRC — a corrupt cache
        // entry must never read as a hit.
        let mut bad_crc = tiny_png(300, 450);
        bad_crc[30] ^= 0x01; // inside IHDR data
        assert!(validate_cover_png(&bad_crc).is_err());

        // A non-zero-length IEND is rejected (the PNG spec pins it at 0).
        let mut long_iend = tiny_png(300, 450);
        long_iend.truncate(long_iend.len() - 12);
        long_iend.extend_from_slice(&chunk(b"IEND", &[0xAA, 0xBB]));
        assert!(validate_cover_png(&long_iend).is_err());
    }

    #[test]
    fn malformed_doc_id_never_touches_the_covers_dir() {
        let root = scratch_dir("malformed-id");
        let dir = covers_dir(&root);
        let keep = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef-v1.png";
        write_once(&dir, keep, &tiny_png(300, 450)).unwrap();
        // Empty, short and traversal-shaped ids must be NO-OPS — the prefix
        // matcher must never see them (a ""-prefix would wipe every cover).
        for bad in ["", "abc", "../", "0".repeat(63).as_str()] {
            remove_covers_for_document(&root, bad).unwrap();
        }
        assert!(
            dir.join(keep).exists(),
            "a malformed id must never remove any cover file"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn write_once_creates_then_keeps_the_existing_target() {
        let dir = scratch_dir("atomic");
        let name = "abc-v1.png";
        let first = tiny_png(300, 450);
        let second = tiny_png(301, 450);
        write_once(&dir, name, &first).unwrap();
        assert_eq!(read_cover(&dir, name).unwrap().as_deref(), Some(&first[..]));
        assert_eq!(
            fs::read_dir(&dir).unwrap().count(),
            1,
            "no temp file may survive a clean write"
        );

        // Write-once: a second write of the same key keeps the original bytes
        // — the existing valid target is never deleted for its replacement.
        write_once(&dir, name, &second).unwrap();
        assert_eq!(read_cover(&dir, name).unwrap().as_deref(), Some(&first[..]));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn corrupt_cached_file_reads_as_miss_and_is_removed() {
        let dir = scratch_dir("corrupt-read");
        let name = "abc-v1.png";
        fs::create_dir_all(&dir).unwrap();
        // Simulate a truncated write from a crashed process: right length,
        // garbage bytes, no PNG signature.
        fs::write(dir.join(name), b"this is a truncated half-written cover").unwrap();

        assert_eq!(read_cover(&dir, name).unwrap(), None);
        assert!(
            !dir.join(name).exists(),
            "the corrupt cached file must be removed so regeneration happens"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn remove_for_document_prefix_matches_including_leftover_tmps() {
        let root = scratch_dir("remove");
        let dir = covers_dir(&root);
        let keep = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef-v1.png";
        let drop1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-v1.png";
        let drop2 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-v7.png";
        let drop3 =
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-v1.png.1234.5678.tmp";
        write_once(&dir, keep, b"keep").unwrap();
        write_once(&dir, drop1, b"drop").unwrap();
        write_once(&dir, drop2, b"drop").unwrap();
        fs::write(dir.join(drop3), b"half-written tmp").unwrap();

        remove_covers_for_document(
            &root,
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        )
        .unwrap();

        assert!(dir.join(keep).exists(), "unrelated cover must survive");
        assert!(!dir.join(drop1).exists());
        assert!(!dir.join(drop2).exists());
        assert!(!dir.join(drop3).exists(), "leftover tmp must be swept");
        let _ = fs::remove_dir_all(&root);
    }
}
