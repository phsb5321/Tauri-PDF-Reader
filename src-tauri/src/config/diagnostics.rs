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
    // Walk down to a char boundary before slicing: a span that landed
    // mid-codepoint would otherwise PANIC inside the error reporter, turning a
    // bad config into a crash.
    let mut clamped = byte_offset.min(source.len());
    while clamped > 0 && !source.is_char_boundary(clamped) {
        clamped -= 1;
    }
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
    /// A schema migration ran, or the file declares a version this build does
    /// not know. Its own variant rather than a reused `Clamped`: the strings
    /// read the same today, but code that matches on the variant (slice 2's
    /// writer, tests) must not classify a migration as a clamped value.
    Schema { detail: String },
}

impl fmt::Display for Warning {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Warning::UnknownKey { path } => write!(
                f,
                "unknown key `{path}` (ignored — check the spelling, or it may be from a newer version)"
            ),
            Warning::Clamped { detail } | Warning::Schema { detail } => write!(f, "{detail}"),
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

/// Is this line inside a multi-line string, given the state above it?
///
/// Counting `"""` / `'''` delimiters from the top of the file is the only way
/// to know: text inside one is DATA, and reading `foo = bar` out of a quoted
/// paragraph would name a key that does not exist.
fn multiline_string_lines(lines: &[&str]) -> Vec<bool> {
    let mut inside: Option<&'static str> = None;
    let mut flags = Vec::with_capacity(lines.len());

    for line in lines {
        // A line that OPENS a multi-line string still carries its own key, so
        // it is not itself "inside"; the lines after it are.
        flags.push(inside.is_some());

        let mut rest = *line;
        while !rest.is_empty() {
            match inside {
                Some(delimiter) => match rest.find(delimiter) {
                    Some(at) => {
                        inside = None;
                        rest = &rest[at + delimiter.len()..];
                    }
                    None => break,
                },
                None => {
                    let next = ["\"\"\"", "'''"]
                        .into_iter()
                        .filter_map(|d| rest.find(d).map(|at| (at, d)))
                        .min_by_key(|(at, _)| *at);
                    match next {
                        Some((at, delimiter)) => {
                            inside = Some(delimiter);
                            rest = &rest[at + delimiter.len()..];
                        }
                        None => break,
                    }
                }
            }
        }
    }

    flags
}

/// Recover the dotted key for a 1-based line, by reading the user's own file.
///
/// `toml` 0.8 reports a span but not the key path, and the span points at the
/// offending VALUE. So walk backwards from that line: the first `key =` line at
/// or above it is the leaf, and the first `[section]` above that is its table.
/// The result is `section.leaf` — the exact string the user can search for.
///
/// ponytail: a text heuristic, not a parse — but a CONSERVATIVE one. A wrong
/// key is worse than no key: it sends the user to a line that is not the
/// problem. So anything that could be misread yields `None`, and the message
/// still carries file:line:col:
///   * lines inside a `"""`/`'''` multi-line string are DATA and are skipped
///     (a quoted `foo = bar` or `[not_a_section]` must never be read as TOML);
///   * a header must be a WHOLE line — `["a", "b"],` is an array element, not
///     a table;
///   * a key candidate must be a bare/quoted key with no `[`, `{` or `,` in it,
///     so `"aa=bb",` inside an array is not mistaken for `aa = bb`.
///
/// The upgrade path, if inline tables ever matter, is `serde_path_to_error`.
fn key_at(source: &str, line: usize) -> Option<String> {
    let lines: Vec<&str> = source.lines().collect();
    let index = line.checked_sub(1)?.min(lines.len().saturating_sub(1));
    let in_string = multiline_string_lines(&lines);

    let mut leaf: Option<String> = None;

    for current in (0..=index).rev() {
        // Content of a multi-line string is data, not structure.
        if in_string.get(current).copied().unwrap_or(false) {
            continue;
        }

        let text = lines[current].trim();
        if text.is_empty() || text.starts_with('#') {
            continue;
        }

        if let Some(section) = whole_line_section(text) {
            return Some(match leaf {
                Some(leaf) => format!("{section}.{leaf}"),
                None => section,
            });
        }

        if leaf.is_none() {
            leaf = bare_key_of(text);
        }
    }

    // No enclosing section: a top-level key such as `schema_version`.
    leaf
}

/// `[section]` or `[[array.of.tables]]` occupying the WHOLE line (a trailing
/// comment is allowed). `["a", "b"],` — an array element — is not a section.
fn whole_line_section(text: &str) -> Option<String> {
    let rest = text.strip_prefix('[')?;
    let rest = rest.strip_prefix('[').unwrap_or(rest);
    let (name, after) = rest.split_once(']')?;
    let after = after.strip_prefix(']').unwrap_or(after).trim();
    if !after.is_empty() && !after.starts_with('#') {
        return None;
    }
    let name = name.trim().trim_matches('"').trim_matches('\'');
    if name.is_empty() || !is_key_shaped(name) {
        return None;
    }
    Some(name.to_string())
}

/// The key of a `key = value` line, when it is unambiguously one.
fn bare_key_of(text: &str) -> Option<String> {
    let (candidate, _) = text.split_once('=')?;
    let candidate = candidate.trim();
    // Structural characters mean this is a value, not a key.
    if candidate.contains(['[', '{', ',']) {
        return None;
    }
    // A quoted key must be FULLY quoted. `"aa` — the head of the array element
    // `"aa=bb",` — opens a quote it never closes, and reading it as a key would
    // invent `aa`.
    let candidate = match candidate.chars().next() {
        Some(quote @ ('"' | '\'')) => {
            let inner = candidate.strip_prefix(quote)?.strip_suffix(quote)?;
            if inner.contains(quote) {
                return None;
            }
            inner
        }
        _ => {
            if candidate.contains(['"', '\'']) {
                return None;
            }
            candidate
        }
    };
    if candidate.is_empty() || !is_key_shaped(candidate) {
        return None;
    }
    Some(candidate.to_string())
}

fn is_key_shaped(text: &str) -> bool {
    text.chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
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
    fn key_at_ignores_key_like_text_inside_a_multi_line_string() {
        // A quoted paragraph is DATA. Reading `foo = bar` out of it would name
        // a key that does not exist anywhere in the file.
        let source = "[highlight]\ncolors = [\n  \"\"\"\n  foo = bar\n  \"\"\",\n  42,\n]\n";
        assert_eq!(key_at(source, 6), Some("highlight.colors".to_string()));
    }

    #[test]
    fn key_at_ignores_a_section_header_inside_a_multi_line_string() {
        let source = "[highlight]\ncolors = [\n  \"\"\"\n  [not_a_section]\n  \"\"\",\n  42,\n]\n";
        assert_eq!(key_at(source, 6), Some("highlight.colors".to_string()));
    }

    #[test]
    fn key_at_does_not_mistake_a_quoted_equals_for_a_key() {
        // `"aa=bb",` is an array ELEMENT, not `aa = bb`.
        let source = "[highlight]\ncolors = [\n  \"aa=bb\",\n  42,\n]\n";
        assert_eq!(key_at(source, 4), Some("highlight.colors".to_string()));
    }

    #[test]
    fn key_at_does_not_mistake_a_nested_array_element_for_a_section() {
        let source = "[render]\ngrid = [\n  [\"a\", \"b\"],\n  42,\n]\n";
        assert_eq!(key_at(source, 4), Some("render.grid".to_string()));
    }

    #[test]
    fn key_at_reads_an_array_of_tables_header() {
        let source = "[[shelf]]\nname = 12\n";
        assert_eq!(key_at(source, 2), Some("shelf.name".to_string()));
    }

    #[test]
    fn key_at_allows_a_trailing_comment_on_a_section_header() {
        let source = "[cache]  # audio cache\nmax_size_bytes = \"big\"\n";
        assert_eq!(key_at(source, 2), Some("cache.max_size_bytes".to_string()));
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
