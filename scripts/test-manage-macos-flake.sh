#!/usr/bin/env bash
# Deterministic channel/profile/rollback tests; no Nix store or macOS needed.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd -P)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/tools"

cat >"$tmp/bin/uname" <<'EOF'
#!/usr/bin/env bash
printf 'Darwin\n'
EOF

cat >"$tmp/bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[ "${FAKE_API_FAIL:-0}" = 0 ] || exit 22
sha="${FAKE_API_SHA:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
printf '{"workflow_runs":[{"head_branch":"main","event":"push","conclusion":"success","head_repository":{"full_name":"phsb5321/Tauri-PDF-Reader"},"head_sha":"%s"}]}\n' "$sha"
EOF

cat >"$tmp/bin/nix" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[ "${1:-}" = profile ] || exit 2
action="${2:-}"
shift 2
profile=""
to=""
installable=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile) profile="$2"; shift 2 ;;
    --to) to="$2"; shift 2 ;;
    *) installable="$1"; shift ;;
  esac
done
[ -n "$profile" ] || exit 2

switch_link() {
  number="$1"
  replacement="$profile.next.$$"
  ln -s "$(basename "$profile")-$number-link" "$replacement"
  rm -f "$profile"
  mv "$replacement" "$profile"
}

current_version() {
  readlink "$profile" | sed -n 's/.*-\([0-9][0-9]*\)-link$/\1/p'
}

case "$action" in
  add)
    [ "${FAKE_CANDIDATE_BUILD_FAIL:-0}" = 0 ] || exit 1
    source="${installable%%#*}"
    identity="$(printf '%s' "$source" | sed 's/[^A-Za-z0-9]/_/g')"
    store="$FAKE_NIX_ROOT/store-$identity"
    mkdir -p "$store/Applications/Lectrice.app"
    printf '%s\n' "$source" >"$store/channel"
    case "$source" in *bad*) touch "$store/bad" ;; esac
    ln -sfn "$store" "$profile-1-link"
    switch_link 1
    ;;
  list)
    store="$(cd "$profile" && pwd -P)"
    source="$(cat "$store/channel")"
    jq -n --arg source "$source" '{elements:{lectrice:{active:true,attrPath:"packages.aarch64-darwin.lectrice",originalUrl:$source}}}'
    ;;
  rollback)
    if [ -n "$to" ]; then
      [ "${FAKE_NIX_MODE:-success}" != restore-fail ] || exit 1
      [ -L "$profile-$to-link" ] || exit 1
      switch_link "$to"
    else
      [ "${FAKE_NIX_MODE:-success}" != rollback-command-fail ] || exit 1
      current="$(current_version)"
      [ "$current" -gt 1 ] || exit 1
      switch_link "$((current - 1))"
    fi
    ;;
  *) exit 2 ;;
esac
EOF

cat >"$tmp/bin/nix-env" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
profile=""
candidate=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile) profile="$2"; shift 2 ;;
    --set) candidate="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[ -n "$profile" ] && [ -L "$candidate" ] || exit 2
[ "${FAKE_SET_FAIL:-0}" = 0 ] || exit 1
candidate_generation="$(dirname "$candidate")/$(readlink "$candidate")"
store="$(readlink "$candidate_generation")"
if [ -L "$profile" ]; then
  current="$(readlink "$profile" | sed -n 's/.*-\([0-9][0-9]*\)-link$/\1/p')"
  next="$((current + 1))"
else
  next=1
fi
ln -s "$store" "$profile-$next-link"
replacement="$profile.next.$$"
ln -s "$(basename "$profile")-$next-link" "$replacement"
rm -f "$profile"
mv "$replacement" "$profile"
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
store="$(cd "$output" && pwd -P)"
[ -d "$store/Applications/Lectrice.app" ] || exit 1
[ ! -e "$store/bad" ] || exit 1
if [ "$output" = "${LECTRICE_PROFILE:-}" ] && [ -n "${FAKE_BAD_MAIN_GENERATION:-}" ]; then
  target="$(readlink "$output")"
  case "$target" in *-"$FAKE_BAD_MAIN_GENERATION"-link) exit 1 ;; esac
fi
EOF
chmod +x "$tmp/bin/"* "$tmp/tools/verify-macos-flake.sh"

export PATH="$tmp/bin:$PATH"
export FAKE_NIX_ROOT="$tmp"
export LECTRICE_PROFILE="$tmp/profiles/lectrice"
export LECTRICE_APP_LINK="$tmp/Applications/Lectrice.app"
export LECTRICE_STATE_DIR="$tmp/state"
export LECTRICE_VERIFY_SCRIPT="$tmp/tools/verify-macos-flake.sh"
manager="$root/scripts/manage-macos-flake.sh"
mkdir -p "$tmp/profiles"

profile_target() { readlink "$LECTRICE_PROFILE"; }
app_target() { readlink "$LECTRICE_APP_LINK"; }
receipt_status() { jq -r .status "$LECTRICE_STATE_DIR/update-receipt.json"; }
receipt_channel() { jq -r .channel "$LECTRICE_STATE_DIR/update-receipt.json"; }
assert_eq() {
  [ "$1" = "$2" ] || { echo "assertion failed: '$1' != '$2'" >&2; exit 1; }
}
expect_failure() {
  if "$@"; then echo "expected failure: $*" >&2; exit 1; fi
}

# Install exposes the pre-verified candidate as one immutable generation.
channel1="github:example/lectrice/1111111111111111111111111111111111111111#lectrice"
LECTRICE_CHANNEL="$channel1" "$manager" install >/dev/null
assert_eq "$(profile_target)" lectrice-1-link
store1="$tmp/store-github_example_lectrice_1111111111111111111111111111111111111111"
assert_eq "$(app_target)" "$store1/Applications/Lectrice.app"
assert_eq "$(receipt_status)" PASS
assert_eq "$(receipt_channel)" "$channel1"
"$manager" status >/dev/null

# A malformed candidate fails before the active profile or app link changes.
bad="github:example/lectrice/bad#lectrice"
expect_failure env LECTRICE_CHANNEL="$bad" "$manager" update >/dev/null 2>&1
assert_eq "$(profile_target)" lectrice-1-link
assert_eq "$(app_target)" "$store1/Applications/Lectrice.app"
assert_eq "$(receipt_status)" FAILED

# A valid candidate creates exactly one new active generation.
channel2="github:example/lectrice/2222222222222222222222222222222222222222#lectrice"
LECTRICE_CHANNEL="$channel2" "$manager" update >/dev/null
assert_eq "$(profile_target)" lectrice-2-link
store2="$tmp/store-github_example_lectrice_2222222222222222222222222222222222222222"
assert_eq "$(app_target)" "$store2/Applications/Lectrice.app"
assert_eq "$(receipt_status)" PASS

# A bad rollback target is rejected and the exact captured generation restored.
expect_failure env FAKE_BAD_MAIN_GENERATION=1 "$manager" rollback >/dev/null 2>&1
assert_eq "$(profile_target)" lectrice-2-link
assert_eq "$(app_target)" "$store2/Applications/Lectrice.app"
assert_eq "$(receipt_status)" ROLLED_BACK

# Restoration failure is honest; public launch remains pinned to the last good store.
expect_failure env FAKE_BAD_MAIN_GENERATION=1 FAKE_NIX_MODE=restore-fail "$manager" rollback >/dev/null 2>&1
assert_eq "$(profile_target)" lectrice-1-link
assert_eq "$(app_target)" "$store2/Applications/Lectrice.app"
assert_eq "$(receipt_status)" ROLLBACK_FAILED
# Restore test state explicitly for the API channel case.
FAKE_BAD_MAIN_GENERATION=none nix profile rollback --profile "$LECTRICE_PROFILE" --to 2

# No override resolves the latest successful exact SHA from the public workflow API.
api_sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
FAKE_API_SHA="$api_sha" "$manager" update >/dev/null
assert_eq "$(profile_target)" lectrice-3-link
assert_eq "$(receipt_channel)" "github:phsb5321/Tauri-PDF-Reader/$api_sha#lectrice"

# API failure is fail-closed and leaves the verified profile/link untouched.
before_profile="$(profile_target)"
before_app="$(app_target)"
expect_failure env FAKE_API_FAIL=1 "$manager" update >/dev/null 2>&1
assert_eq "$(profile_target)" "$before_profile"
assert_eq "$(app_target)" "$before_app"
assert_eq "$(receipt_status)" FAILED

# A contender must not remove the incumbent operation's lock on exit.
mkdir "$LECTRICE_STATE_DIR/update.lock"
expect_failure "$manager" update >/dev/null 2>&1
[ -d "$LECTRICE_STATE_DIR/update.lock" ] || {
  echo "contender removed the incumbent update lock" >&2
  exit 1
}
rmdir "$LECTRICE_STATE_DIR/update.lock"

printf 'manage-macos-flake: 8/8 PASS\n'
