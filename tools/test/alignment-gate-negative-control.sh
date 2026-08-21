#!/usr/bin/env bash
# Negative-control test for the alignment gate — proves the gate CATCHES slop,
# not just that it PASSES on clean code (PR#595 parity: a self-pass can't
# distinguish a functioning detector from a no-op).
#
# Creates a throwaway git repo, drops a TODO + a skipped test + a lint-
# suppression into a .ts file, runs the gate, asserts non-zero exit.
set -euo pipefail
GATE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/alignment-gate.sh"
WORK="$(mktemp -d)"
OUTPUT="$WORK/output"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
git init -q
git config user.email t@t
git config user.name t
git config core.hooksPath /dev/null
git checkout -q -b main
echo "export const x = 1;" > a.ts
git add . && git commit -qm base
git checkout -q -b feature
cat > a.ts <<'TS'
export const x = 1;
// TODO: implement this later
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const y: any = null;
it.skip("skipped test", () => {});
TS
git add . && git commit -qm slop

echo "running alignment-gate against a deliberate slop commit..."
set +e
"$GATE" --base main >"$OUTPUT" 2>&1
rc=$?
set -e
if [ "$rc" -ne 1 ]; then
  cat "$OUTPUT" >&2
  echo "FAIL: expected semantic refusal exit 1, got $rc" >&2
  exit 1
fi
grep -q 'incomplete/todo' "$OUTPUT"
grep -q 'align/lint-suppressed' "$OUTPUT"
echo "PASS: gate correctly rejected the slop diff with real findings (exit 1)"
