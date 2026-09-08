# Corrected-gate cheap preflight — 08/09/2026 15:11 BRT (no native run)

Subject: the persisted-state gate block + receipt injection, extracted VERBATIM
from the captured post-quoting toolchain_exec argument
(packaged-regate-captured-toolchain-body.txt), executed against a copy of the
retained run DB (/tmp/lectrice-e2e-profile.dVRmUt) — never the native pipeline.

Positive: exit 0 on the seeded copy; receipt gains
`dropDb = { documentCount: 2, seededIdSet: "real+missing",
unexpectedDocumentIdCount: 0, sessions: 1, members: 1,
memberDocument: 0f3af5b3…(source hash), nonPdfDocumentRows: 0 }`.

Negative controls (each on a fresh copy, verbatim block):

- extra document row -> exit 1; receipt NOT enriched
- wrong membership -> exit 1
- non-PDF path row -> exit 1
- extra reading session -> exit 1, "expected one dropped-PDF session, got 2"

Native state: HALTED (no lock holder, no process); persistent target
src-tauri/target preserved. Candidate head for the ONE re-start when
authorized: 9f40361 (98eabdf B1 repair + a5ba847 parameter-bind + receipts).
