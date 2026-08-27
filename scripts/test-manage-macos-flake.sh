#!/usr/bin/env bash
# Deterministic profile-generation/rollback tests; no Nix store or macOS needed.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd -P)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/tools"

cat >"$tmp/bin/uname" <<'EOF'
#!/usr/bin/env bash
printf 'Darwin\n'
EOF

cat >"$tmp/bin/nix" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[ "${1:-}" = profile ] || exit 2
action="${2:-}"
shift 2
profile=""
to=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile) profile="$2"; shift 2 ;;
    --to) to="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[ -n "$profile" ] || exit 2

make_generation() {
  number="$1"
  store="$FAKE_NIX_ROOT/store-$number"
  generation="$profile-$number-link"
  mkdir -p "$store/Applications/Lectrice.app"
  ln -sfn "$store" "$generation"
}

switch_generation() {
  number="$1"
  make_generation "$number"
  replacement="$profile.next.$$"
  ln -s "$(basename "$profile")-$number-link" "$replacement"
  rm -f "$profile"
  mv "$replacement" "$profile"
}

current_version() {
  readlink "$profile" | sed -n 's/.*-\([0-9][0-9]*\)-link$/\1/p'
}

case "$action" in
  install)
    switch_generation 1
    ;;
  upgrade)
    switch_generation "${FAKE_NEXT_VERSION:-2}"
    [ "${FAKE_NIX_MODE:-success}" != upgrade-fail-after-switch ] || exit 1
    ;;
  rollback)
    if [ -n "$to" ]; then
      [ "${FAKE_NIX_MODE:-success}" != restore-fail ] || exit 1
      switch_generation "$to"
    else
      [ "${FAKE_NIX_MODE:-success}" != rollback-command-fail ] || exit 1
      current="$(current_version)"
      [ "$current" -gt 1 ] || exit 1
      switch_generation "$((current - 1))"
    fi
    ;;
  list)
    printf '{"elements":{"lectrice":{"active":true}}}\n'
    ;;
  *) exit 2 ;;
esac
EOF

cat >"$tmp/tools/verify-macos-flake.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
output=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[ -L "$output" ] || exit 1
target="$(readlink "$output")"
case "$target" in
  *-"${FAKE_BAD_GENERATION:-none}"-link) exit 1 ;;
esac
[ -d "$output/Applications/Lectrice.app" ]
EOF
chmod +x "$tmp/bin/uname" "$tmp/bin/nix" "$tmp/tools/verify-macos-flake.sh"

export PATH="$tmp/bin:$PATH"
export FAKE_NIX_ROOT="$tmp"
export LECTRICE_PROFILE="$tmp/profiles/lectrice"
export LECTRICE_APP_LINK="$tmp/Applications/Lectrice.app"
export LECTRICE_STATE_DIR="$tmp/state"
export LECTRICE_CHANNEL="github:example/lectrice/main#lectrice"
export LECTRICE_VERIFY_SCRIPT="$tmp/tools/verify-macos-flake.sh"
manager="$root/scripts/manage-macos-flake.sh"
mkdir -p "$tmp/profiles"

profile_target() { readlink "$LECTRICE_PROFILE"; }
app_target() { readlink "$LECTRICE_APP_LINK"; }
receipt_status() { jq -r .status "$LECTRICE_STATE_DIR/update-receipt.json"; }
assert_eq() {
  [ "$1" = "$2" ] || {
    echo "assertion failed: '$1' != '$2'" >&2
    exit 1
  }
}
expect_failure() {
  if "$@"; then
    echo "expected failure: $*" >&2
    exit 1
  fi
}

# Install exposes only the verified immutable store generation.
FAKE_NIX_MODE=success FAKE_BAD_GENERATION=none "$manager" install >/dev/null
assert_eq "$(profile_target)" lectrice-1-link
assert_eq "$(app_target)" "$tmp/store-1/Applications/Lectrice.app"
assert_eq "$(receipt_status)" PASS
"$manager" status >/dev/null

# A post-build verification failure restores the exact previous profile and
# never moves the public app link off the known-good immutable generation.
expect_failure env FAKE_NIX_MODE=success FAKE_BAD_GENERATION=2 "$manager" update >/dev/null 2>&1
assert_eq "$(profile_target)" lectrice-1-link
assert_eq "$(app_target)" "$tmp/store-1/Applications/Lectrice.app"
assert_eq "$(receipt_status)" ROLLED_BACK

# Even a failing upgrade command that switched first is restored and recorded.
expect_failure env FAKE_NIX_MODE=upgrade-fail-after-switch FAKE_BAD_GENERATION=none "$manager" update >/dev/null 2>&1
assert_eq "$(profile_target)" lectrice-1-link
assert_eq "$(app_target)" "$tmp/store-1/Applications/Lectrice.app"
assert_eq "$(receipt_status)" FAILED

# Establish generation 2, then prove a bad rollback target is restored to the
# captured generation rather than rolling farther back.
FAKE_NIX_MODE=success FAKE_BAD_GENERATION=none "$manager" update >/dev/null
assert_eq "$(profile_target)" lectrice-2-link
assert_eq "$(app_target)" "$tmp/store-2/Applications/Lectrice.app"
expect_failure env FAKE_NIX_MODE=success FAKE_BAD_GENERATION=1 "$manager" rollback >/dev/null 2>&1
assert_eq "$(profile_target)" lectrice-2-link
assert_eq "$(app_target)" "$tmp/store-2/Applications/Lectrice.app"
assert_eq "$(receipt_status)" ROLLED_BACK

# If restoration itself fails, the receipt is honest and the public link still
# remains pinned to the last verified store path rather than the bad profile.
expect_failure env FAKE_NIX_MODE=restore-fail FAKE_BAD_GENERATION=1 "$manager" rollback >/dev/null 2>&1
assert_eq "$(profile_target)" lectrice-1-link
assert_eq "$(app_target)" "$tmp/store-2/Applications/Lectrice.app"
assert_eq "$(receipt_status)" ROLLBACK_FAILED

printf 'manage-macos-flake: 5/5 PASS\n'
