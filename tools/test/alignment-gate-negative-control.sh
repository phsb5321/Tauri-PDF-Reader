#!/usr/bin/env bash
# Negative-control test for the alignment gate — proves the gate CATCHES slop,
# not just that it PASSES on clean code (PR#595 parity: a self-pass can't
# distinguish a functioning detector from a no-op).
#
# Creates a throwaway git repo, drops a TODO + a skipped test + a lint-
# suppression into a .ts file, runs the gate, asserts non-zero exit.
set -euo pipefail
GATE="$(dirname "$0")/../alignment-gate.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
git init -q
git config user.email t@t
git config user.name t
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
if "$GATE" --base main 2>&1; then
  echo "FAIL: gate exited 0 on a slop diff (must be non-zero)" >&2
  exit 1
else
  echo "PASS: gate correctly rejected the slop diff (exit $?)"
fi
