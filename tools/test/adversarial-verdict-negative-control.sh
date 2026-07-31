#!/usr/bin/env bash
set -Eeuo pipefail

parser=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/adversarial-verdict.sh
test_dir=$(mktemp -d)
cleanup() {
  rm -rf "$test_dir"
}
trap cleanup EXIT HUP INT TERM

printf 'BLOCK\nMAJOR example\n' >"$test_dir/block.txt"
if "$parser" "$test_dir/block.txt"; then
  echo "negative control failed: BLOCK exited zero" >&2
  exit 1
fi

printf 'PASS\nResidual uncertainty only\n' >"$test_dir/pass.txt"
"$parser" "$test_dir/pass.txt"

printf 'UNKNOWN\n' >"$test_dir/unknown.txt"
if "$parser" "$test_dir/unknown.txt"; then
  echo "negative control failed: unknown verdict exited zero" >&2
  exit 1
fi

echo "adversarial verdict negative control: PASS"
