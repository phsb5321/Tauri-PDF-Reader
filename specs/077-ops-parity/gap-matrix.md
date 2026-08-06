# Lectrice operational-parity gap matrix

Evidence base: `origin/main` `1ffdf4d`; Product packet SHA-256
`ea893ff18b362e4b68ebb0d08db880b72c384afb7cc0b96a0a4ad850811b5073`;
Quality packet SHA-256
`2f02c3b4740e439a6550272eb0bb3b7bc42d95fc8c93c349aa7627aaf0c23dc0`;
Engineer feasibility packet SHA-256
`165e9166fa16c013e4b8be91ae6c5cdaf1f6e9483de1eb4b5527d27563aa8a68`.

| Control | Status | Evidence | Falsifier / next discriminator |
| --- | --- | --- | --- |
| PDF path validation | present | `src-tauri/src/commands/library/db.rs`: canonical target, regular `.pdf`, opened-fd restat | `.pdf` symlink to a device/non-PDF is accepted or opened fd is not restatted. |
| Typed IPC | present, ratcheted | `src-tauri/tests/bindings_contract.rs`; generated `src/lib/bindings.ts`; constitution records incomplete surface | A registered command escapes both generated surface and explicit shrinking exception list. |
| Tauri capability/CSP | present-but-false-green | `$APPLOCALDATA` fs scope and empty asset scope, but `shell:allow-open`, plugin defaults, global Tauri, unsafe eval/inline and CDN remain | A static contract accepts an unreviewed permission/origin or a compromised WebView reaches dead authority. |
| Session-only provider key | present-but-false-green | `ai-tts-store.ts` persists `apiKey` in `ai-tts-storage` | Legacy/current canary appears in hydrated state, WebView storage, SQLite, logs or evidence. |
| Explicit remote TTS disclosure | missing | `AiTtsSettings.tsx` names key/provider but not PDF-text egress | Initialization/transfer occurs before an accessible disclosure plus explicit Connect. |
| Offline local reading | present-but-false-green | local PDF bytes, but `pdf-service.ts` loads CMaps from jsDelivr and CSP permits it | Deny network with a CMap-dependent synthetic PDF; any request/failure disproves full offline. |
| Removal/cache recovery | present-but-false-green | generic confirm plus cascading SQL delete; cache files are separate | Plant note/session/cache, remove, and observe hidden irreversible loss or orphan files. |
| Telemetry UX | present-but-false-green | settings advertise sends; no sender exists | Toggle settings and observe identical zero egress while UI promises otherwise. |
| Diagnostic redaction | missing | raw message/context export in `services/logging.rs` | Canary key/path/PDF text appears in exported text/JSON. |
| CodeQL | present, hosted partial | SHA-pinned JS/TS workflow; Rust explicitly out of scope | A controlled vulnerable fixture is not reported; local/offline and Rust coverage remain absent. |
| Sonar | present, hosted partial | fail-closed main-only TS quality-gate workflow plus scope negative control | Missing host/token passes, scope overlap survives, or PR/Rust is claimed covered. |
| Alignment gate | present | `tools/alignment-gate.sh` plus planted TODO/suppression test | Planted completion-theater diff passes. Debug remains warning by policy. |
| Knip | present-but-false-green | pinned package but CI uses `--no-exit-code` and broad ignores | A new unused export/file does not make the exact gate non-zero. |
| Coverage helper | present-but-false-green | CI coverage is blocking; `test:coverage:check` ends with `|| echo` | A below-floor run returns zero. |
| Gitleaks | present | `.gitleaks.toml` (extends defaults; `elevenlabs-api-key` rule; allowlist for node_modules/target/dist/coverage, sonar-project.properties, cache-key fixtures); `tools/gitleaks-scan.sh` fail-closed entry point (`dir`/`git`/`canary`, 8.30.1); runtime-generated low-entropy canary never committed | Synthetic canary does not fail `gitleaks dir` with rule `elevenlabs-api-key`; missing binary exits 0; or a planted key under `node_modules/` is reported. |
| Semgrep | missing | no repo rules/fixtures; only host `opengrep` found | Must-match and must-not-match fixtures are not both enforced. |
| Dependency/SBOM/license/vulnerability policy | missing | lockfiles only; no audit/deny/OSV/SBOM/license gate | Synthetic advisory/policy violation passes or scanner silently skips. |
| SECURITY/privacy/retention policy | missing | old spec 008 is scoped hardening, not current reporting/threat/data policy | Current doc fails to name classes, trust boundaries, retention, deletion and reporting. |
| AGENTS/CLAUDE drift | missing | 278 vs 399 lines; 318 additions/197 deletions; no drift guard | A changed normative rule in one file passes. |
| Owner map/blackboard | present manually, missing contract | this file is durable and single-writer by convention; no lock/schema/sentinel/stale-owner test | Concurrent/stale writer or malformed receipt is accepted. |
| Machine gate receipt | missing | `pnpm verify` terminal summary only and does not mirror all CI/security gates | Alter base/head/diff/tool fields or omit one; no parser currently fails. |
| Evidence retention | missing | native evidence relies on `/tmp`; no manifest/redaction/expiry | Delete `/tmp` and the result cannot be replayed/verified durably. |
| Different-family review | missing for active slices | Product/Quality are Codex family; PR #72 independent verdict unavailable | No saved typed verdict bound to exact base/head/diff. |
| Release provenance | present-but-false-green | release builds bundles; one publish action pinned, setup actions float; no signing/checksum/SBOM/provenance | Consumer cannot authenticate artifact/source/toolchain relationship. |
| One-way Notes snapshot | not applicable / YAGNI | private Notes roots exist; no approved second/public audience | Applicable only after approved P0/P1 consumer and default-deny allowlist; activation remains Pedro-gated. |
| Workflow/sync activation | Pedro-gated | explicit user protocol and project merge law | Any workflow/sync diff in 077 violates scope. |

## Ranked slices after 077

1. ~~Repo-owned Gitleaks 8.30.1 config plus synthetic canary and fail-closed local
   entry point~~ **DONE — T102, 05/08/2026 (`102-gitleaks`).**
2. Executable Tauri CSP/capability contract, followed only by tightenings that
   survive a packaged-app falsifier; reuse the Specta and path ratchets.
3. Current SECURITY/privacy/retention and threat/dataflow policy.
4. Diagnostic redaction/evidence manifest and machine receipt, extending
   `pnpm verify` rather than adding `make`/`just`/lefthook.
5. Truthful telemetry/offline-CMap/removal-cache slices, independently.
6. Semgrep and dependency/SBOM/license controls after reproducible local tool
   provisioning is specified.
7. Workflow pinning/CI activation only in isolated `[pending] Pedro` PRs.
