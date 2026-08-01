//! Relink a document whose file moved.
//!
//! `documents.id` IS the SHA-256 of the file, so a book that moved on disk is
//! not lost — it is only unreachable by the path we last saw. Rehashing a
//! nearby candidate and matching it against the id restores the row, and with
//! it the reading position, highlights and shelves.
//!
//! `library_relocate_document` already does the relink once the user points at
//! the new path. The only missing half is finding that path without asking, so
//! this module is search + ranking; the write is the same UPDATE.
//!
//! Search is deliberately local. Books move within the library (renamed in
//! place, filed into a subfolder, moved next to their siblings), so the folders
//! that already hold readable documents are where the missing one almost always
//! is. A whole-disk scan would find more at a cost no one wants to pay on
//! startup.

use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

/// How far below a search root to descend. A book filed into `Data
/// Engineering/2026/` is two levels down; deeper than three is someone else's
/// directory tree, not this library's filing.
pub(crate) const MAX_SEARCH_DEPTH: usize = 3;

/// Ceiling on files hashed per heal. Hashing is the expensive step, and a
/// ranked list front-loads the likely match, so the cap costs recall only in
/// folders too large to have been filed by hand.
pub(crate) const MAX_CANDIDATES: usize = 256;

/// Directories worth searching for a document last seen at `missing_path`.
///
/// The missing file's own folder comes first: a rename in place leaves the
/// file exactly where it was, which is both the most common move and the
/// cheapest to confirm. Then the folders of documents that still resolve,
/// because a book filed away lands where its siblings already live.
pub(crate) fn search_roots(missing_path: &str, live_paths: &[String]) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    let mut seen = HashSet::new();

    let mut push = |dir: Option<&Path>| {
        if let Some(dir) = dir {
            if seen.insert(dir.to_path_buf()) {
                roots.push(dir.to_path_buf());
            }
        }
    };

    push(Path::new(missing_path).parent());
    for path in live_paths {
        push(Path::new(path).parent());
    }

    roots
}

/// Candidates ordered by how likely each is to be the moved document.
///
/// A file that kept its name is checked before anything else, so the ordinary
/// case — a folder reorganised, names untouched — costs a single hash. Order
/// within each group is preserved, which keeps the walk's shallow-first order
/// intact and makes the ranking testable.
pub(crate) fn rank_candidates(candidates: Vec<PathBuf>, wanted_name: &OsStr) -> Vec<PathBuf> {
    let (same_name, rest): (Vec<_>, Vec<_>) = candidates
        .into_iter()
        .partition(|path| path.file_name() == Some(wanted_name));

    same_name.into_iter().chain(rest).collect()
}

/// PDFs under `roots`, shallowest first, excluding paths already claimed.
///
/// `claimed` holds the paths of documents that still resolve: those files are
/// accounted for, and hashing them would only burn the candidate budget to
/// rediscover rows we already have.
///
/// Directories that cannot be read are skipped rather than failing the heal —
/// a permission-denied folder is a reason to look elsewhere, not to give up.
pub(crate) fn collect_pdfs(roots: &[PathBuf], claimed: &HashSet<PathBuf>) -> Vec<PathBuf> {
    let mut found = Vec::new();
    let mut visited: HashSet<PathBuf> = HashSet::new();
    // Breadth-first so shallow matches — the library's own folders — are
    // ranked ahead of whatever sits in a nested archive.
    let mut frontier: Vec<(PathBuf, usize)> = roots.iter().cloned().map(|r| (r, 0)).collect();

    while !frontier.is_empty() && found.len() < MAX_CANDIDATES {
        let mut next = Vec::new();

        for (dir, depth) in frontier {
            if !visited.insert(dir.clone()) {
                continue;
            }

            let Ok(entries) = std::fs::read_dir(&dir) else {
                continue;
            };

            for entry in entries.flatten() {
                let path = entry.path();
                let Ok(file_type) = entry.file_type() else {
                    continue;
                };

                if file_type.is_dir() {
                    if depth < MAX_SEARCH_DEPTH {
                        next.push((path, depth + 1));
                    }
                    continue;
                }

                // Symlinks are left alone: `validate_pdf_path` resolves and
                // re-checks whatever we hand it, and following links here
                // would only walk the same tree twice.
                if !file_type.is_file() || claimed.contains(&path) {
                    continue;
                }

                let is_pdf = path
                    .extension()
                    .and_then(OsStr::to_str)
                    .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"));

                if is_pdf {
                    found.push(path);
                    if found.len() >= MAX_CANDIDATES {
                        break;
                    }
                }
            }

            if found.len() >= MAX_CANDIDATES {
                break;
            }
        }

        frontier = next;
    }

    found
}

/// The path whose contents hash to `id`, if one is nearby.
///
/// Content is the only evidence accepted — the name merely decides what gets
/// hashed first. A file that looks right and hashes wrong is a different book,
/// and relinking to it would silently attach one book's progress to another.
pub(crate) fn find_by_hash<F>(candidates: &[PathBuf], id: &str, hash: F) -> Option<PathBuf>
where
    F: Fn(&str) -> Result<String, String>,
{
    candidates.iter().find_map(|path| {
        let as_str = path.to_str()?;
        // A candidate that will not hash (unreadable, vanished mid-walk) is
        // just not the match; the search continues.
        match hash(as_str) {
            Ok(found) if found == id => Some(path.clone()),
            _ => None,
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn tmp(name: &str) -> PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!("lectrice_heal_{}_{}", std::process::id(), name));
        p
    }

    #[test]
    fn search_roots_start_with_the_missing_file_own_folder() {
        let roots = search_roots(
            "/books/philosophy/ethics.pdf",
            &["/books/inbox/other.pdf".to_string()],
        );

        assert_eq!(roots.first(), Some(&PathBuf::from("/books/philosophy")));
    }

    #[test]
    fn search_roots_include_folders_of_documents_that_still_resolve() {
        let roots = search_roots(
            "/books/gone.pdf",
            &[
                "/books/data/one.pdf".to_string(),
                "/other/two.pdf".to_string(),
            ],
        );

        assert!(roots.contains(&PathBuf::from("/books/data")));
        assert!(roots.contains(&PathBuf::from("/other")));
    }

    #[test]
    fn search_roots_are_deduplicated() {
        let roots = search_roots(
            "/books/gone.pdf",
            &[
                "/books/one.pdf".to_string(),
                "/books/two.pdf".to_string(),
                "/books/three.pdf".to_string(),
            ],
        );

        assert_eq!(roots, vec![PathBuf::from("/books")]);
    }

    #[test]
    fn rank_puts_the_kept_name_first() {
        let candidates = vec![
            PathBuf::from("/books/decoy.pdf"),
            PathBuf::from("/books/archive/ethics.pdf"),
            PathBuf::from("/books/another.pdf"),
        ];

        let ranked = rank_candidates(candidates, OsStr::new("ethics.pdf"));

        assert_eq!(ranked[0], PathBuf::from("/books/archive/ethics.pdf"));
    }

    #[test]
    fn rank_keeps_every_candidate() {
        let candidates = vec![
            PathBuf::from("/books/a.pdf"),
            PathBuf::from("/books/b.pdf"),
            PathBuf::from("/books/c.pdf"),
        ];

        let ranked = rank_candidates(candidates.clone(), OsStr::new("nothing-matches.pdf"));

        assert_eq!(ranked, candidates, "no match must not drop candidates");
    }

    #[test]
    fn collect_finds_pdfs_in_subfolders_and_ignores_other_files() {
        let root = tmp("collect");
        let nested = root.join("Data Engineering");
        fs::create_dir_all(&nested).unwrap();
        fs::write(root.join("top.pdf"), b"%PDF top").unwrap();
        fs::write(root.join("notes.txt"), b"not a pdf").unwrap();
        fs::write(nested.join("filed.pdf"), b"%PDF filed").unwrap();

        let found = collect_pdfs(std::slice::from_ref(&root), &HashSet::new());
        let _ = fs::remove_dir_all(&root);

        assert!(found.contains(&root.join("top.pdf")));
        assert!(found.contains(&nested.join("filed.pdf")));
        assert_eq!(found.len(), 2, "only .pdf files are candidates: {found:?}");
    }

    #[test]
    fn collect_skips_paths_already_claimed_by_a_document() {
        let root = tmp("claimed");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("mine.pdf"), b"%PDF mine").unwrap();
        fs::write(root.join("loose.pdf"), b"%PDF loose").unwrap();

        let claimed = HashSet::from([root.join("mine.pdf")]);
        let found = collect_pdfs(std::slice::from_ref(&root), &claimed);
        let _ = fs::remove_dir_all(&root);

        assert_eq!(found, vec![root.join("loose.pdf")]);
    }

    #[test]
    fn collect_stops_below_the_depth_limit() {
        let root = tmp("deep");
        let too_deep = root.join("a").join("b").join("c").join("d");
        fs::create_dir_all(&too_deep).unwrap();
        fs::write(too_deep.join("buried.pdf"), b"%PDF buried").unwrap();

        let found = collect_pdfs(std::slice::from_ref(&root), &HashSet::new());
        let _ = fs::remove_dir_all(&root);

        assert!(
            found.is_empty(),
            "a file {} levels down must not be reached: {found:?}",
            MAX_SEARCH_DEPTH + 1
        );
    }

    #[test]
    fn collect_tolerates_a_root_that_does_not_exist() {
        let found = collect_pdfs(&[tmp("never_created")], &HashSet::new());
        assert!(found.is_empty());
    }

    #[test]
    fn find_by_hash_returns_the_content_match_not_the_name_match() {
        let candidates = vec![
            PathBuf::from("/books/ethics.pdf"),
            PathBuf::from("/books/renamed.pdf"),
        ];

        let found = find_by_hash(&candidates, "wanted", |path| {
            Ok(if path.ends_with("renamed.pdf") {
                "wanted".to_string()
            } else {
                "something-else".to_string()
            })
        });

        assert_eq!(found, Some(PathBuf::from("/books/renamed.pdf")));
    }

    #[test]
    fn find_by_hash_skips_candidates_that_cannot_be_hashed() {
        let candidates = vec![
            PathBuf::from("/books/unreadable.pdf"),
            PathBuf::from("/books/good.pdf"),
        ];

        let found = find_by_hash(&candidates, "wanted", |path| {
            if path.ends_with("good.pdf") {
                Ok("wanted".to_string())
            } else {
                Err("FILE_READ_ERROR: Cannot open file".to_string())
            }
        });

        assert_eq!(found, Some(PathBuf::from("/books/good.pdf")));
    }

    /// The whole search against real files and the real hash: everything the
    /// command does except the UPDATE. A book is added, moved into a subfolder
    /// under a new name, and found again by content.
    #[test]
    fn a_renamed_and_refiled_book_is_found_by_content() {
        use super::super::db::compute_file_hash;

        let root = tmp("end_to_end");
        let shelf = root.join("Philosophy");
        fs::create_dir_all(&shelf).unwrap();

        let was_at = root.join("ethics.pdf");
        fs::write(&was_at, b"%PDF-1.7 Spinoza").unwrap();
        let id = compute_file_hash(was_at.to_str().unwrap()).unwrap();

        // Same bytes, new name, one folder down — plus a decoy that keeps the
        // old name so the content check is what decides.
        let now_at = shelf.join("Spinoza - Ethics (1677).pdf");
        fs::rename(&was_at, &now_at).unwrap();
        fs::write(root.join("ethics.pdf"), b"%PDF-1.7 a different book").unwrap();

        let roots = search_roots(was_at.to_str().unwrap(), &[]);
        let candidates = collect_pdfs(&roots, &HashSet::new());
        let ranked = rank_candidates(candidates, OsStr::new("ethics.pdf"));
        let found = find_by_hash(&ranked, &id, compute_file_hash);

        let _ = fs::remove_dir_all(&root);

        assert_eq!(
            found,
            Some(now_at),
            "the moved file must be recovered by its hash, not its name"
        );
    }

    #[test]
    fn find_by_hash_returns_none_when_nothing_matches() {
        let candidates = vec![PathBuf::from("/books/a.pdf")];
        let found = find_by_hash(&candidates, "wanted", |_| Ok("other".to_string()));
        assert!(found.is_none());
    }

    #[test]
    fn find_by_hash_stops_at_the_first_match() {
        use std::cell::Cell;
        let hashed = Cell::new(0);
        let candidates = vec![
            PathBuf::from("/books/first.pdf"),
            PathBuf::from("/books/second.pdf"),
        ];

        find_by_hash(&candidates, "wanted", |_| {
            hashed.set(hashed.get() + 1);
            Ok("wanted".to_string())
        });

        assert_eq!(hashed.get(), 1, "hashing must stop at the first match");
    }
}
