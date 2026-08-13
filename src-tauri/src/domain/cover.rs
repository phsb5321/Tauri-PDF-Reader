//! Cover cache domain — the derived, regenerable first-page raster cache.
//!
//! A cover is pure derived data: the document `id` IS the file's SHA-256
//! content hash (`library_add_document` computes it), so a cover keyed by
//! `{docId}-v{formatVersion}` is keyed by content for free — an edited PDF
//! gets a new id and therefore a new cover. No DB column, no migration.
//!
//! The file name is the ONLY place attacker-influenced data (the docId, from
//! the WebView) meets a filesystem path, so the name builder refuses anything
//! that is not exactly 64 lowercase hex chars (a SHA-256) — the same guard
//! discipline as validate_pdf_path.

use std::path::{Path, PathBuf};

/// Bump when the render policy changes (scale, codec, page selection) — old
/// files become orphans under the new suffix and are swept by the delete
/// path / a future startup sweep. The FRONTEND passes this value so both
/// sides can only ever agree on the current version.
pub const COVER_FORMAT_VERSION: u32 = 1;

/// The largest cover file the cache will persist. A rendered first page at
/// the fixed policy is ~10-40 KB; 2 MB is generous headroom and stops a
/// compromised renderer from filling the cache disk.
pub const MAX_COVER_FILE_BYTES: u64 = 2 * 1024 * 1024;

/// The subdirectory under the app cache dir that holds cover files.
pub const COVER_CACHE_SUBDIR: &str = "covers";

/// `{docId}-v{formatVersion}.png`, or `None` when `doc_id` is not a
/// 64-char lowercase hex SHA-256 (path-traversal / injection rejection).
pub fn cover_file_name(doc_id: &str, format_version: u32) -> Option<String> {
    if !is_valid_doc_id(doc_id) {
        return None;
    }
    Some(format!("{doc_id}-v{format_version}.png"))
}

/// A valid cover cache document id: exactly 64 lowercase hex chars (SHA-256).
/// EVERY path-influencing consumer must gate on this — a malformed id must
/// never reach a prefix matcher or a filename builder (a short/empty id would
/// prefix-match unrelated covers and wipe them).
pub fn is_valid_doc_id(doc_id: &str) -> bool {
    doc_id.len() == 64
        && doc_id
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

/// The covers dir under a cache root (app_cache_dir), joined via PathBuf —
/// never string concatenation.
pub fn covers_dir(cache_root: &Path) -> PathBuf {
    cache_root.join(COVER_CACHE_SUBDIR)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_name_accepts_only_lowercase_sha256() {
        let ok = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        assert_eq!(
            cover_file_name(ok, 1).as_deref(),
            Some("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef-v1.png"),
        );
        // Rejections: uppercase, short, non-hex, traversal, empty.
        for bad in [
            "0123456789ABCDEF0123456789abcdef0123456789abcdef0123456789abcdef",
            "abc",
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg",
            "../../../../etc/passwd00000000000000000000000000000000000000000000000000",
            "../0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde/",
            "",
        ] {
            assert_eq!(cover_file_name(bad, 1), None, "must reject {bad:?}");
        }
    }

    #[test]
    fn covers_dir_joins_the_subdir() {
        assert_eq!(
            covers_dir(Path::new("/tmp/cache")),
            PathBuf::from("/tmp/cache").join("covers"),
        );
    }
}
