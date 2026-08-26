#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUBJECT="$ROOT/scripts/ci-install-system-dependencies.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"

cat >"$TMP/bin/dpkg-query" <<'STUB'
#!/usr/bin/env bash
package="${!#}"
case ",${FAKE_MISSING:-}," in
  *",$package,"*) exit 1 ;;
  *) printf 'ii ' ;;
esac
STUB

cat >"$TMP/bin/sudo" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$SUDO_LOG"
STUB
chmod +x "$TMP/bin/dpkg-query" "$TMP/bin/sudo"

run_subject() {
  local script="$1" missing="$2"
  shift 2
  : >"$TMP/sudo.log"
  PATH="$TMP/bin:$PATH" SUDO_LOG="$TMP/sudo.log" FAKE_MISSING="$missing" \
    "$script" "$@" >/dev/null
}

assert_missing_path() {
  local script="$1"
  run_subject "$script" "libssl-dev,fakeroot" fakeroot dpkg file
  mapfile -t calls <"$TMP/sudo.log"
  ((${#calls[@]} == 2)) || return 1
  [[ "${calls[0]}" == "env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l apt-get update" ]] || return 1
  [[ "${calls[1]}" == *"NEEDRESTART_MODE=l apt-get install -y --no-install-recommends --no-upgrade"* ]] || return 1
  [[ "${calls[1]}" == *" libssl-dev fakeroot" ]] || return 1
  [[ "${calls[1]}" != *" clang"* && "${calls[1]}" != *" dpkg"* && "${calls[1]}" != *" file"* ]] || return 1
}

# Installed dependencies on the persistent runner must never invoke sudo/APT.
run_subject "$SUBJECT" "" fakeroot dpkg file
[[ ! -s "$TMP/sudo.log" ]]

# A missing package uses list-only needrestart, never upgrades installed names,
# and sends only the missing subset to apt.
assert_missing_path "$SUBJECT"

# Semantic negative controls: the fixture must reject either containment guard
# being removed, rather than merely observing a successful shell exit.
sed 's/ --no-upgrade//' "$SUBJECT" >"$TMP/no-upgrade.sh"
chmod +x "$TMP/no-upgrade.sh"
if assert_missing_path "$TMP/no-upgrade.sh"; then
  echo "FAIL: missing --no-upgrade was not detected" >&2
  exit 1
fi

sed 's/ NEEDRESTART_MODE=l//g' "$SUBJECT" >"$TMP/restart-enabled.sh"
chmod +x "$TMP/restart-enabled.sh"
if assert_missing_path "$TMP/restart-enabled.sh"; then
  echo "FAIL: missing NEEDRESTART_MODE=l was not detected" >&2
  exit 1
fi

echo "ci system dependency guard: PASS"
