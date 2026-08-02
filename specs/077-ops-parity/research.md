# Research 077 — operational-parity intake

## Inputs read

- DeliCasa live governance, quality, security, vault-export, scanner,
  blackboard, workflow and adversarial-review references required by the
  protocol dated 02/08/2026.
- PiDashboard handoff schema, flake tooling policy, performance budgets and
  security audit; NextClient secrets matrix, CodeQL gate and redaction/evidence
  rules; PiOrchestrator threat model and current severity-joined CodeQL audit.
- Lectrice current `AGENTS.md`, `CLAUDE.md`, constitution, Spec 008, package and
  verification scripts, workflows, Tauri CSP/capabilities, IPC bindings/ratchet,
  file guards, stores, settings UI, local Notes references and owner ledger.
- Product audit SHA-256
  `ea893ff18b362e4b68ebb0d08db880b72c384afb7cc0b96a0a4ad850811b5073`.
- Quality audit SHA-256
  `2f02c3b4740e439a6550272eb0bb3b7bc42d95fc8c93c349aa7627aaf0c23dc0`.
- Engineer audit SHA-256
  `165e9166fa16c013e4b8be91ae6c5cdaf1f6e9483de1eb4b5527d27563aa8a68`.

## Decisions

### D1 — fix the live exposure before adding a scanner

Product found a concrete S4 exposure: `apiKey` is serialized in WebView
storage. A scanner would prevent a repository leak but would not remove this
runtime plaintext copy. The first slice therefore fixes current and legacy
state persistence and makes PDF-text egress explicit. Gitleaks is next.

### D2 — migrate legacy storage, do not only change `partialize`

Zustand's persisted payload can rehydrate fields written by older versions.
Deleting `apiKey` from future partialization alone leaves a one-upgrade window
where the old key reaches state and `useAiTts` auto-initializes. The store must
version/migrate legacy data before application effects observe it. A legacy
canary is the discriminating test.

### D3 — Connect is the explicit boundary

Do not invent a consent backend or policy service. The existing form can make
Connect the explicit boundary if it visibly and programmatically associates a
provider-specific disclosure with the key field/form, names the later
PDF-derived text transfer, and leaves close/cancel at zero requests. This is
the smallest truthful UI contract; provider policy terms remain linked rather
than copied as potentially stale assertions.

### D4 — reuse Lectrice's spine

The repository already has `pnpm verify`, SpecKit, Vitest/Testing Library,
Husky, Specta IPC contracts and path guards. No `just`, Make, lefthook, second
gate command, alternate store or new dependency is justified. Future local
gate/receipt work extends `pnpm verify` after Quality owns scanner policy.

### D5 — private Notes export stays dormant

There is no approved public or second knowledge consumer. A new generated Docs
repo/sink creates privacy, token and conflict failure modes without value.
Keep private Notes authoritative; design a default-deny manifest/dry-run only
when an audience exists. Workflow and sync activation remain Pedro-gated.

### D6 — Product seed repair mechanizes every secret sink and restart boundary

Product review of seed `e1e1b068` found that legacy migration alone could
false-green current-session behavior. The executable contract now records
settings/SQLite persistence calls, asserts password-masked default and
accessible show/hide state, constructs a fresh production store after setting
a key, requires re-entry with zero auto-initialization, and drives rapid
duplicate submit. Packet:
`/tmp/lectrice-077-product-seed-review-e1e1b068.md`.

## Rejected alternatives

- OS secret store now: new native dependency/backend lifecycle and recovery
  semantics; unnecessary for the stated session-only outcome.
- Gitleaks as the first slice: useful next control, but does not remediate the
  proven runtime exposure.
- Tighten CSP/capabilities in 077: needs call-site and packaged-app proof and is
  independently reversible; do not mix it with credential containment.
- Copy DeliCasa `gitleaks protect --no-git`: invalid on installed Gitleaks
  8.30.1; current public interfaces are `gitleaks dir` and `gitleaks git`.
- Activate Notes/workflow sync: explicitly Pedro-gated and YAGNI.
