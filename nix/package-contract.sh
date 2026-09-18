#!/usr/bin/env bash
# Lectrice Linux package contract verifier (spec 216).
# Usage: package-contract.sh <package-dir> <expected-version>
# Exits 0 only when every contract condition holds. The flake check runs this
# SAME verifier on the real output (must pass) and on a deliberately
# malformed fixture (must FAIL) — the failing run IS the negative control.
set -euo pipefail

pkg="${1:?usage: package-contract.sh <pkg> <expected-version>}"
expected_version="${2:?expected version required}"
fail() { echo "CONTRACT FAIL: $1" >&2; exit 1; }

# Executable + names
[ -x "$pkg/bin/tauri-pdf-reader" ] || fail "binary missing: bin/tauri-pdf-reader"
[ -L "$pkg/bin/lectrice" ] || fail "lectrice symlink missing"
file "$pkg/bin/tauri-pdf-reader" | grep -q "ELF 64-bit.*x86-64" \
  || fail "bin/tauri-pdf-reader is not an x86-64 ELF"

# Desktop integration
desk="$pkg/share/applications/lectrice.desktop"
[ -f "$desk" ] || fail "desktop entry missing"
grep -q "^Exec=$pkg/bin/tauri-pdf-reader" "$desk" || fail "desktop Exec does not resolve into package"
grep -q "^MimeType=application/pdf" "$desk" || fail "PDF MIME association missing"

# Icons
[ -f "$pkg/share/icons/hicolor/128x128/apps/lectrice.png" ] || fail "128px icon missing"
[ -f "$pkg/share/icons/hicolor/256x256/apps/lectrice.png" ] || fail "256px icon missing"

# Plain immutable version metadata (updater contract, 217)
[ -f "$pkg/share/lectrice/version" ] || fail "share/lectrice/version missing"
[ "$(cat "$pkg/share/lectrice/version")" = "$expected_version" ] \
  || fail "version metadata $(cat "$pkg/share/lectrice/version") != expected $expected_version"

# Platform hygiene (ordinary assertion, NOT the negative control)
if [ -e "$pkg/Applications/Lectrice.app" ]; then
  fail "Darwin .app layout leaked into Linux package"
fi
if grep -qE '@(LECTRICE|VERSION)@' "$desk"; then
  fail "unsubstituted placeholder in desktop entry"
fi

echo "package contract OK: $pkg (version $expected_version)"
