#!/usr/bin/env bash
# Verify the immutable macOS bundle, optionally including a real public launch.
set -euo pipefail

installable=".#lectrice"
output=""
expected_version=""
receipt=""
launch=0
launched_pid=""

usage() {
  cat >&2 <<'EOF'
usage: scripts/verify-macos-flake.sh [--installable URI#attr | --output PATH]
       [--expected-version VERSION] [--receipt PATH] [--launch]
EOF
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --installable) installable="${2:?--installable needs a value}"; shift 2 ;;
    --output) output="${2:?--output needs a value}"; shift 2 ;;
    --expected-version) expected_version="${2:?--expected-version needs a value}"; shift 2 ;;
    --receipt) receipt="${2:?--receipt needs a value}"; shift 2 ;;
    --launch) launch=1; shift ;;
    *) usage ;;
  esac
done

[ "$(uname -s)" = Darwin ] || {
  echo "BLOCKED: macOS bundle verification requires Darwin" >&2
  exit 1
}
for command in nix jq plutil file codesign shasum; do
  command -v "$command" >/dev/null || {
    echo "BLOCKED: required command is unavailable: $command" >&2
    exit 1
  }
done

if [ -z "$output" ]; then
  # Only a source build may infer its expected version from the current tree.
  # An explicit --output can be an older rollback generation and must not be
  # compared with an unrelated caller CWD.
  if [ -z "$expected_version" ] && [ -f package.json ]; then
    expected_version="$(jq -er '.version' package.json)"
  fi
  build_outputs="$(nix build "$installable" --no-update-lock-file --no-link --print-out-paths --cores 1)"
  output_count="$(printf '%s\n' "$build_outputs" | grep -c . || true)"
  [ "$output_count" -eq 1 ] || {
    echo "FAIL: expected one Nix output, got $output_count" >&2
    exit 1
  }
  output="$build_outputs"
fi
[ -d "$output/Applications" ] || {
  echo "FAIL: package has no Applications directory: $output" >&2
  exit 1
}

shopt -s nullglob
apps=("$output"/Applications/*.app)
shopt -u nullglob
[ "${#apps[@]}" -eq 1 ] || {
  echo "FAIL: expected exactly one app bundle, got ${#apps[@]}" >&2
  exit 1
}
app="${apps[0]}"
[ "$(basename "$app")" = Lectrice.app ] || {
  echo "FAIL: unexpected app bundle: $app" >&2
  exit 1
}

plist="$app/Contents/Info.plist"
[ -f "$plist" ] || { echo "FAIL: missing Info.plist" >&2; exit 1; }
bundle_id="$(plutil -extract CFBundleIdentifier raw "$plist")"
version="$(plutil -extract CFBundleShortVersionString raw "$plist")"
executable_name="$(plutil -extract CFBundleExecutable raw "$plist")"
executable="$app/Contents/MacOS/$executable_name"

[ "$bundle_id" = com.lectrice.reader ] || {
  echo "FAIL: bundle identifier is $bundle_id" >&2
  exit 1
}
if [ -n "$expected_version" ] && [ "$version" != "$expected_version" ]; then
  echo "FAIL: bundle version $version != expected $expected_version" >&2
  exit 1
fi
[ -x "$executable" ] || { echo "FAIL: missing executable: $executable" >&2; exit 1; }
architecture="$(file -b "$executable")"
case "$architecture" in
  *Mach-O*arm64*) ;;
  *) echo "FAIL: executable is not arm64 Mach-O: $architecture" >&2; exit 1 ;;
esac

codesign --verify --deep --strict "$app"
signature="$(codesign -dv --verbose=4 "$app" 2>&1)"
grep -q 'Signature=adhoc' <<<"$signature" || {
  echo "FAIL: expected an explicit ad-hoc personal-channel signature" >&2
  exit 1
}
app_sha256="$(shasum -a 256 "$executable" | awk '{print $1}')"
source_revision="${SOURCE_REVISION:-$(git rev-parse HEAD 2>/dev/null || printf unknown)}"
window_json='{"count":0,"width":0,"height":0}'

cleanup() {
  if [ -n "$launched_pid" ] && kill -0 "$launched_pid" 2>/dev/null; then
    kill "$launched_pid" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      kill -0 "$launched_pid" 2>/dev/null || return 0
      sleep 1
    done
    kill -KILL "$launched_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [ "$launch" -eq 1 ]; then
  for command in open pgrep swift; do
    command -v "$command" >/dev/null || {
      echo "BLOCKED: live launch requires $command" >&2
      exit 1
    }
  done

  # `open -n` is the real user launch path. Match the exact immutable bundle
  # executable, so a stale hand-copied Lectrice process cannot satisfy it.
  open -n "$app"
  escaped_executable="$(printf '%s' "$executable" | sed 's/[][\\.^$*+?{}|()]/\\&/g')"
  for _ in {1..20}; do
    pids="$(pgrep -f "^${escaped_executable}$" || true)"
    pid_count="$(printf '%s\n' "$pids" | grep -c . || true)"
    if [ "$pid_count" -eq 1 ]; then
      launched_pid="$pids"
      break
    fi
    [ "$pid_count" -le 1 ] || {
      echo "FAIL: launch created $pid_count exact-bundle processes" >&2
      exit 1
    }
    sleep 1
  done
  [ -n "$launched_pid" ] || {
    echo "FAIL: exact Nix bundle did not stay running" >&2
    exit 1
  }

  swift_probe="$(mktemp "${TMPDIR:-/tmp}/lectrice-window.XXXXXX")"
  cat >"$swift_probe" <<'SWIFT'
import CoreGraphics
import Foundation

let pid = Int32(CommandLine.arguments[1])!
let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
let rows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []
var count = 0
var maxWidth = 0.0
var maxHeight = 0.0
for row in rows {
    guard (row[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == pid else { continue }
    guard (row[kCGWindowLayer as String] as? NSNumber)?.intValue == 0 else { continue }
    guard let bounds = row[kCGWindowBounds as String] as? NSDictionary,
          let rect = CGRect(dictionaryRepresentation: bounds) else { continue }
    if rect.width >= 100 && rect.height >= 100 {
        count += 1
        maxWidth = max(maxWidth, rect.width)
        maxHeight = max(maxHeight, rect.height)
    }
}
print("{\"count\":\(count),\"width\":\(Int(maxWidth)),\"height\":\(Int(maxHeight))}")
exit(count == 1 ? 0 : 1)
SWIFT
  window_json="$(swift "$swift_probe" "$launched_pid")" || {
    rm -f "$swift_probe"
    echo "FAIL: exact Lectrice process did not own one visible Quartz window" >&2
    exit 1
  }
  rm -f "$swift_probe"
  [ "$(jq -r '.count' <<<"$window_json")" -eq 1 ]
fi

result="$(jq -n \
  --arg status PASS \
  --arg sourceRevision "$source_revision" \
  --arg output "$output" \
  --arg app "$app" \
  --arg bundleId "$bundle_id" \
  --arg version "$version" \
  --arg architecture "$architecture" \
  --arg signature ad-hoc \
  --arg executableSha256 "$app_sha256" \
  --argjson launched "$launch" \
  --arg pid "${launched_pid:-}" \
  --argjson window "$window_json" \
  '{status:$status, sourceRevision:$sourceRevision, output:$output, app:$app,
    bundleId:$bundleId, version:$version, architecture:$architecture,
    signature:$signature, notarized:false, executableSha256:$executableSha256,
    launched:($launched == 1), pid:($pid | if . == "" then null else tonumber end),
    window:$window}')"

if [ -n "$receipt" ]; then
  mkdir -p "$(dirname "$receipt")"
  printf '%s\n' "$result" >"$receipt"
fi
printf '%s\n' "$result"
