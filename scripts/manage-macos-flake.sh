#!/usr/bin/env bash
# Atomic install/update/rollback for Lectrice's dedicated macOS Nix profile.
set -euo pipefail

profile="${LECTRICE_PROFILE:-$HOME/.local/state/nix/profiles/lectrice}"
app_link="${LECTRICE_APP_LINK:-$HOME/Applications/Lectrice.app}"
channel_override="${LECTRICE_CHANNEL:-}"
repository="${LECTRICE_REPOSITORY:-phsb5321/Tauri-PDF-Reader}"
workflow="${LECTRICE_WORKFLOW:-macos-flake.yml}"
state_dir="${LECTRICE_STATE_DIR:-$HOME/.local/state/lectrice}"
receipt="$state_dir/update-receipt.json"
script_dir="$(cd -- "$(dirname -- "$0")" >/dev/null && pwd -P)"
verifier="${LECTRICE_VERIFY_SCRIPT:-$script_dir/verify-macos-flake.sh}"
action="${1:-}"
resolved_channel=""
candidate_profile=""
lock=""

usage() {
  cat >&2 <<'EOF'
usage: manage-macos-flake.sh install|update|status|rollback

Environment overrides:
  LECTRICE_PROFILE       dedicated profile path
  LECTRICE_APP_LINK      stable user Applications path
  LECTRICE_CHANNEL       exact installable (test/manual override)
  LECTRICE_REPOSITORY    public GitHub owner/repository
  LECTRICE_WORKFLOW      verification workflow filename
  LECTRICE_STATE_DIR     receipt/lock directory
  LECTRICE_VERIFY_SCRIPT verifier path
EOF
  exit 2
}

case "$action" in install|update|status|rollback) ;; *) usage ;; esac
[ "$(uname -s)" = Darwin ] || { echo "BLOCKED: Lectrice profile management requires Darwin" >&2; exit 1; }
for dependency in nix nix-env jq; do
  command -v "$dependency" >/dev/null || {
    echo "BLOCKED: required command is unavailable: $dependency" >&2
    exit 1
  }
done
[ -x "$verifier" ] || { echo "BLOCKED: verifier is unavailable: $verifier" >&2; exit 1; }

profile_target() {
  if [ -L "$profile" ]; then readlink "$profile"; else printf absent; fi
}

profile_version() {
  printf '%s\n' "$1" | sed -n 's/.*-\([0-9][0-9]*\)-link$/\1/p'
}

immutable_app_path() {
  [ -d "$profile/Applications/Lectrice.app" ] || return 1
  local applications
  applications="$(cd "$profile/Applications" && pwd -P)"
  printf '%s/Lectrice.app\n' "$applications"
}

current_channel() {
  nix profile list --profile "$profile" --json 2>/dev/null | jq -er '
    [.elements | to_entries[]
      | select((.value.attrPath // "") | endswith(".lectrice"))]
    | if length == 1
      then .[0].value.originalUrl + "#lectrice"
      else error("expected exactly one Lectrice profile element")
      end'
}

resolve_channel() {
  if [ -n "$channel_override" ]; then
    printf '%s\n' "$channel_override"
    return
  fi
  command -v curl >/dev/null || {
    echo "BLOCKED: curl is required to resolve the latest successful Mac build" >&2
    return 1
  }
  local api payload sha
  api="https://api.github.com/repos/$repository/actions/workflows/$workflow/runs?branch=main&event=push&status=success&per_page=1"
  payload="$(curl --fail --silent --show-error --location \
    --retry 2 --connect-timeout 10 --max-time 30 "$api")" || return 1
  sha="$(jq -er --arg repository "$repository" '
    .workflow_runs[0]
    | select(.head_branch == "main")
    | select(.event == "push" and .conclusion == "success")
    | select(.head_repository.full_name == $repository)
    | .head_sha' <<<"$payload")" || return 1
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || {
    echo "FAIL: workflow API returned an invalid source revision" >&2
    return 1
  }
  printf 'github:%s/%s#lectrice\n' "$repository" "$sha"
}

restore_profile() {
  local wanted version
  wanted="$1"
  [ "$(profile_target)" = "$wanted" ] && return 0
  version="$(profile_version "$wanted")"
  [ -n "$version" ] || return 1
  nix profile rollback --profile "$profile" --to "$version" || return 1
  [ "$(profile_target)" = "$wanted" ]
}

write_receipt() {
  local before after status channel tmp
  before="$1"
  after="$2"
  status="$3"
  channel="${resolved_channel:-$(current_channel 2>/dev/null || printf unresolved)}"
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

verify_output() {
  "$verifier" --output "$1" >/dev/null
}

link_verified_profile() {
  # Pin the public link to the immutable, already-verified generation. The
  # mutable profile may switch only after candidate verification, but it still
  # is not a public launch target until this function runs.
  local expected backup
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

cleanup() {
  if [ -n "$candidate_profile" ]; then
    rm -f "$candidate_profile" "$candidate_profile"-*-link
  fi
  [ -z "$lock" ] || rmdir "$lock" 2>/dev/null || true
}
trap cleanup EXIT

if [ "$action" = status ]; then
  target="$(profile_target)"
  link_target="$(readlink "$app_link" 2>/dev/null || printf absent)"
  expected_target="$(immutable_app_path 2>/dev/null || printf absent)"
  valid=false
  if [ "$target" != absent ] && [ "$link_target" = "$expected_target" ] && verify_output "$profile"; then valid=true; fi
  jq -n \
    --arg profile "$profile" \
    --arg generation "$target" \
    --arg channel "$(current_channel 2>/dev/null || printf unresolved)" \
    --arg appLink "$app_link" \
    --arg appTarget "$link_target" \
    --arg expectedAppTarget "$expected_target" \
    --argjson valid "$valid" \
    '{profile:$profile, generation:$generation, channel:$channel,
      appLink:$appLink, appTarget:$appTarget,
      expectedAppTarget:$expectedAppTarget, valid:$valid}'
  [ "$valid" = true ]
  exit
fi

mkdir -p "$state_dir" "$(dirname "$profile")"
lock="$state_dir/update.lock"
if ! mkdir "$lock" 2>/dev/null; then
  echo "BLOCKED: another Lectrice profile operation holds $lock" >&2
  exit 1
fi

before="$(profile_target)"
if [ "$action" = rollback ]; then
  [ "$before" != absent ] || { echo "FAIL: no Lectrice profile to roll back" >&2; exit 1; }
  if ! nix profile rollback --profile "$profile"; then
    write_receipt "$before" "$(profile_target)" FAILED
    exit 1
  fi
  after="$(profile_target)"
  if ! verify_output "$profile"; then
    status=ROLLED_BACK
    restore_profile "$before" || status=ROLLBACK_FAILED
    write_receipt "$before" "$(profile_target)" "$status"
    [ "$status" != ROLLBACK_FAILED ] || echo "FAIL: could not restore $before" >&2
    exit 1
  fi
  link_verified_profile
  write_receipt "$before" "$after" PASS
  cat "$receipt"
  exit
fi

if [ "$action" = install ] && [ "$before" != absent ]; then
  echo "Lectrice profile already exists; validating it without replacement."
  verify_output "$profile"
  link_verified_profile
  write_receipt "$before" "$before" PASS
  cat "$receipt"
  exit
fi
[ "$action" != update ] || [ "$before" != absent ] || {
  echo "FAIL: install the Lectrice profile before updating" >&2
  exit 1
}

resolved_channel="$(resolve_channel)" || {
  echo "FAIL: no successful Mac build could be resolved" >&2
  write_receipt "$before" "$(profile_target)" FAILED
  exit 1
}
if [ "$before" != absent ] && [ "$(current_channel)" = "$resolved_channel" ]; then
  verify_output "$profile"
  link_verified_profile
  write_receipt "$before" "$before" PASS
  cat "$receipt"
  exit
fi

# Build and verify in an isolated profile. The active profile and public app
# link stay on the last good generation throughout this potentially slow step.
candidate_profile="$state_dir/candidate-profile.$$"
if ! nix profile add --profile "$candidate_profile" --no-update-lock-file "$resolved_channel"; then
  write_receipt "$before" "$(profile_target)" FAILED
  exit 1
fi
if ! verify_output "$candidate_profile"; then
  echo "FAIL: candidate profile did not pass bundle verification" >&2
  write_receipt "$before" "$(profile_target)" FAILED
  exit 1
fi

# nix-env --set turns the already-verified candidate environment into exactly
# one new generation; unlike remove+add, it creates no empty interim generation.
if ! nix-env --profile "$profile" --set "$candidate_profile"; then
  write_receipt "$before" "$(profile_target)" FAILED
  exit 1
fi
after="$(profile_target)"
if ! verify_output "$profile"; then
  status=FAILED
  if [ "$before" != absent ]; then
    status=ROLLED_BACK
    restore_profile "$before" || status=ROLLBACK_FAILED
  else
    rm -f "$profile"
  fi
  write_receipt "$before" "$(profile_target)" "$status"
  [ "$status" != ROLLBACK_FAILED ] || echo "FAIL: could not restore $before" >&2
  exit 1
fi

link_verified_profile
write_receipt "$before" "$after" PASS
cat "$receipt"
