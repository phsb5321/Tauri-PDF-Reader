//! Schema migrations, run on the RAW `toml::Value` before deserialization.
//!
//! Migrating typed structs cannot express a shape change: once a document has
//! been deserialized into the current `Config`, the old shape is already gone
//! (or the deserialization already failed). So migrations operate on the parsed
//! but untyped document, in version order, and only then is the result typed.
//!
//! A file with no `schema_version` is treated as the CURRENT version rather
//! than as version 0. A hand-written file should not need a version line, and
//! the first published schema is the one those files are written against.

use toml::Value;

use super::schema::CURRENT_SCHEMA_VERSION;

/// What a migration pass did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MigrationOutcome {
    /// The version declared by the file (or the current one when absent).
    pub from_version: u32,
    /// Whether the document was rewritten.
    pub changed: bool,
    /// Human-readable notes, one per applied step.
    pub notes: Vec<String>,
}

/// Read the declared version, defaulting to the current schema.
pub fn declared_version(document: &Value) -> u32 {
    document
        .get("schema_version")
        .and_then(Value::as_integer)
        .and_then(|v| u32::try_from(v).ok())
        .unwrap_or(CURRENT_SCHEMA_VERSION)
}

/// Bring `document` up to [`CURRENT_SCHEMA_VERSION`] in place.
///
/// Unknown FUTURE versions are left untouched: a file from a newer Lectrice is
/// not something this build can rewrite, and the unknown-key warnings will
/// describe whatever it does not recognise.
pub fn apply(document: &mut Value) -> MigrationOutcome {
    let from_version = declared_version(document);
    let mut notes = Vec::new();
    let mut changed = false;

    // Migration steps go here, one `if version < N` block each, in order.
    // Every step must be idempotent and must bump `schema_version`.
    //
    // There is no step yet: version 1 is the first published schema. The
    // machinery is here (and tested) because retrofitting it onto files already
    // on users' disks is the expensive version of this work.

    if from_version < CURRENT_SCHEMA_VERSION {
        // Any file declaring an older version than we know about gets stamped
        // to current once every step above has run.
        if let Some(table) = document.as_table_mut() {
            table.insert(
                "schema_version".to_string(),
                Value::Integer(i64::from(CURRENT_SCHEMA_VERSION)),
            );
            changed = true;
            notes.push(format!(
                "migrated config from schema_version {from_version} to {CURRENT_SCHEMA_VERSION}"
            ));
        }
    } else if from_version > CURRENT_SCHEMA_VERSION {
        // Say so instead of running a config this build cannot interpret in
        // silence. Not an error: the keys it DOES understand still apply, and
        // anything else is already covered by the unknown-key warnings.
        notes.push(format!(
            "config declares schema_version {from_version}, newer than this build's \
             {CURRENT_SCHEMA_VERSION} — it was written by a newer Lectrice; \
             unrecognised keys are ignored"
        ));
    }

    MigrationOutcome {
        from_version,
        changed,
        notes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(source: &str) -> Value {
        toml::from_str(source).expect("fixture must be valid toml")
    }

    #[test]
    fn a_versionless_file_is_treated_as_current_and_untouched() {
        let mut document = parse("[tts]\nrate = 1.5\n");
        let outcome = apply(&mut document);

        assert_eq!(outcome.from_version, CURRENT_SCHEMA_VERSION);
        assert!(!outcome.changed, "no rewrite for an already-current file");
        assert!(document.get("schema_version").is_none());
    }

    #[test]
    fn an_older_file_is_stamped_to_the_current_version() {
        let mut document = parse("schema_version = 0\n[tts]\nrate = 1.5\n");
        let outcome = apply(&mut document);

        assert_eq!(outcome.from_version, 0);
        assert!(outcome.changed);
        assert_eq!(
            declared_version(&document),
            CURRENT_SCHEMA_VERSION,
            "the stamped document must report the current version"
        );
        assert_eq!(outcome.notes.len(), 1);
        // The migration must not disturb the payload it carried.
        assert_eq!(
            document
                .get("tts")
                .and_then(|t| t.get("rate"))
                .and_then(Value::as_float),
            Some(1.5)
        );
    }

    #[test]
    fn migration_is_idempotent() {
        let mut document = parse("schema_version = 0\n");
        apply(&mut document);
        let second = apply(&mut document);
        assert!(!second.changed, "re-running must be a no-op");
    }

    #[test]
    fn a_future_version_is_left_alone_but_reported() {
        let future = CURRENT_SCHEMA_VERSION + 7;
        let mut document = parse(&format!("schema_version = {future}\n"));
        let outcome = apply(&mut document);

        assert_eq!(outcome.from_version, future);
        assert!(!outcome.changed, "a future file must not be rewritten");
        assert_eq!(declared_version(&document), future);
        assert!(
            outcome.notes.iter().any(|n| n.contains("newer")),
            "running a config this build cannot interpret must not be silent: {:?}",
            outcome.notes
        );
    }

    #[test]
    fn a_nonsense_version_value_falls_back_to_current() {
        let mut document = parse("schema_version = \"banana\"\n");
        assert_eq!(declared_version(&document), CURRENT_SCHEMA_VERSION);
        let outcome = apply(&mut document);
        assert!(!outcome.changed);
    }
}
