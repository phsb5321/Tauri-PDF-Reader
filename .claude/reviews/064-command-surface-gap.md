# Adversarial review — 064-command-surface-gap

**Reviewer:** Groq `openai/gpt-oss-120b` (OpenAI-lineage — family-diverse against an Anthropic author), single-shot `chat/completions`.
**Why not DeepInfra:** balance still exhausted per the infra decision ledger (`Payment Required`, an account state); no probe spent.
**Date:** 2026-08-01

## Verdict as returned: CHANGES REQUIRED

2 BLOCKER / 1 MAJOR / 2 MINOR. **One accepted and fixed, one accepted in
substance but fixed by the compiler rather than by a test, three refuted.**

| Finding                                                                        | Disposition                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| BLOCKER — `commands_in_macro` silently drops a line it cannot read             | **ACCEPTED** — the parser now refuses such a line instead of passing over it; mutation-proved                                                   |
| BLOCKER — the tests could pass while the property is false                     | **PARTLY ACCEPTED** — the parsing half is the finding above; the signature half is out of scope and recorded; the `cfg` half is refuted below   |
| MAJOR — a hand-written 63-entry exception list institutionalises the debt      | REFUTED — a list derived from the source is a tautology: it can never fail, which is the whole function of a baseline                           |
| MINOR — `include_str!` has failure modes (feature gates, non-UTF-8)            | REFUTED — rustc will not compile a non-UTF-8 source file; the feature-gate half is the `cfg` argument, answered by a compile error              |
| MINOR — is the corrected doc comment accurate?                                 | No change requested by the reviewer; its own audit agreed with the comment                                                                      |

## The accepted finding

The reviewer's example was exact:

```rust
#[cfg(feature = "native-tts")] audio_cache_clear_document,
```

The old parser stripped the comment tail, took the last `::` segment, tested it
for `[a-z0-9_]`, and returned `None` when it did not match. On that line the test
fails, so the whole line — command included — left the parse. Both lists are read
by the same function, so a command written that way in *both* macros disappears
from both at once and the two agree about something neither has seen. Every
`#[cfg]` in `generate_handler!` today sits on its own line, so nothing is
currently lost, but nothing was stopping the next one.

The fix is not a better guess at the shape. Anything inside the body that is not
blank, not a `//` comment, and not an attribute alone on its line must resolve to
a command, or the parse panics naming the line. `syn` was the reviewer's
suggestion and would parse more shapes, but the failure mode being fixed is
*silence*, not narrow coverage — refusing the line fixes silence at five lines
instead of a dependency.

Mutation proof — `#[cfg(feature = "native-tts")] tts_ghost_command,` added to
`generate_handler!`, a name in neither list and in no exception:

```text
generate_handler! has a line this test cannot read as a command, an attribute or a comment: "            #[cfg(feature = \"native-tts\")] tts_ghost_command,"
Keep one command per line and attributes on their own line, or teach commands_in_macro the new shape. A line it cannot read is a command it stops watching.
test result: FAILED. 5 passed; 2 failed
```

Reverted; `grep -c tts_ghost_command src/lib.rs` = 0.

## The `cfg` argument, and why no test guards it

Both reviewer findings lean on conditional compilation: the parse reads raw
source, so it sees every feature's commands at once, while a build sees one set.

Half of that is true and deliberate. `native-tts` is not in `default`, so the
eleven `tts_*` commands are registered only where the feature is asked for. Both
lists come from the same text, so they stay consistent with each other, and for
an exception list a union is the conservative side to err on — it records
everything that could ever be registered untyped.

The dangerous direction is the reverse: a *typed* command behind a feature would
be exported to `bindings.ts` and unregistered in a default build, and a
union-based subset check would pass. A guard for it was written, then deleted,
because the mutation that was supposed to prove it produced a compile error
instead:

```text
error: no rules expected `#`
   --> src/lib.rs:368:9
    |
368 |         #[cfg(feature = "native-tts")]
    |         ^ no rules expected this token in macro call
    |
note: while trying to match meta-variable `$b:ident`
   --> tauri-specta-2.0.0-rc.20/src/macros.rs:44:8
```

`collect_commands!` matches bare idents. The condition cannot be written, so the
assertion could never fire, and a test that cannot fail is worse than the comment
that replaced it — recorded on `LIB_RS` in `tests/bindings_contract.rs`.

## The refutations

**A derived exception list.** The reviewer proposed generating the 63 entries
from the source, via an `#[untyped]` attribute plus a proc macro, or a build
step writing `untyped_commands.txt`. Both remove the ratchet. The test already
computes the untyped set from the source on every run; the checked-in list is
the *baseline* it is compared against. Regenerate the baseline from the same
source and the comparison is `x == x` — it passes for every possible edit,
including the one it exists to catch. The manual edit is the point: it is the
moment someone has to write down that a new command shipped without types.
The `#[untyped]` variant also keeps a manual act (annotating) while losing the
single place a reviewer can see the size of the debt.

**Non-UTF-8 source.** rustc requires source files be UTF-8; a `src/lib.rs` that
`include_str!` could not read is a crate that does not compile at all. Not a
failure mode this test can have.

**Signature drift on untyped commands.** True, and out of scope by construction:
an untyped command has no generated binding for its signature to drift against.
Its drift surface is the hand-written wrapper in `src/lib/api/`, which is the
next slice, recorded in `docs/agent-backlog-state.md` Iteration #32. This PR
makes that set countable and non-growing; it does not claim to check it.

## Local gates after the fix

```text
cargo fmt --check                                          exit 0
cargo clippy --features test-mocks --all-targets -D warnings  exit 0
cargo test --features test-mocks --test bindings_contract  7 passed; 0 failed
./tools/alignment-gate.sh --worktree                       0 errors
```
