# Adversarial review — 065-session-typed

**Reviewer:** Groq `openai/gpt-oss-120b` (OpenAI-lineage — family-diverse against an Anthropic author), single-shot `chat/completions`.
**Why not DeepInfra:** balance exhausted per the infra decision ledger (`Payment Required`, an account state, not a transient); no probe spent.
**Date:** 2026-08-01

## Verdict as returned: CHANGES REQUIRED

2 MAJOR / 4 MINOR. **Both MAJORs refuted on measurement, one MINOR
acknowledged as a restatement of the slice's own scope, three MINORs refuted.
No code changed as a result of this review.**

| Finding                                                                                                                 | Disposition                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR — domain/ports types are now the public IPC contract; the repo used to keep a DTO layer                           | REFUTED on premise — there is no DTO layer to keep. The wire `Document` _is_ the SQLite row struct; the domain `Document` never crosses. Real axis, recorded below. |
| MAJOR — specta maps `Result<T, E>` to a union `T \| E`, so `session_get` is `Promise<ReadingSession \| null \| string>` | REFUTED — the generated file says otherwise, quoted below                                                                                                           |
| MINOR — `#[specta::specta]` registers with a global collector at runtime                                                | REFUTED — specta pulls no runtime-registration crate; that is _why_ `collect_commands!` needs an explicit list                                                      |
| MINOR — deferring the wrapper rewrite leaves the PR without functional payoff                                           | ACKNOWLEDGED — restates the slice's documented scoping. The payoff is the ratchet, not the wrappers                                                                 |
| MINOR — the tests could pass while the property is false                                                                | REFUTED — the described mistake is the exact one PR #64 added a gate for; it fails                                                                                  |
| MINOR — external consumers of `COMMANDS_OUTSIDE_THE_TYPED_SURFACE` may need updating                                    | REFUTED — grepped; the constant has no consumer outside the test that declares it                                                                                   |

## MAJOR 2 — the `Result` mapping

The reviewer's claim was specific and checkable: that specta emits a bare union,
so a `Result<Option<ReadingSession>, String>` becomes
`Promise<ReadingSession | null | string>`, a shape the runtime never produces
because Tauri rejects the promise instead.

`src/lib/bindings.ts` is in the diff. It says:

```ts
async sessionGet(sessionId: string) : Promise<Result<ReadingSession | null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("session_get", { sessionId }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
```

and

```ts
export type Result<T, E> =
  | { status: "ok"; data: T }
  | { status: "error"; error: E };
```

That is a discriminated union, not `T | E`, and the wrapper is generated with the
try/catch that converts the rejection into the `error` arm. So the mismatch the
finding predicts — a declared type the runtime cannot produce — is the thing
tauri-specta exists to prevent. `Option<T>` maps to `T | null` on the `data` arm,
which is also what the finding got wrong by folding it into the same union.

Note the `e instanceof Error` branch: a genuine JS exception still propagates. Only
the serialised `Err(String)` becomes `{ status: "error" }`. Both halves of the
runtime behaviour are represented.

## MAJOR 1 — layering

The finding's load-bearing sentence is: _"The repository previously avoided this
by keeping a DTO layer (the `src/db/models.rs` structs) that were the only ones
ever typed."_

Measured, that is backwards. `src/db/models.rs:5` is:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub file_path: String,
    ...
```

— the SQLite row struct, typed and on the wire. Meanwhile
`src-tauri/src/domain/document/mod.rs` derives `(Debug, Clone, PartialEq)` and is
not serialisable at all. So the existing precedent is not _domain → DTO → wire_.
It is _persistence struct is the wire struct_, and the domain type is the one kept
off the boundary. There is no DTO layer this slice broke out of.

Sharper: `src/db/models.rs` contains **no session structs at all**. Sessions are
modelled where they are defined. "Keep using the DTO layer" would not have been
following an existing pattern; it would have been inventing a mirror for one
family and leaving the other families on the old one.

The coupling worry underneath is still real, and it was weighed before the slice
(Iteration #33): a mirror struct plus a mapping function does not _decouple_ the
frontend from a domain rename — it duplicates the shape and adds a hand-written
translation that nothing proves stays faithful. What actually catches a rename is
the byte-for-byte bindings snapshot: change a field in `ReadingSession` and
`src/lib/bindings.ts` fails the contract test until it is regenerated, and the
regeneration lands in the diff where a reviewer sees it. That is the enforcement
the DTO would have been hand-rolling.

Recorded as an open design axis, not a defect in this slice. If a session field
ever needs to differ between storage and wire, that is the moment the DTO earns
its keep — and it will be one struct, not a policy.

## MINOR — the "runtime collector"

Claimed: `#[specta::specta]` "registers the command's type information with a
global `specta::ts::Export` collector at **runtime** (executed the first time the
binary is loaded)", so the change is not purely compile-time.

Runtime registration in Rust needs a life-before-main crate. There are three in
common use, and the lockfile has one:

```
$ grep -nE '^name = "(ctor|inventory|linkme)"' Cargo.lock
711:name = "ctor"
```

`cargo tree -i ctor` gives its only path:

```
ctor v0.2.9 (proc-macro)
└── tauri-utils → tauri-codegen → tauri-macros → tauri
```

specta is not on it. specta's own direct dependencies are `chrono`, `paste`,
`specta-macros`, `thiserror`, `uuid` — nothing that can run code before `main`.

The design argument is the same conclusion from the other side: if there were a
global collector, `collect_commands!` would not need to be handed a list. The
whole reason this slice has a `lib.rs` hunk at all is that `#[specta::specta]`
only implements a trait, and something has to name the implementors.

## MINOR — "the tests could pass while the property is false"

The scenario given: a developer forgets `#[specta::specta]` _and_ forgets the
`collect_commands!` entry, so the command is absent from both sides and the lists
agree.

That is exactly the hole PR #64 closed, one slice ago. The command still has to be
in `generate_handler!` to be invocable, and:

```rust
let untyped: Vec<String> = registered.iter().filter(|c| !typed.contains(c))...
let newly_untyped: Vec<&String> = untyped.iter()
    .filter(|c| !COMMANDS_OUTSIDE_THE_TYPED_SURFACE.contains(&c.as_str()))
    .collect();
assert!(newly_untyped.is_empty(), "registered with tauri but not typed by specta, \
    and not recorded as an exception: {newly_untyped:?}...");
```

Registered, untyped, unrecorded → the test names it. The reviewer's own words for
the property — "typed commands ⊆ registered commands" — describe the _first_ test
in that file, not this one; the finding does not account for the second.

The remaining case, a command in neither macro, is not a registered command at
all: `invoke` fails at runtime, and `src/__tests__/contracts/tauri-command-contracts.test.ts`
("every invoked command is registered in generate_handler!") fails for any wrapper
pointing at it.

## MINOR — stale consumers of the constant

Grepped across `*.rs`, `*.ts`, `*.js`, `*.sh`, `*.yml`. Every hit is inside
`src-tauri/tests/bindings_contract.rs`, which declares it, plus one prose mention
in the `lib.rs` doc comment that describes the test. No script, CI step, or
generator reads it. The finding says as much itself ("No evidence that such
consumers exist") — confirmed rather than assumed.

## MINOR — no functional payoff

Fair as a description, and it is what the PR body and Iteration #33 already say:
the wrappers in `src/lib/api/sessions.ts` still call `invoke` with string names,
and pointing them at `commands.*` is the next slice. The measurement behind that
split is in the backlog — the wrapper rewrite touches three consumers and a
nullability disagreement (`title: string | null` from Rust vs `title?: string` in
the hand-written type), which is a different review than "did the derives land".

The payoff that _is_ in this slice is the ratchet: 63 → 53 recorded exceptions,
and ten commands that can no longer drift from their TypeScript without the
byte-for-byte test failing. That is not nothing; it is just not visible in the UI.
