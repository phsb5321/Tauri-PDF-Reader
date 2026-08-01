# Adversarial review — 063-bindings-drift

**Reviewer:** Groq `openai/gpt-oss-120b` (OpenAI-lineage — family-diverse against an Anthropic author), single-shot `chat/completions`.
**Why not DeepInfra:** balance exhausted per the infra decision ledger; no probe spent.
**Date:** 2026-08-01

## Verdict as returned: CHANGES REQUIRED

2 BLOCKER / 1 MAJOR / 3 MINOR / 1 TEST-GAP. **One accepted, six refuted by measurement.**
Disposition and the evidence for each refutation are recorded in `docs/agent-backlog-state.md`, Iteration #31.

| Finding                                                                            | Disposition                                                                                                                                           |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| BLOCKER — `fs::write` truncates, so a failed _write_ still empties the destination | **ACCEPTED** — staged write + atomic `rename`, plus `a_failed_write_leaves_the_destination_untouched`, mutation-proved                                |
| BLOCKER — failed-render test goes vacuous if the `i64` leaves the surface          | REFUTED — it is `expect_err`; a successful render panics with a message written for that case                                                         |
| MAJOR — `invoked_commands` substring parsing is fragile                            | REFUTED — 28 hits / 28 parses / 28 commands, none in comments, no escapes; parser is symmetric across both sides; byte-for-byte test is the real gate |
| TEST-GAP — nothing asserts the bindings are valid TypeScript                       | REFUTED — `pnpm typecheck`, ci.yml:69; its fix needs node in the Rust job (a gated workflow edit)                                                     |
| MINOR — determinism only proved in-process                                         | REFUTED — already stated in that test's doc comment; CI is the cross-process check                                                                    |
| MINOR — `Ordering::Relaxed` could clash                                            | REFUTED — `fetch_add` is atomic regardless of ordering; each thread uses its own value                                                                |
| MINOR — `.prettierignore` may not apply from a CI subdirectory                     | REFUTED — `grep -ci prettier ci.yml` = 0; CI never runs prettier                                                                                      |

## Raw response

```markdown
**BLOCKER** – `src-tauri/src/lib.rs:84` – `write_bindings` does **not** guarantee that the destination file stays intact when the _write_ itself fails.  
The function first renders the bindings (`builder.export_str`) **and then** calls `std::fs::write`, which opens the file with `create(true)` + `truncate(true)`. If the write fails (disk‑full, permission error, I/O error, panic while flushing, etc.) the file is left empty or partially written. The test suite only checks the _render_‑error path (`BigIntForbidden`) and therefore gives a false sense of safety.  
_Fix_: write to a temporary file and rename atomically, or at least preserve the old contents on any `std::io::Error`. Add a test that forces a write error (e.g. by pointing at a read‑only directory) and asserts the original file is unchanged.

---

**MAJOR** – `src-tauri/tests/bindings_contract.rs:71` – `invoked_commands` parser is **fragile**.  
It looks for the literal substring `TAURI_INVOKE("` and then grabs everything up to the next `"` character. This will also match:

- a command name that appears inside a comment,
- a string literal that is not an actual invoke (e.g. documentation or a test fixture),
- a command name that contains an escaped quote (`\"`) – the parser will stop early.

If any of those appear in the generated file, the test will either report a _missing_ command that actually exists, or a _spurious_ extra command, causing false‑positive drift failures.  
_Fix_: parse the generated TypeScript with a proper JavaScript/TypeScript parser (e.g. `swc` or `esprima`) and extract the argument of the `TAURI_INVOKE` call from the AST, or at least add a sanity check that the match is not inside a comment (`//` or `/* … */`).

---

**MINOR** – `src-tauri/tests/bindings_contract.rs:115` – `generation_is_deterministic` only proves **in‑process** determinism.  
Specta may use a global `HashMap` whose iteration order is _process‑local_ (seeded at process start). Two calls in the same process will see the same order, but two separate test binaries (or a future CI step that runs the generator in a different process) could produce a different ordering, making the _byte‑for‑byte_ test flaky.  
_Fix_: run the generator in a separate process (e.g. via `std::process::Command`) for the deterministic test, or add a cross‑process sanity check (e.g. write the first output to a temp file, spawn a new process that runs `regenerate()` again, and compare the two files).

---

**TEST‑GAP** – No test asserts that the **generated bindings are valid TypeScript**.  
The repository’s CI runs `pnpm typecheck`, but the _unit‑test_ suite does not verify this claim. According to the “Verification Discipline” rule, any behavioural claim (that the bindings can be consumed by the frontend) must be proved by a runnable assertion.  
_Fix_: add a test that invokes `tsc --noEmit` (or `pnpm typecheck`) on the freshly generated file and asserts success. This test should be part of the Rust test suite (e.g. by spawning `node` with `ts-node` or by using `deno` to type‑check) so the guarantee is enforced even when the JS toolchain is not run manually.

---

**MINOR** – `src-tauri/tests/bindings_contract.rs:46` – `AtomicUsize` uses `Ordering::Relaxed`.  
Relaxed ordering is sufficient for uniqueness, but it provides **no happens‑before** guarantees for the subsequent file‑system operations. In the extremely unlikely case that another thread observes the increment _after_ the file write has started, the filename could clash. Switching to `Ordering::SeqCst` eliminates any subtle race without measurable cost.

---

**MINOR** – `.prettierignore` is added at the repository root, but the CI may invoke Prettier from a sub‑directory (e.g. `cd src && prettier …`). In that scenario the ignore rule would not match and Prettier could reformat `src/lib/bindings.ts`, causing the _byte‑for‑byte_ test to fail spuriously.  
_Fix_: either place the ignore rule relative to the working directory (`src/lib/bindings.ts`) **and** add a CI safeguard that runs Prettier from the repository root, or add a test that runs `prettier --file-info` from the same cwd the CI uses and asserts `ignored: true`.

---

**BLOCKER** – `src-tauri/tests/bindings_contract.rs:124` – The “failed render” test (`a_failed_render_leaves_the_destination_untouched`) is **hard‑coded** to the current `i64`‑based failure (`BigIntForbidden`). If the codebase later removes all `i64` fields, the test will pass vacuously while the underlying guarantee (that _any_ render error leaves the file untouched) is no longer exercised.  
_Fix_: inject a deliberately broken `LanguageExt` implementation that always returns an error, or temporarily add a dummy command that forces a `BigIntForbidden` regardless of the real model. This keeps the test meaningful even after the concrete failure disappears.

---

### VERDICT

**CHANGES REQUIRED**

The current diff introduces useful safety nets (the custom exporter, the drift test, the `.prettierignore`), but it leaves several critical safety and verification gaps unaddressed. At minimum the repository must:

1. Make `write_bindings` atomic against write‑errors and add a corresponding test.
2. Harden the `invoked_commands` parser or replace it with a proper AST‑based extractor.
3. Strengthen the determinism test to cover cross‑process variability.
4. Add a test that type‑checks the generated TypeScript.
5. (Optional but recommended) tighten the atomic counter ordering and guard the Prettier ignore rule against cwd differences.

Only after these issues are resolved should the suite be considered passing.
```
