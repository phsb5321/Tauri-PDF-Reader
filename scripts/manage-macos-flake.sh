#!/usr/bin/env bash
# Atomic install/update/rollback for Lectrice's dedicated macOS Nix profile.
set -euo pipefail

profile="${LECTRICE_PROFILE:-$HOME/.local/state/nix/profiles/lectrice}"
app_link="${LECTRICE_APP_LINK:-$HOME/Applications/Lectrice.app}"
channel="${LECTRICE_CHANNEL:-github:phsb5321/Tauri-PDF-Reader/macos-green#lectrice}"
state_dir="${LECTRICE_STATE_DIR:-$HOME/.local/state/lectrice}"
receipt="$state_dir/update-receipt.json"
script_dir="$(cd -- "$(dirname -- "$0")" >/dev/null && pwd -P)"
verifier="${LECTRICE_VERIFY_SCRIPT:-$script_dir/verify-macos-flake.sh}"
command="${1:-}"

usage() {
  cat >&2 <<'EOF'
usage: manage-macos-flake.sh install|update|status|rollback

Environment overrides:
  LECTRICE_PROFILE       dedicated profile path
  LECTRICE_APP_LINK      stable user Applications path
  LECTRICE_CHANNEL       unlocked flake URI used for first install
  LECTRICE_STATE_DIR     receipt/lock directory
  LECTRICE_VERIFY_SCRIPT verifier path
EOF
  exit 2
}

case "$command" in install|update|status|rollback) ;; *) usage ;; esac
[ "$(uname -s)" = Darwin ] || { echo "BLOCKED: Lectrice profile management requires Darwin" >&2; exit 1; }
for dependency in nix jq; do
  command -v "$dependency" >/dev/null || {
    echo "BLOCKED: required command is unavailable: $dependency" >&2
    exit 1
  }
done
[ -x "$verifier" ] || { echo "BLOCKED: verifier is unavailable: $verifier" >&2; exit 1; }

profile_target() {
  if [ -L "$profile" ]; then
    readlink "$profile"
  else
    printf absent
  fi
}

profile_version() {
  printf '%s\n' "$1" | sed -n 's/.*-\([0-9][0-9]*\)-link$/\1/p'
}

immutable_app_path() {
  [ -d "$profile/Applications/Lectrice.app" ] || return 1
  applications="$(cd "$profile/Applications" && pwd -P)"
  printf '%s/Lectrice.app\n' "$applications"
}

restore_profile() {
  wanted="$1"
  [ "$(profile_target)" = "$wanted" ] && return 0
  version="$(profile_version "$wanted")"
  [ -n "$version" ] || return 1
  nix profile rollback --profile "$profile" --to "$version" || return 1
  [ "$(profile_target)" = "$wanted" ]
}

write_receipt() {
  action="$1"
  before="$2"
  after="$3"
  status="$4"
  mkdir -p "$state_dir"
  tmp="$receipt.tmp.$$"
  jq -n \
    --arg status "$status" \
    --arg action "$action" \
    --arg channel "$channel" \
    --arg profile "$profile" \
    --arg beforeGeneration "$before" \
    --arg afterGeneration "$after" \
    --arg appLink "$app_link" \
    --arg appTarget "$(readlink "$app_link" 2>/dev/null || printf absent)" \
    --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{status:$status, action:$action, channel:$channel, profile:$profile,
      beforeGeneration:$beforeGeneration, afterGeneration:$afterGeneration,
      appLink:$appLink, appTarget:$appTarget, time:$time}' >"$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$receipt"
}

verify_profile() {
  "$verifier" --output "$profile" >/dev/null
}

link_verified_profile() {
  # Pin the public app link to the immutable, already-verified generation.
  # Pointing it at the mutable profile would expose a candidate during the
  # interval between `nix profile upgrade` and post-build verification.
  expected="$(immutable_app_path)"
  mkdir -p "$(dirname "$app_link")"
  if [ -L "$app_link" ]; then
    rm "$app_link"
  elif [ -e "$app_link" ]; then
    backup="$app_link.manual-$(date +%Y%m%d-%H%M%S)"
    mv "$app_link" "$backup"
    echo "Retained the previous manual app at $backup"
  fi
  ln -s "$expected" "$app_link"
}

if [ "$command" = status ]; then
  target="$(profile_target)"
  link_target="$(readlink "$app_link" 2>/dev/null || printf absent)"
  expected_target="$(immutable_app_path 2>/dev/null || printf absent)"
  valid=false
  if [ "$target" != absent ] && [ "$link_target" = "$expected_target" ] && verify_profile; then valid=true; fi
  jq -n \
    --arg profile "$profile" \
    --arg generation "$target" \
    --arg appLink "$app_link" \
    --arg appTarget "$link_target" \
    --arg expectedAppTarget "$expected_target" \
    --argjson valid "$valid" \
    --argjson elements "$(nix profile list --profile "$profile" --json 2>/dev/null || printf '{"elements":{}}')" \
    '{profile:$profile, generation:$generation, appLink:$appLink,
      appTarget:$appTarget, expectedAppTarget:$expectedAppTarget,
      valid:$valid, elements:$elements.elements}'
  [ "$valid" = true ]
  exit
fi

mkdir -p "$state_dir" "$(dirname "$profile")"
lock="$state_dir/update.lock"
if ! mkdir "$lock" 2>/dev/null; then
  echo "BLOCKED: another Lectrice profile operation holds $lock" >&2
  exit 1
fi
trap 'rmdir "$lock" 2>/dev/null || true' EXIT

before="$(profile_target)"
case "$command" in
  install)
    if [ "$before" = absent ]; then
      if ! nix profile install --profile "$profile" "$channel"; then
        write_receipt "$command" "$before" "$(profile_target)" FAILED
        exit 1
      fi
    else
      echo "Lectrice profile already exists; validating it without replacement."
    fi
    ;;
  update)
    [ "$before" != absent ] || { echo "FAIL: install the Lectrice profile before updating" >&2; exit 1; }
    if ! nix profile upgrade --profile "$profile" lectrice; then
      status=FAILED
      restore_profile "$before" || status=ROLLBACK_FAILED
      restored="$(profile_target)"
      write_receipt "$command" "$before" "$restored" "$status"
      [ "$status" = FAILED ] || echo "FAIL: update failure did not restore $before" >&2
      exit 1
    fi
    ;;
  rollback)
    [ "$before" != absent ] || { echo "FAIL: no Lectrice profile to roll back" >&2; exit 1; }
    if ! nix profile rollback --profile "$profile"; then
      write_receipt "$command" "$before" "$(profile_target)" FAILED
      exit 1
    fi
    ;;
esac

after="$(profile_target)"
if ! verify_profile; then
  echo "FAIL: candidate profile did not pass bundle verification" >&2
  status=FAILED
  if [ "$before" != absent ] && [ "$after" != "$before" ]; then
    status=ROLLED_BACK
    restore_profile "$before" || status=ROLLBACK_FAILED
  fi
  restored="$(profile_target)"
  write_receipt "$command" "$before" "$restored" "$status"
  [ "$status" != ROLLBACK_FAILED ] || echo "FAIL: automatic rollback did not restore $before" >&2
  exit 1
fi

link_verified_profile
write_receipt "$command" "$before" "$after" PASS
cat "$receipt"
