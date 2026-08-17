//! Honest diagnostics: an error must name the key AND where it is.
//!
//! "invalid type: string, expected a boolean" is not a usable message — the
//! user has 17 keys and no idea which one. The `toml` crate hands back a byte
//! span; this module turns that into `path/to/config.toml:12:9` and keeps the
//! key path serde reported, so the message points at the exact line.

use std::fmt;
use std::path::Path;

/// A 1-based source position.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Position {
    pub line: usize,
    pub column: usize,
}

/// Convert a byte offset into a 1-based line/column.
///
/// Columns are counted in characters rather than bytes, so a key after a
/// non-ASCII comment still points where the user's editor says it does.
pub fn position_of(source: &str, byte_offset: usize) -> Position {
    let clamped = byte_offset.min(source.len());
    let before = &source[..clamped];
    let line = before.matches('\n').count() + 1;
    let line_start = before.rfind('\n').map_or(0, |idx| idx + 1);
    let column = source[line_start..clamped].chars().count() + 1;
    Position { line, column }
}

/// A config problem that did not stop the app.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Warning {
    /// A key in the file that the schema does not know. Never fatal: one typo
    /// (or a key from a newer Lectrice) must not brick the config.
    UnknownKey { path: String },
    /// A value outside the range the app enforces, clamped into it.
    Clamped { detail: String },
}

impl fmt::Display for Warning {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Warning::UnknownKey { path } => write!(
                f,
                "unknown key `{path}` (ignored — check the spelling, or it may be from a newer version)"
            ),
            Warning::Clamped { detail } => write!(f, "{detail}"),
        }
    }
}

/// A config problem that prevented the file from being used.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigError {
    /// Absolute path of the offending file, as the user typed it.
    pub file: String,
    /// `Some` when the failure carried a source span.
    pub position: Option<Position>,
    /// The dotted key path, when serde reported one.
    pub key: Option<String>,
    /// The underlying message from the parser.
    pub message: String,
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.file)?;
        if let Some(pos) = self.position {
            write!(f, ":{}:{}", pos.line, pos.column)?;
        }
        if let Some(key) = &self.key {
            write!(f, ": key `{key}`")?;
        } else {
            write!(f, ":")?;
        }
        write!(f, ": {}", self.message)
    }
}

impl ConfigError {
    /// Build an error from a `toml` deserialization failure.
    ///
    /// The span is resolved against `source`, so the reported line is a line of
    /// the user's file.
    pub fn from_toml(file: &Path, source: &str, err: &toml::de::Error) -> Self {
        let position = err.span().map(|span| position_of(source, span.start));
        // toml's Display already embeds its own location banner; `message()` is
        // the bare reason, which is what belongs after our file:line:col prefix.
        let message = err.message().to_string();
        Self {
            file: file.display().to_string(),
            position,
            key: position.and_then(|pos| key_at(source, pos.line)),
            message,
        }
    }

    /// Build an error for a file that could not be read at all.
    pub fn from_io(file: &Path, err: &std::io::Error) -> Self {
        Self {
            file: file.display().to_string(),
            position: None,
            key: None,
            message: format!("could not read config file: {err}"),
        }
    }
}

/// Recover the dotted key for a 1-based line, by reading the user's own file.
///
/// `toml` 0.8 reports a span but not the key path, and the span points at the
/// offending VALUE. So walk backwards from that line: the first `key =` line at
/// or above it is the leaf, and the first `[section]` above that is its table.
/// The result is `section.leaf` — the exact string the user can search for.
///
/// ponytail: a text heuristic, not a parse. The ceiling: it names the leaf key
/// for the ordinary `key = value` and multi-line-array cases, and falls back to
/// the bare section (or `None`) for inline-table and dotted-key spellings the
/// template never emits. When it cannot be sure it returns `None` and the
/// message still carries file:line:col, so the user is never misdirected. The
/// upgrade path, if those spellings ever matter, is `serde_path_to_error`.
fn key_at(source: &str, line: usize) -> Option<String> {
    let lines: Vec<&str> = source.lines().collect();
    let index = line.checked_sub(1)?.min(lines.len().saturating_sub(1));

    let mut leaf: Option<String> = None;

    for current in (0..=index).rev() {
        let text = lines[current].trim();
        if text.is_empty() || text.starts_with('#') {
            continue;
        }

        if let Some(section) = text.strip_prefix('[').and_then(|t| t.split(']').next()) {
            let section = section.trim_start_matches('[').trim();
            return Some(match leaf {
                Some(leaf) => format!("{section}.{leaf}"),
                None => section.to_string(),
            });
        }

        if leaf.is_none() {
            if let Some((candidate, _)) = text.split_once('=') {
                let candidate = candidate.trim().trim_matches('"');
                if !candidate.is_empty()
                    && candidate
                        .chars()
                        .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
                {
                    leaf = Some(candidate.to_string());
                }
            }
        }
    }

    // No enclosing section: a top-level key such as `schema_version`.
    leaf
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn position_counts_lines_and_columns_from_one() {
        let source = "alpha\nbeta\ngamma";
        assert_eq!(position_of(source, 0), Position { line: 1, column: 1 });
        assert_eq!(position_of(source, 6), Position { line: 2, column: 1 });
        assert_eq!(position_of(source, 8), Position { line: 2, column: 3 });
    }

    #[test]
    fn position_counts_characters_not_bytes() {
        // "é" is two bytes; the column after it must still read as 2.
        let source = "# é\nx = 1";
        let after_accent = source.find('\n').unwrap();
        assert_eq!(
            position_of(source, after_accent),
            Position { line: 1, column: 4 }
        );
    }

    #[test]
    fn position_clamps_an_out_of_bounds_offset() {
        let source = "x = 1";
        let pos = position_of(source, 9_999);
        assert_eq!(pos.line, 1);
    }

    #[test]
    fn error_display_names_file_line_column_and_key() {
        let err = ConfigError {
            file: "/home/p/.config/lectrice/config.toml".into(),
            position: Some(Position {
                line: 12,
                column: 9,
            }),
            key: Some("tts.rate".into()),
            message: "invalid type: string \"fast\", expected f64".into(),
        };
        let rendered = err.to_string();
        assert!(rendered.contains("config.toml:12:9"), "{rendered}");
        assert!(rendered.contains("tts.rate"), "{rendered}");
        assert!(rendered.contains("expected f64"), "{rendered}");
    }

    #[test]
    fn key_at_composes_section_and_leaf() {
        let source = "# a comment\n[tts]\nrate = \"fast\"\n";
        assert_eq!(key_at(source, 3), Some("tts.rate".to_string()));
    }

    #[test]
    fn key_at_finds_the_leaf_from_inside_a_multi_line_array() {
        // The span for a bad array element points at the element, not the key.
        let source = "[highlight]\ncolors = [\n  \"#FFEB3B\",\n  12,\n]\n";
        assert_eq!(key_at(source, 4), Some("highlight.colors".to_string()));
    }

    #[test]
    fn key_at_handles_a_top_level_key_with_no_section() {
        let source = "schema_version = \"banana\"\n";
        assert_eq!(key_at(source, 1), Some("schema_version".to_string()));
    }

    #[test]
    fn key_at_reports_the_section_when_the_error_is_the_header_itself() {
        let source = "[render]\n";
        assert_eq!(key_at(source, 1), Some("render".to_string()));
    }

    #[test]
    fn key_at_skips_comments_and_blank_lines_while_walking_back() {
        let source = "[cache]\n\n# how big the audio cache may get\nmax_size_bytes = \"big\"\n";
        assert_eq!(key_at(source, 4), Some("cache.max_size_bytes".to_string()));
    }

    #[test]
    fn unknown_key_warning_names_the_full_dotted_path() {
        let warning = Warning::UnknownKey {
            path: "tts.ratee".into(),
        };
        assert!(warning.to_string().contains("tts.ratee"));
    }
}
