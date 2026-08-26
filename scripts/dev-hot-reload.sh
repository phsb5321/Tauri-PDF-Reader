#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."

export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$HOME/.cache/lectrice/hot-reload-target}"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-1}"
APP="$CARGO_TARGET_DIR/debug/tauri-pdf-reader"
CLI_PID=""

stop_app() {
  local pid
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    kill -TERM "$pid" 2>/dev/null || true
  done < <(pgrep -f -- "^${APP}$" || true)
}

shutdown() {
  [ -z "$CLI_PID" ] || kill -TERM "$CLI_PID" 2>/dev/null || true
  stop_app
  exit 0
}

# Cargo/Tauri's restarted child can escape a transient user unit's cgroup.
# Refuse two same-target native windows before launch and reap that exact child
# again when the wrapper is stopped; unrelated packaged Lectrice builds remain
# untouched because their executable path differs.
stop_app
trap shutdown INT TERM
trap stop_app EXIT

nix develop --option min-free 0 --option max-free 0 . -c \
  env GDK_BACKEND="${GDK_BACKEND:-x11}" \
  ./node_modules/.bin/tauri dev &
CLI_PID=$!
wait "$CLI_PID"
