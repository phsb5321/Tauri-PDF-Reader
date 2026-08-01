//! Rewrite `src/lib/bindings.ts` from the Rust command surface.
//!
//! This is the fix for a `bindings_contract` failure, not a check — run it when
//! that test reports the checked-in file has drifted, then commit the result.
//!
//! ```text
//! cargo run --example regenerate_bindings
//! ```
//!
//! An example rather than a test carrying an ignore attribute. It writes to the
//! source tree, so it must not run in the default test pass — but a disabled test
//! is the wrong way to say that. It reads as "this check is switched off", to a
//! human and to `tools/alignment-gate.sh` alike, when the truth is that this was
//! never a check. `cargo test` does not build examples into the test run, so
//! nothing has to be suppressed for it to stay out.

use std::path::PathBuf;

use tauri_pdf_reader_lib::{bindings_exporter, specta_builder, write_bindings, BINDINGS_PATH};

fn main() {
    let dest = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(BINDINGS_PATH);
    write_bindings(&specta_builder(), bindings_exporter(), &dest)
        .expect("specta failed to export bindings");
    println!("wrote {}", dest.display());
}
